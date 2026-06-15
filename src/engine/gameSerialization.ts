/**
 * JSON-safe game state serialization for saves and future multiplayer sync (Phase 8.5).
 * Keeps persistence/network payloads free of functions and ephemeral UI fields.
 */
import {
  createDefaultAestheticPreferences,
  createInitialGameState,
  GAME_SCHEMA_VERSION,
  type GameState,
  type UnlockedSlotsState,
} from '@/types/game'
import { resolveUnlockedSlotsFromMilestones } from '@/engine/pieceShop'
import { createDefaultEquippedCosmetics } from '@/engine/cosmetics'
import { normalizePersistedLifetime } from '@/engine/saveMigration'
import { createEmptyWaveCombatStats } from '@/engine/waveOutcome'

/** Fields stripped before network/export payloads (session-only). */
export const EPHEMERAL_STATE_KEYS = [
  'combatLoopRunning',
  'combatFeedbackEvents',
  'screenShakeUntilMs',
  'impactFreezeUntilMs',
  'boardZoomUntilMs',
  'pieceJuicePulseUntilMs',
  'armyVictoryGlowBurstUntilMs',
  'lastOfflineGoldGranted',
  'manualPendingPieceId',
  'prepPendingPieceId',
  'waveCombatStats',
  'waveOutcomeReport',
] as const satisfies readonly (keyof GameState)[]

export type EphemeralStateKey = (typeof EPHEMERAL_STATE_KEYS)[number]

/** Every `GameState` key that must round-trip through save/load (excluding ephemeral session fields). */
export function listPersistedGameStateKeys(): (keyof GameState)[] {
  const ephemeral = new Set<string>(EPHEMERAL_STATE_KEYS)
  const sample = createInitialGameState(0)
  return (Object.keys(sample) as (keyof GameState)[]).filter((k) => !ephemeral.has(k))
}

/** Migrates legacy boolean piece unlocks to numeric roster caps. */
export function normalizeUnlockedSlots(
  raw: Partial<UnlockedSlotsState> & Record<string, unknown> | undefined,
  maxStageReached: number,
): UnlockedSlotsState {
  const milestone = resolveUnlockedSlotsFromMilestones(maxStageReached)
  if (!raw) return milestone

  const slotCount = (value: unknown, fallback: number): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.floor(value))
    }
    if (value === true) return Math.max(1, fallback)
    if (value === false) return 0
    return fallback
  }

  return {
    pawn: slotCount(raw.pawn, milestone.pawn),
    knight: slotCount(raw.knight, milestone.knight),
    bishop: slotCount(raw.bishop, milestone.bishop),
    rook: slotCount(raw.rook, milestone.rook),
    queen: slotCount(raw.queen, milestone.queen),
  }
}

/**
 * Combat-relevant subset for authoritative board sync (multiplayer-ready shape).
 */
export interface CombatSnapshot {
  schemaVersion: GameState['schemaVersion']
  currentStage: number
  wavePhase: GameState['wavePhase']
  playerPieces: GameState['playerPieces']
  enemyPieces: GameState['enemyPieces']
  bossCombat: GameState['bossCombat']
  enemyHpScale: number
  failCountThisStage: number
  lastSimulatedMs: number
}

/** Deep-clones and normalizes state into a JSON-serializable plain object. */
export function toJsonSafeGameState(state: GameState): GameState {
  const cloned = JSON.parse(JSON.stringify(state)) as GameState
  cloned.schemaVersion = GAME_SCHEMA_VERSION
  cloned.lifetime = normalizePersistedLifetime(cloned)
  cloned.equippedCosmetics =
    cloned.equippedCosmetics ?? createDefaultEquippedCosmetics()
  return cloned
}

/** Serializes full game state (includes lifetime/meta; omits ephemeral keys). */
export function serializeGameState(state: GameState): string {
  const safe = toJsonSafeGameState(state)
  for (const key of EPHEMERAL_STATE_KEYS) {
    delete safe[key]
  }
  return JSON.stringify(safe)
}

/**
 * Parses persisted or network JSON into a normalized `GameState`.
 * Falls back to a fresh run when schema is missing or corrupt.
 */
export function deserializeGameState(json: string): GameState {
  try {
    const parsed = JSON.parse(json) as Partial<GameState>
    if (!parsed || typeof parsed !== 'object') {
      return createInitialGameState()
    }
    const base = createInitialGameState()
    const merged: GameState = {
      ...base,
      ...parsed,
      currencies: { ...base.currencies, ...parsed.currencies },
      combo: { ...base.combo, ...parsed.combo },
      stamina: { ...base.stamina, ...parsed.stamina },
      promotion: { ...base.promotion, ...parsed.promotion },
      royalDecree: { ...base.royalDecree, ...parsed.royalDecree },
      achievements: { ...base.achievements, ...parsed.achievements },
      metaUpgrades: { ...base.metaUpgrades, ...parsed.metaUpgrades },
      unlockedSlots: normalizeUnlockedSlots(
        parsed.unlockedSlots as Partial<UnlockedSlotsState> & Record<string, unknown>,
        parsed.maxStageReached ?? base.maxStageReached,
      ),
      lifetime: normalizePersistedLifetime({ ...base, ...parsed } as GameState),
      equippedCosmetics:
        parsed.equippedCosmetics ?? createDefaultEquippedCosmetics(),
      aestheticPreferences: {
        ...createDefaultAestheticPreferences(),
        ...parsed.aestheticPreferences,
      },
      waveCheckpointStage: parsed.waveCheckpointStage ?? 1,
      lastFailRewindToStage: parsed.lastFailRewindToStage ?? null,
      bossWaveDeadlineMs: parsed.bossWaveDeadlineMs ?? null,
      bossCombat: parsed.bossCombat ?? null,
      playerPieces: parsed.playerPieces ?? base.playerPieces,
      enemyPieces: parsed.enemyPieces ?? base.enemyPieces,
      combatFeedbackEvents: [],
      screenShakeUntilMs: 0,
      impactFreezeUntilMs: 0,
      boardZoomUntilMs: 0,
      pieceJuicePulseUntilMs: {},
      armyVictoryGlowBurstUntilMs: 0,
      lastOfflineGoldGranted: 0,
      combatLoopRunning: false,
      manualPendingPieceId: null,
      prepPendingPieceId: null,
      waveCombatStats: createEmptyWaveCombatStats(),
      waveOutcomeReport: null,
    }
    merged.schemaVersion = GAME_SCHEMA_VERSION
    return merged
  } catch {
    return createInitialGameState()
  }
}

/** Extracts the board/combat slice used for future authoritative sync. */
export function toCombatSnapshot(state: GameState): CombatSnapshot {
  return {
    schemaVersion: state.schemaVersion,
    currentStage: state.currentStage,
    wavePhase: state.wavePhase,
    playerPieces: state.playerPieces,
    enemyPieces: state.enemyPieces,
    bossCombat: state.bossCombat,
    enemyHpScale: state.enemyHpScale,
    failCountThisStage: state.failCountThisStage,
    lastSimulatedMs: state.lastSimulatedMs,
  }
}

export function serializeCombatSnapshot(snapshot: CombatSnapshot): string {
  return JSON.stringify(snapshot)
}

export function deserializeCombatSnapshot(json: string): CombatSnapshot | null {
  try {
    return JSON.parse(json) as CombatSnapshot
  } catch {
    return null
  }
}

/** Stable ordering for deterministic snapshot comparison (PvP sync tests). */
export function normalizeCombatSnapshot(snapshot: CombatSnapshot): CombatSnapshot {
  const byId = (pieces: CombatSnapshot['playerPieces']) =>
    [...pieces].sort((a, b) => a.id.localeCompare(b.id))
  return {
    ...snapshot,
    playerPieces: byId(snapshot.playerPieces),
    enemyPieces: byId(snapshot.enemyPieces),
  }
}

/** Deep equality for authoritative combat sync payloads. */
export function combatSnapshotsEqual(a: CombatSnapshot, b: CombatSnapshot): boolean {
  return (
    JSON.stringify(normalizeCombatSnapshot(a)) ===
    JSON.stringify(normalizeCombatSnapshot(b))
  )
}

/**
 * Serializes → deserializes full state and compares combat slices.
 * Returns false when ghost-army / mid-wave payloads would desync in PvP.
 */
export function roundTripCombatSnapshot(state: GameState): boolean {
  const before = toCombatSnapshot(state)
  const json = serializeGameState(state)
  const restored = deserializeGameState(json)
  const after = toCombatSnapshot(restored)
  return combatSnapshotsEqual(before, after)
}
