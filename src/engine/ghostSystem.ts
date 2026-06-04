/**
 * Ghost Army snapshots for Arena / async PvP (Phase 8.8 prep).
 * Minimal JSON — no initiative timers, VFX, or combat-session fields.
 */
import { bootstrapPiecesForCombat } from '@/engine/initiative'
import {
  createDefaultUpgradeLevels,
  createPiece,
  PIECE_DEFINITIONS,
  type BoardCoord,
  type ChessPiece,
  type GameState,
  type PieceKind,
  type PieceUpgradeLevels,
  type SuperPromotionForm,
  type SuperPromotionTraits,
} from '@/types/game'

import { GHOST_ARMY_SCHEMA_VERSION } from '@/version'

export { GHOST_ARMY_SCHEMA_VERSION } from '@/version'

/** Serializable piece row stored in a ghost database. */
export interface GhostPieceSnapshot {
  id: string
  kind: PieceKind
  position: BoardCoord
  stats: {
    hp: number
    maxHp: number
    ap: number
    def: number
  }
  upgradeLevels: PieceUpgradeLevels
  /** Super-promotion form when present. */
  superForm?: SuperPromotionForm
  superTraits?: SuperPromotionTraits
  slotIndex?: number
}

/** Army snapshot payload — ready for DB / localStorage. */
export interface ArmySnapshot {
  schemaVersion: typeof GHOST_ARMY_SCHEMA_VERSION
  exportedAtMs: number
  sourceStage: number
  /** Draft point-buy total for future matchmaking. */
  powerScore: number
  pieces: GhostPieceSnapshot[]
}

const SUPER_FORM_MULT: Record<SuperPromotionForm, { ap: number; hp: number }> = {
  'super-knight': { ap: 1.35, hp: 1.2 },
  'super-bishop': { ap: 1.3, hp: 1.15 },
  'super-rook': { ap: 1.45, hp: 1.35 },
  'super-queen': { ap: 1.55, hp: 1.4 },
}

/**
 * Draft army power for ghost matchmaking (GDD §9.1 tuning target).
 */
export function calculateArmyPowerScore(pieces: readonly GhostPieceSnapshot[]): number {
  let total = 0
  for (const piece of pieces) {
    const base = PIECE_DEFINITIONS[piece.kind].captureValue * 10
    const lvl =
      (piece.upgradeLevels.ap - 1) * 8 +
      (piece.upgradeLevels.hp - 1) * 6 +
      (piece.upgradeLevels.def - 1) * 5 +
      piece.upgradeLevels.initiative * 10
    let mult = 1
    if (piece.superForm) {
      const m = SUPER_FORM_MULT[piece.superForm]
      mult = 1 + (m.ap + m.hp) / 2 - 1
    }
    total += Math.round((base + lvl) * mult)
  }
  return total
}

/** Maps a live player piece row into ghost storage format. */
export function pieceToGhostSnapshot(piece: ChessPiece): GhostPieceSnapshot {
  const row: GhostPieceSnapshot = {
    id: piece.id,
    kind: piece.kind,
    position: { file: piece.position.file, rank: piece.position.rank },
    stats: {
      hp: piece.stats.hp,
      maxHp: piece.stats.maxHp,
      ap: piece.stats.ap,
      def: piece.stats.def,
    },
    upgradeLevels: { ...piece.upgradeLevels },
  }
  if (piece.superPromotion) {
    row.superForm = piece.superPromotion.form
    row.superTraits = { ...piece.superPromotion.traits }
  }
  if (piece.slotIndex !== undefined) {
    row.slotIndex = piece.slotIndex
  }
  return row
}

/**
 * Serializes a deployed arena roster (independent of live wave board layout).
 */
export function exportArmySnapshotFromPieces(
  pieces: readonly ChessPiece[],
  sourceStage: number,
  nowMs = Date.now(),
): ArmySnapshot {
  const rows = pieces
    .filter((piece) => piece.side === 'player' && piece.stats.hp > 0)
    .map(pieceToGhostSnapshot)

  return {
    schemaVersion: GHOST_ARMY_SCHEMA_VERSION,
    exportedAtMs: nowMs,
    sourceStage,
    powerScore: calculateArmyPowerScore(rows),
    pieces: rows,
  }
}

/**
 * Serializes the player's army from live `GameState` into minimal JSON.
 */
export function exportArmySnapshot(state: GameState, nowMs = Date.now()): ArmySnapshot {
  return exportArmySnapshotFromPieces(
    state.playerPieces,
    state.currentStage,
    nowMs,
  )
}

/** JSON string export for storage APIs. */
export function serializeArmySnapshot(snapshot: ArmySnapshot): string {
  return JSON.stringify(snapshot)
}

/** Parses and validates an army snapshot JSON blob. */
export function parseArmySnapshot(json: string): ArmySnapshot | null {
  try {
    const parsed = JSON.parse(json) as Partial<ArmySnapshot>
    if (!parsed || parsed.schemaVersion !== GHOST_ARMY_SCHEMA_VERSION) return null
    if (!Array.isArray(parsed.pieces) || parsed.pieces.length === 0) return null
    const pieces = parsed.pieces.filter(isValidGhostPieceSnapshot)
    if (pieces.length === 0) return null
    return {
      schemaVersion: GHOST_ARMY_SCHEMA_VERSION,
      exportedAtMs: parsed.exportedAtMs ?? Date.now(),
      sourceStage: parsed.sourceStage ?? 1,
      powerScore: parsed.powerScore ?? calculateArmyPowerScore(pieces),
      pieces,
    }
  } catch {
    return null
  }
}

function isValidGhostPieceSnapshot(value: unknown): value is GhostPieceSnapshot {
  if (!value || typeof value !== 'object') return false
  const row = value as GhostPieceSnapshot
  return (
    typeof row.id === 'string' &&
    typeof row.kind === 'string' &&
    row.kind in PIECE_DEFINITIONS &&
    typeof row.position?.file === 'number' &&
    typeof row.position?.rank === 'number' &&
    typeof row.stats?.hp === 'number' &&
    typeof row.stats?.maxHp === 'number' &&
    typeof row.stats?.ap === 'number' &&
    typeof row.stats?.def === 'number' &&
    row.upgradeLevels !== undefined
  )
}

function rebuildSuperPromotion(row: GhostPieceSnapshot): ChessPiece['superPromotion'] {
  if (!row.superForm) return undefined
  const mult = SUPER_FORM_MULT[row.superForm]
  return {
    form: row.superForm,
    sourcePawnId: row.id,
    apMult: mult.ap,
    hpMult: mult.hp,
    traits: row.superTraits ?? {},
  }
}

/**
 * Hydrates `playerPieces` from a ghost snapshot for arena deploy / tests.
 */
export function importArmySnapshot(
  json: string | ArmySnapshot,
  nowMs = Date.now(),
  globalSpeedMult = 1,
): ChessPiece[] {
  const snapshot = typeof json === 'string' ? parseArmySnapshot(json) : json
  if (!snapshot) return []

  const pieces = snapshot.pieces.map((row) => {
    const levels = row.upgradeLevels ?? createDefaultUpgradeLevels()
    const piece = createPiece(row.id, row.kind, 'player', row.position, levels)
    piece.stats = {
      hp: Math.min(row.stats.hp, row.stats.maxHp),
      maxHp: row.stats.maxHp,
      ap: row.stats.ap,
      def: row.stats.def,
    }
    const superPromotion = rebuildSuperPromotion(row)
    if (superPromotion) {
      piece.superPromotion = superPromotion
    }
    if (row.slotIndex !== undefined) {
      piece.slotIndex = row.slotIndex
    }
    return piece
  })

  return bootstrapPiecesForCombat(pieces, nowMs, globalSpeedMult)
}

export const GHOST_ARMY_STORAGE_KEY = 'idle-chess-rpg-ghost-armies-v1'

export interface GhostArmyRecord {
  id: string
  savedAtMs: number
  label: string
  snapshot: ArmySnapshot
}

/** In-memory fallback when `localStorage` is unavailable (Vitest). */
let memoryGhostBag: GhostArmyRecord[] = []

function resolveGhostStorage(): Storage | null {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage
  }
  return null
}

function readGhostBag(): GhostArmyRecord[] {
  const storage = resolveGhostStorage()
  if (!storage) return [...memoryGhostBag]
  const raw = storage.getItem(GHOST_ARMY_STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as GhostArmyRecord[]
  } catch {
    return []
  }
}

function writeGhostBag(records: GhostArmyRecord[]): void {
  const storage = resolveGhostStorage()
  if (storage) {
    storage.setItem(GHOST_ARMY_STORAGE_KEY, JSON.stringify(records))
  } else {
    memoryGhostBag = records
  }
}

/** Persists a snapshot to the lightweight ghost database (localStorage). */
export function saveGhostArmy(
  snapshot: ArmySnapshot,
  label?: string,
): GhostArmyRecord {
  const id = `ghost-${snapshot.exportedAtMs}-${Math.random().toString(36).slice(2, 8)}`
  const record: GhostArmyRecord = {
    id,
    savedAtMs: Date.now(),
    label: label ?? `Stage ${snapshot.sourceStage} · PC ${snapshot.powerScore}`,
    snapshot,
  }
  const bag = readGhostBag()
  bag.push(record)
  writeGhostBag(bag.slice(-50))
  return record
}

export function listGhostArmies(): GhostArmyRecord[] {
  return readGhostBag()
}

export function loadGhostArmy(id: string): GhostArmyRecord | null {
  return readGhostBag().find((r) => r.id === id) ?? null
}

/**
 * Picks a ghost roster near the target power score (±25% band).
 */
export function selectGhostOpponent(
  targetPower: number,
  records: readonly GhostArmyRecord[] = listGhostArmies(),
): GhostArmyRecord | null {
  if (records.length === 0) return null
  const min = targetPower * 0.75
  const max = targetPower * 1.25
  const inBand = records.filter(
    (r) => r.snapshot.powerScore >= min && r.snapshot.powerScore <= max,
  )
  const pool = inBand.length > 0 ? inBand : records
  const sorted = [...pool].sort(
    (a, b) =>
      Math.abs(a.snapshot.powerScore - targetPower) -
      Math.abs(b.snapshot.powerScore - targetPower),
  )
  return sorted[0] ?? null
}
