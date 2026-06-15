/**
 * Wave phase transitions — extracted from gameStore for Lean 1.0 maintainability.
 * Store actions delegate here; combat tick / move resolution stay in gameStore.
 */
import { getBossWaveClearMultiplier, isBossStage } from '@/engine/stageManager'
import {
  getWaveCheckpointStage,
  resolveStageAfterFail,
} from '@/engine/waveCheckpoints'
import {
  applyFailEnemyHpScale,
  getKingFailReason,
  healPlayerPiecesForPrep,
  isWaveCleared,
  isWaveFailed,
  persistArmyPromotionsBetweenStages,
  relocateArmyToPrepRanks,
  restorePlayerKingForPrep,
} from '@/engine/waveState'
import {
  getEnPassantCarryPercent,
  pruneEnPassantCarry,
  snapshotEnPassantCarry,
  retainPromotionFormHints,
} from '@/engine/enPassantEconomy'
import { PRESTIGE_UNLOCK_STAGE } from '@/engine/prestige'
import {
  calculateGoldClear,
  type GameState,
  type WavePhase,
} from '@/types/game'

export interface WaveOutcomeEvaluation {
  shouldFail: boolean
  shouldComplete: boolean
}

/** Win/lose checks after board mutations during combat. */
export function evaluateWaveOutcomeState(
  wavePhase: WavePhase,
  playerPieces: GameState['playerPieces'],
  enemyPieces: GameState['enemyPieces'],
): WaveOutcomeEvaluation {
  if (wavePhase !== 'WAVE_ACTIVE') {
    return { shouldFail: false, shouldComplete: false }
  }
  if (isWaveFailed(playerPieces)) {
    return { shouldFail: true, shouldComplete: false }
  }
  if (isWaveCleared(enemyPieces)) {
    return { shouldFail: false, shouldComplete: true }
  }
  return { shouldFail: false, shouldComplete: false }
}

export interface AdvanceStageAfterClearInput {
  playerPieces: GameState['playerPieces']
  enPassantCarryByPieceId: GameState['enPassantCarryByPieceId']
  enPassantEconomyRank: number
  currentStage: number
  maxStageReached: number
  lifetime: GameState['lifetime']
}

export interface AdvanceStageAfterClearResult {
  playerPieces: GameState['playerPieces']
  enPassantCarryByPieceId: GameState['enPassantCarryByPieceId']
  currentStage: number
  maxStageReached: number
  lifetime: GameState['lifetime']
  prestigeAvailable: boolean
  friendlyActionsThisStage: number
  promotionStreak: number
  immortalGameUsedThisStage: boolean
  failCountThisStage: number
  enemyHpScale: number
  waveCheckpointStage: number
  lastFailRewindToStage: number | null
}

export function computeAdvanceStageAfterClear(
  input: AdvanceStageAfterClearInput,
): AdvanceStageAfterClearResult {
  const carryPct = getEnPassantCarryPercent(input.enPassantEconomyRank)
  const carryIncrement = snapshotEnPassantCarry(input.playerPieces, carryPct, {})
  const playerPieces = persistArmyPromotionsBetweenStages(
    input.playerPieces,
    carryIncrement,
  )
  const enPassantCarryByPieceId = retainPromotionFormHints(carryIncrement)

  const currentStage = input.currentStage + 1
  const maxStageReached = Math.max(input.maxStageReached, currentStage)
  const lifetime = {
    ...input.lifetime,
    maxStageEverReached: Math.max(
      input.lifetime.maxStageEverReached,
      maxStageReached,
    ),
  }

  return {
    playerPieces,
    enPassantCarryByPieceId,
    currentStage,
    maxStageReached,
    lifetime,
    prestigeAvailable: maxStageReached >= PRESTIGE_UNLOCK_STAGE,
    friendlyActionsThisStage: 0,
    promotionStreak: 0,
    immortalGameUsedThisStage: false,
    failCountThisStage: 0,
    enemyHpScale: 1,
    waveCheckpointStage: getWaveCheckpointStage(maxStageReached),
    lastFailRewindToStage: null,
  }
}

export interface FailWaveResolution {
  currentStage: number
  failCountThisStage: number
  enemyHpScale: number
  waveCheckpointStage: number
  lastFailRewindToStage: number | null
}

export function computeFailWaveResolution(
  currentStage: number,
  maxStageReached: number,
  failCountThisStage: number,
  enemyHpScale: number,
): FailWaveResolution {
  const resolution = resolveStageAfterFail(currentStage, maxStageReached)
  if (resolution.rewound) {
    return {
      currentStage: resolution.nextStage,
      failCountThisStage: 0,
      enemyHpScale: 1,
      waveCheckpointStage: resolution.checkpoint,
      lastFailRewindToStage: resolution.nextStage,
    }
  }
  return {
    currentStage,
    failCountThisStage: failCountThisStage + 1,
    enemyHpScale: applyFailEnemyHpScale(enemyHpScale),
    waveCheckpointStage: resolution.checkpoint,
    lastFailRewindToStage: null,
  }
}

export function computeWaveClearGold(
  clearedStage: number,
  playerPieceCount: number,
): number {
  return (
    calculateGoldClear(clearedStage, playerPieceCount) *
    getBossWaveClearMultiplier(clearedStage)
  )
}

export interface EnterWavePrepPiecesResult {
  playerPieces: GameState['playerPieces']
}

/** Prep heal + rank relocation inputs (store applies bootstrap + reconcile). */
export function preparePlayerPiecesForPrep(
  playerPieces: GameState['playerPieces'],
  enemyPieces: GameState['playerPieces'],
  nowMs: number,
  globalSpeedMult: number,
  prepMissingHpRecoveryFraction: number,
): EnterWavePrepPiecesResult {
  let pieces = restorePlayerKingForPrep(playerPieces, nowMs, globalSpeedMult)
  pieces = healPlayerPiecesForPrep(pieces, {
    missingHpRecoveryFraction: prepMissingHpRecoveryFraction,
  })
  pieces = relocateArmyToPrepRanks(pieces, enemyPieces)
  return { playerPieces: pieces }
}

export function kingFailLabels(playerPieces: GameState['playerPieces']): {
  lastKingFailDetail: 'missing' | 'defeated'
  defaultAttribution: { source: 'capture' } | { source: 'damage' }
} {
  const kingFail = getKingFailReason(playerPieces)
  return {
    lastKingFailDetail:
      kingFail === 'missing' || kingFail === 'defeated' ? kingFail : 'defeated',
    defaultAttribution:
      kingFail === 'missing' ? { source: 'capture' } : { source: 'damage' },
  }
}

export function pruneCarryForRemovedPiece(
  carry: GameState['enPassantCarryByPieceId'],
  playerPieces: GameState['playerPieces'],
): GameState['enPassantCarryByPieceId'] {
  return pruneEnPassantCarry(carry, playerPieces)
}

export { isBossStage }
