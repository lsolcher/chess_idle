/**
 * Endless procedural wave generation (Phase 3.10 / tasks.md).
 * Replaces hardcoded stage bands with scalable composition, stats, and boss cadence.
 *
 * Supporter convenience flags do not alter enemy scaling here — see `supporterQoL.ts`.
 */
import {
  ENEMY_AP_STAGE_GROWTH,
  ENEMY_HP_STAGE_GROWTH,
} from '@/engine/balanceConstants'
import { getSupporterOfflineGoldMult } from '@/engine/supporterQoL'
import {
  generatePatternEnemyComposition,
  resolveWavePatternForStage,
  type WavePatternId,
} from '@/engine/wavePatterns'
import {
  generateBossWaveKinds,
  isBossPieceKind,
  resolveBossIdentity,
  type BossIdentityId,
} from './bossIdentity'

export { resolveWavePatternForStage, type WavePatternId } from '@/engine/wavePatterns'
import { bootstrapPieceInitiative } from './initiative'
import { coordKey, occupiedKeysFromPieces, type BoardCoord } from './board'
import {
  createPiece,
  PIECE_DEFINITIONS,
  type ChessPiece,
  type PieceKind,
} from '@/types/game'

/** Maximum enemies per wave (tasks.md Phase 3.10). */
export const MAX_WAVE_PIECES = 16

/** Continuous enemy stat scaling beyond band tables (tuned in `balanceConstants.ts`). */
export { ENEMY_HP_STAGE_GROWTH, ENEMY_AP_STAGE_GROWTH } from '@/engine/balanceConstants'

/** Full exponential HP scaling applies through this stage; late game uses log soft-cap. */
export const ENEMY_HP_SOFT_CAP_STAGE = 50
/** Per-stage log multiplier above soft-cap: `1 + log1p(stage - 50) * LATE_HP_LOG_FACTOR`. */
export const ENEMY_HP_LATE_LOG_FACTOR = 0.35

/** Boss cadence: every 10 after the milestone table (GDD §3.1 / §3.2). */
export const BOSS_STAGE_INTERVAL = 10
/** Milestone boss stages before the endless ×10 loop continues. */
export const MILESTONE_BOSS_STAGES = [10, 15, 20, 30, 45, 50] as const
export const BOSS_HP_MULTIPLIER = 5
/** GDD §3.2 boss reward — 3× stage clear lump sum. */
export const BOSS_CLEAR_GOLD_MULTIPLIER = 3

const ENEMY_SPAWN_RANKS = [4, 5, 6, 7] as const
const PICK_ORDER: PieceKind[] = ['pawn', 'knight', 'bishop', 'rook', 'queen']

/**
 * Enemy HP multiplier: exponential through {@link ENEMY_HP_SOFT_CAP_STAGE}, then log soft-cap.
 * Prevents Stage 80+ attrition-only clears while preserving early/prestige pacing.
 */
export function calculateEnemyStageHpMult(stage: number): number {
  const safe = Math.max(1, Math.floor(stage))
  const cappedStage = Math.min(safe, ENEMY_HP_SOFT_CAP_STAGE)
  const exponential = ENEMY_HP_STAGE_GROWTH ** (cappedStage - 1)
  if (safe <= ENEMY_HP_SOFT_CAP_STAGE) return exponential
  const late = 1 + Math.log1p(safe - ENEMY_HP_SOFT_CAP_STAGE) * ENEMY_HP_LATE_LOG_FACTOR
  return exponential * late
}

/**
 * Enemy AP multiplier: `1.06^(stage - 1)` applied on top of piece base AP.
 */
export function calculateEnemyStageApMult(stage: number): number {
  const safe = Math.max(1, stage)
  return ENEMY_AP_STAGE_GROWTH ** (safe - 1)
}

/**
 * True on GDD milestone boss stages and endless every-10 loop after stage 50.
 */
export function isBossStage(stage: number): boolean {
  if (stage <= 0) return false
  if ((MILESTONE_BOSS_STAGES as readonly number[]).includes(stage)) return true
  return stage > 50 && stage % BOSS_STAGE_INTERVAL === 0
}

/** Boss waves grant multiplied clear gold (GDD §3.2). */
export function getBossWaveClearMultiplier(stage: number): number {
  return isBossStage(stage) ? BOSS_CLEAR_GOLD_MULTIPLIER : 1
}

/**
 * Wave size grows with stage, capped at 16.
 * Stage 1 → 1 piece; ~+0.45 per stage until cap.
 */
export function getProceduralWaveSize(stage: number): number {
  const safe = Math.max(1, stage)
  const size = Math.floor(1 + safe * 0.45)
  return Math.min(MAX_WAVE_PIECES, Math.max(1, size))
}

/**
 * Spawn weights shift toward high-tier pieces as `stage / 10` rises.
 * Pawn weight decays; knights+ unlock at their GDD milestone stages.
 */
export function getSpawnWeights(stage: number): Record<PieceKind, number> {
  const tierShift = stage / 10
  return {
    king: 0,
    pawn: Math.max(8, 55 - tierShift * 9),
    knight: stage >= PIECE_DEFINITIONS.knight.unlockStage ? 10 + tierShift * 2.5 : 0,
    bishop: stage >= PIECE_DEFINITIONS.bishop.unlockStage ? 8 + tierShift * 2 : 0,
    rook: stage >= PIECE_DEFINITIONS.rook.unlockStage ? 6 + tierShift * 2 : 0,
    queen: stage >= PIECE_DEFINITIONS.queen.unlockStage ? 4 + tierShift * 1.5 : 0,
  }
}

/**
 * Deterministic weighted pick — `(stage, index)` seed keeps tests stable.
 */
export function pickEnemyKindForSlot(stage: number, slotIndex: number): PieceKind {
  const weights = getSpawnWeights(stage)
  let total = 0
  for (const kind of PICK_ORDER) {
    total += weights[kind]
  }
  if (total <= 0) return 'pawn'

  let roll = (stage * 17 + slotIndex * 31) % total
  for (const kind of PICK_ORDER) {
    const weight = weights[kind]
    if (roll < weight) return kind
    roll -= weight
  }
  return 'pawn'
}

/**
 * Builds enemy composition for a wave (boss king + weighted minions).
 */
export function generateEnemyComposition(stage: number, waveSize: number): PieceKind[] {
  const bossKinds = generateBossWaveKinds(stage, waveSize)
  if (bossKinds) {
    return bossKinds.slice(0, waveSize)
  }

  const pattern = resolveWavePatternForStage(stage)
  return generatePatternEnemyComposition(stage, waveSize, pattern)
}

/** Decree-safe pawn layouts for onboarding (GDD §1.2, stages 1–5). */
function decreeSafePawnPositions(count: number): { file: number; rank: number }[] {
  const layouts: { file: number; rank: number }[][] = [
    [{ file: 4, rank: 6 }],
    [
      { file: 3, rank: 6 },
      { file: 5, rank: 6 },
    ],
  ]
  const index = Math.min(Math.max(0, count - 1), layouts.length - 1)
  return layouts[index] ?? layouts[0]!
}

/** All enemy spawn ranks (ranks 4–7), file-major order for deterministic fills. */
export function listEnemySpawnCoords(): BoardCoord[] {
  const coords: BoardCoord[] = []
  for (const rank of ENEMY_SPAWN_RANKS) {
    for (let file = 0; file < 8; file += 1) {
      coords.push({ file, rank })
    }
  }
  return coords
}

function listFreeSpawnCoords(occupied: Set<string>, preferred: BoardCoord[]): BoardCoord[] {
  const freePreferred = preferred.filter((c) => !occupied.has(coordKey(c)))
  if (freePreferred.length > 0) return freePreferred
  return listEnemySpawnCoords().filter((c) => !occupied.has(coordKey(c)))
}

function takeSpawnCoord(
  occupied: Set<string>,
  kind: PieceKind,
  stage: number,
  index: number,
): BoardCoord {
  const preferred = buildSpawnCandidates(kind, stage, index)
  const free = listFreeSpawnCoords(occupied, preferred)
  if (free.length === 0) {
    throw new Error(
      `spawnProceduralWave: no free square for ${kind} (stage ${stage}, index ${index})`,
    )
  }
  return free[0]!
}

function buildSpawnCandidates(kind: PieceKind, stage: number, index: number): BoardCoord[] {
  const candidates: BoardCoord[] = []

  if (kind === 'king') {
    for (const rank of [...ENEMY_SPAWN_RANKS].reverse()) {
      for (let file = 0; file < 8; file += 1) {
        candidates.push({ file, rank })
      }
    }
    const preferred = candidates.find((c) => c.file === 4 && c.rank === 7)
    if (preferred) {
      return [
        preferred,
        ...candidates.filter((c) => c.file !== preferred.file || c.rank !== preferred.rank),
      ]
    }
    return candidates
  }

  if (stage <= 5 && kind === 'pawn') {
    const decree = decreeSafePawnPositions(8)
    for (let i = 0; i < decree.length; i += 1) {
      candidates.push(decree[(index + i) % decree.length]!)
    }
  }

  for (const rank of ENEMY_SPAWN_RANKS) {
    for (let file = 0; file < 8; file += 1) {
      candidates.push({ file: (file + index) % 8, rank })
    }
  }

  return candidates
}

/**
 * Applies endless HP/AP scaling and optional boss HP spike.
 */
export function applyEnemyStageScaling(
  piece: ChessPiece,
  stage: number,
  failHpScale: number,
  isBossPiece: boolean,
): ChessPiece {
  const hpMult =
    calculateEnemyStageHpMult(stage) * failHpScale * (isBossPiece ? BOSS_HP_MULTIPLIER : 1)
  const apMult = calculateEnemyStageApMult(stage)
  const maxHp = Math.max(1, Math.round(piece.stats.maxHp * hpMult))
  const ap = Math.max(1, Math.round(piece.stats.ap * apMult))

  return {
    ...piece,
    isBoss: isBossPiece || piece.isBoss,
    bossId: piece.bossId,
    stats: {
      ...piece.stats,
      maxHp,
      hp: maxHp,
      ap,
    },
  }
}

function spawnEnemyPiece(
  id: string,
  kind: PieceKind,
  position: { file: number; rank: number },
  stage: number,
  nowMs: number,
  failHpScale: number,
  isBossPiece: boolean,
): ChessPiece {
  const base = createPiece(id, kind, 'enemy', position)
  const bootstrapped = bootstrapPieceInitiative(base, nowMs, 1)
  return applyEnemyStageScaling(bootstrapped, stage, failHpScale, isBossPiece)
}

/**
 * Procedural endless wave spawn — single entry used by the combat store.
 */
export function spawnProceduralWave(
  stage: number,
  nowMs: number,
  failHpScale = 1,
  playerPieces: ChessPiece[] = [],
): ChessPiece[] {
  const waveSize = getProceduralWaveSize(stage)
  const kinds = generateEnemyComposition(stage, waveSize)
  const occupied = occupiedKeysFromPieces(playerPieces)
  const enemies: ChessPiece[] = []

  const identity = resolveBossIdentity(stage)

  kinds.forEach((kind, index) => {
    const position = takeSpawnCoord(occupied, kind, stage, index)
    occupied.add(coordKey(position))
    const isBossPiece = Boolean(identity && isBossPieceKind(identity, kind, index))
    const bossId: BossIdentityId | undefined =
      identity && isBossPiece ? identity : undefined
    const scaled = spawnEnemyPiece(
      `enemy-${kind}-${stage}-${index}`,
      kind,
      position,
      stage,
      nowMs,
      failHpScale,
      isBossPiece,
    )
    enemies.push(bossId ? { ...scaled, bossId } : scaled)
  })

  return enemies
}

/** @deprecated Use getProceduralWaveSize — kept for test migration. */
export function getEnemyCountForStage(stage: number): number {
  return getProceduralWaveSize(stage)
}

/** Headless verification for endless scaling curves. */
export function runStageManagerSanityCheck(): { passed: boolean; messages: string[] } {
  const messages: string[] = []
  let passed = true
  const assert = (label: string, ok: boolean) => {
    messages.push(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
    if (!ok) passed = false
  }

  assert('stage 1 HP mult is 1', calculateEnemyStageHpMult(1) === 1)
  assert('stage 10 HP mult ~2', calculateEnemyStageHpMult(10) > 1.9)
  assert(
    'stage 80 softer than pure exponential',
    calculateEnemyStageHpMult(80) <
      ENEMY_HP_STAGE_GROWTH ** 79,
  )
  assert(
    'stage 100 HP mult grows sub-linearly past cap',
    calculateEnemyStageHpMult(100) > calculateEnemyStageHpMult(80),
  )

  const fullBoard = spawnProceduralWave(50, 0)
  const fullKeys = fullBoard.map((p) => coordKey(p.position))
  assert('full wave has unique coords', new Set(fullKeys).size === fullKeys.length)
  assert('stage 10 is boss', isBossStage(10))
  assert('stage 11 not boss', !isBossStage(11))
  assert('wave cap 16', getProceduralWaveSize(100) === MAX_WAVE_PIECES)

  const wave = spawnProceduralWave(10, 0)
  assert('boss wave has boss piece', wave.some((p) => p.isBoss))
  assert('boss king HP spike', (wave.find((p) => p.isBoss)?.stats.maxHp ?? 0) > 200)

  assert(
    'supporter offline mult is QoL-only (1.5×)',
    getSupporterOfflineGoldMult(true) === 1.5 && getSupporterOfflineGoldMult(false) === 1,
  )

  return { passed, messages }
}

export { getSupporterOfflineGoldMult } from '@/engine/supporterQoL'
