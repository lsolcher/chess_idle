/**
 * Headless economy / progression simulation for balance reporting.
 */
import {
  MIN_MINUTES_TO_PRESTIGE,
  TARGET_MINUTES_TO_PRESTIGE,
} from '@/engine/balanceConstants'
import {
  BOSS_HP_MULTIPLIER,
  calculateEnemyStageHpMult,
  generateEnemyComposition,
  getBossWaveClearMultiplier,
  getProceduralWaveSize,
  isBossStage,
} from '@/engine/stageManager'
import {
  enumerateMovesForSide,
  getAiMove,
  scoreDojoMove,
  type Board,
} from '@/engine/chessDojo'
import {
  calculateGoldAction,
  calculateGoldClear,
  calculateStageGoldMult,
  createPiece,
  PIECE_DEFINITIONS,
  type ChessPiece,
  type PieceKind,
} from '@/types/game'

export interface StageEconomySample {
  stage: number
  goldPerMinute: number
  estimatedClearSec: number
  waveSize: number
  totalEnemyHp: number
}

export interface ProgressionSimulationResult {
  minutesToStage20: number
  minutesToStage50: number
  minutesToStage100: number
  stageSamples: StageEconomySample[]
  breakpoints: number[]
}

export interface DojoAiMatchupResult {
  games: number
  hardWins: number
  mediumWins: number
  draws: number
  /** Share of samples where Hard's move scores strictly higher than Medium's. */
  hardWinRate: number
  /** Share where Hard scores >= Medium (includes ties). */
  hardAdvantageRate: number
}

const PRESTIGE_STAGE = 20

/** Player roster size grows with milestone bands (idle auto-play assumption). */
export function estimatePlayerPieceCount(stage: number): number {
  if (stage < 8) return 2
  if (stage < 17) return 3
  if (stage < 24) return 4
  if (stage < 38) return 6
  if (stage < 60) return 8
  return 9
}

function estimatePlayerDps(stage: number, pieceCount: number): number {
  const king = PIECE_DEFINITIONS.king
  const pawn = PIECE_DEFINITIONS.pawn
  let dps = king.baseAp / king.baseIntervalSec
  const extras = Math.max(0, pieceCount - 1)
  dps += (extras * pawn.baseAp) / pawn.baseIntervalSec
  const stageApBoost = 1 + Math.min(0.35, (stage - 1) * 0.012)
  return dps * stageApBoost
}

function estimateEnemyWaveHp(stage: number): number {
  const waveSize = getProceduralWaveSize(stage)
  const kinds = generateEnemyComposition(stage, waveSize)
  let total = 0
  for (let i = 0; i < kinds.length; i += 1) {
    const kind = kinds[i]!
    const def = PIECE_DEFINITIONS[kind]
    const isBossPiece = isBossStage(stage) && (kind === 'king' || i === 0)
    const hpMult =
      calculateEnemyStageHpMult(stage) * (isBossPiece ? BOSS_HP_MULTIPLIER : 1)
    total += def.baseHp * hpMult
  }
  return total
}

/** Seconds to clear a stage under auto-play assumptions. */
export function estimateStageClearSec(stage: number): number {
  const pieceCount = estimatePlayerPieceCount(stage)
  const dps = estimatePlayerDps(stage, pieceCount)
  const enemyHp = estimateEnemyWaveHp(stage)
  const bossMult = isBossStage(stage) ? 1.35 : 1
  const stallOverhead = 1 + Math.min(0.5, stage * 0.008)
  return (enemyHp / Math.max(1, dps)) * bossMult * stallOverhead
}

/** Gold earned during one stage (actions + clear, combo ≈ 1.25). */
export function estimateStageGoldEarned(stage: number): number {
  const pieceCount = estimatePlayerPieceCount(stage)
  const clearSec = estimateStageClearSec(stage)
  const actionsPerSec = estimatePlayerDps(stage, pieceCount) / 6
  const actionGold =
    calculateGoldAction(stage, 1, 1.25, 0) * actionsPerSec * clearSec
  const clearGold =
    calculateGoldClear(stage, pieceCount) * getBossWaveClearMultiplier(stage)
  return actionGold + clearGold
}

export function sampleGoldPerMinute(stage: number): number {
  const earned = estimateStageGoldEarned(stage)
  const minutes = estimateStageClearSec(stage) / 60
  return earned / Math.max(minutes, 0.05)
}

/** Average GPM from stage 1 through `stage` (journey-wide, not instantaneous spike). */
export function journeyGoldPerMinuteThrough(stage: number): number {
  let totalGold = 0
  let totalSec = 0
  for (let s = 1; s <= stage; s += 1) {
    totalGold += estimateStageGoldEarned(s)
    totalSec += estimateStageClearSec(s)
  }
  return totalGold / Math.max(totalSec / 60, 0.05)
}

export function simulateProgressionToStage(
  targetStage: number,
): ProgressionSimulationResult {
  const stageSamples: StageEconomySample[] = []
  const breakpoints: number[] = []
  let totalSec = 0
  let prevGoldPerMin = 0

  for (let stage = 1; stage < targetStage; stage += 1) {
    const clearSec = estimateStageClearSec(stage)
    totalSec += clearSec
    const gpm = sampleGoldPerMinute(stage)
    stageSamples.push({
      stage,
      goldPerMinute: gpm,
      estimatedClearSec: clearSec,
      waveSize: getProceduralWaveSize(stage),
      totalEnemyHp: estimateEnemyWaveHp(stage),
    })

    if (prevGoldPerMin > 0 && gpm > prevGoldPerMin * 2.2) {
      breakpoints.push(stage)
    }
    if (clearSec < 8 && stage > 5) {
      breakpoints.push(stage)
    }
    prevGoldPerMin = gpm
  }

  const minutesTo = (stage: number): number => {
    let sec = 0
    for (let s = 1; s < stage; s += 1) {
      sec += estimateStageClearSec(s)
    }
    return sec / 60
  }

  return {
    minutesToStage20: minutesTo(PRESTIGE_STAGE),
    minutesToStage50: minutesTo(50),
    minutesToStage100: minutesTo(100),
    stageSamples,
    breakpoints: [...new Set(breakpoints)].sort((a, b) => a - b),
  }
}

function randomOpeningBoard(seed: number): Board {
  const playerKing = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
  const enemyKing = createPiece('ek', 'king', 'enemy', { file: 4, rank: 7 })
  const pieces: ChessPiece[] = [playerKing, enemyKing]

  const extras: PieceKind[] = ['pawn', 'pawn', 'knight', 'bishop']
  extras.forEach((kind, index) => {
    const side = index % 2 === 0 ? 'player' : 'enemy'
    pieces.push(
      createPiece(
        `p-${seed}-${index}`,
        kind,
        side,
        { file: (index + seed) % 7, rank: side === 'player' ? 1 : 6 },
      ),
    )
  })

  return {
    pieces,
    sideToMove: seed % 2 === 0 ? 'enemy' : 'player',
    aiSide: 'enemy',
    decreeStepEnabled: false,
    royalDecreeActive: false,
    personality: 'defensive',
  }
}

/**
 * On equal positions, how often Hard's top move scores above Medium's (heuristic quality).
 */
export function simulateDojoAiMatchup(sampleCount = 48): DojoAiMatchupResult {
  let hardWins = 0
  let mediumWins = 0
  let draws = 0

  let hardAdvantage = 0

  for (let i = 0; i < sampleCount; i += 1) {
    const board = randomOpeningBoard(i + 1)
    const aiSide = board.aiSide ?? 'enemy'
    if (board.sideToMove !== aiSide) {
      board.sideToMove = aiSide
    }

    const hardMove = getAiMove(board, 'hard')
    const mediumMove = getAiMove(board, 'medium')
    if (!hardMove || !mediumMove) {
      draws += 1
      continue
    }

    const hardScore = scoreDojoMove(board, hardMove)
    const mediumScore = scoreDojoMove(board, mediumMove)
    if (hardScore >= mediumScore) hardAdvantage += 1
    if (hardScore > mediumScore * 1.02) hardWins += 1
    else if (mediumScore > hardScore * 1.02) mediumWins += 1
    else draws += 1
  }

  const decided = hardWins + mediumWins
  return {
    games: sampleCount,
    hardWins,
    mediumWins,
    draws,
    hardWinRate: decided > 0 ? hardWins / decided : 0,
    hardAdvantageRate: hardAdvantage / sampleCount,
  }
}

export interface BalanceReport {
  progression: ProgressionSimulationResult
  goldPerMinuteStage1: number
  goldPerMinuteStage50: number
  goldPerMinuteStage100: number
  dojoMatchup: DojoAiMatchupResult
  stageGoldMultStage50: number
  meetsPrestigePacingTarget: boolean
}

export function buildBalanceReport(): BalanceReport {
  const progression = simulateProgressionToStage(101)
  return {
    progression,
    goldPerMinuteStage1: journeyGoldPerMinuteThrough(1),
    goldPerMinuteStage50: journeyGoldPerMinuteThrough(50),
    goldPerMinuteStage100: journeyGoldPerMinuteThrough(100),
    dojoMatchup: simulateDojoAiMatchup(48),
    stageGoldMultStage50: calculateStageGoldMult(50),
    meetsPrestigePacingTarget:
      progression.minutesToStage20 >= MIN_MINUTES_TO_PRESTIGE,
  }
}

export function formatBalanceReport(report: BalanceReport): string {
  const lines = [
    '=== Idle Chess RPG Balance Report ===',
    `Minutes to Stage 20 (prestige): ${report.progression.minutesToStage20.toFixed(1)}`,
    `Minutes to Stage 50: ${report.progression.minutesToStage50.toFixed(1)}`,
    `Minutes to Stage 100: ${report.progression.minutesToStage100.toFixed(1)}`,
    `Gold/min @ Stage 1: ${report.goldPerMinuteStage1.toFixed(0)}`,
    `Gold/min @ Stage 50: ${report.goldPerMinuteStage50.toFixed(0)}`,
    `Gold/min @ Stage 100: ${report.goldPerMinuteStage100.toFixed(0)}`,
    `Stage gold mult @ 50: ${report.stageGoldMultStage50.toFixed(3)}`,
    `Hard vs Medium — Hard strictly better: ${(report.dojoMatchup.hardWinRate * 100).toFixed(1)}%`,
    `Hard vs Medium — Hard >= Medium: ${(report.dojoMatchup.hardAdvantageRate * 100).toFixed(1)}%`,
    `Instant GPM snapshot @ Stage 50: ${sampleGoldPerMinute(50).toFixed(0)}`,
    `Breakpoints (economy spikes / trivial clears): ${report.progression.breakpoints.join(', ') || 'none'}`,
    `Meets minimum prestige pacing (>=${MIN_MINUTES_TO_PRESTIGE}m): ${report.meetsPrestigePacingTarget}`,
    `Design target prestige time (~${TARGET_MINUTES_TO_PRESTIGE}m): ${report.progression.minutesToStage20.toFixed(1)}m`,
  ]
  return lines.join('\n')
}
