/**
 * The Grandmaster (Stage 50) signature rules — GDD §3.2 phase table.
 * Pure engine logic; consumed by bossMechanics and the Pinia store.
 */
import { coordKey, getAllPieces, manhattanDistance } from '@/engine/board'
import type { BossCombatRuntime } from '@/engine/bossMechanics'
import type { BoardCoord, ChessPiece } from '@/types/game'

/** Player initiative fill +30% in Phase III (shorter effective intervals). */
export const GRANDMASTER_PHASE3_INITIATIVE_MULT = 1.3

/** Click damage +50% in Phase III (GDD). */
export const GRANDMASTER_PHASE3_CLICK_MULT = 1.5

export type GrandmasterPhase = 1 | 2 | 3

export interface GrandmasterCombatModifiers {
  phase: GrandmasterPhase
  playerInitiativeMult: number
  clickDamageMult: number
}

const PHASE2_THRESHOLD = 0.66
const PHASE3_THRESHOLD = 0.33

/** HP band for the active Grandmaster phase. */
export function getGrandmasterPhase(hpRatio: number): GrandmasterPhase {
  if (hpRatio > PHASE2_THRESHOLD) return 1
  if (hpRatio > PHASE3_THRESHOLD) return 2
  return 3
}

/**
 * Runtime combat buffs while the Grandmaster boss is alive.
 */
export function getGrandmasterCombatModifiers(
  runtime: BossCombatRuntime | null,
  enemies: ChessPiece[],
): GrandmasterCombatModifiers {
  const defaults: GrandmasterCombatModifiers = {
    phase: 1,
    playerInitiativeMult: 1,
    clickDamageMult: 1,
  }
  if (!runtime || runtime.identity !== 'grandmaster') return defaults

  const boss = enemies.find((p) => p.isBoss && p.kind === 'king' && p.stats.hp > 0)
  if (!boss || boss.stats.maxHp <= 0) return defaults

  const phase = getGrandmasterPhase(boss.stats.hp / boss.stats.maxHp)
  if (phase === 3) {
    return {
      phase: 3,
      playerInitiativeMult: GRANDMASTER_PHASE3_INITIATIVE_MULT,
      clickDamageMult: GRANDMASTER_PHASE3_CLICK_MULT,
    }
  }
  return { phase, playerInitiativeMult: 1, clickDamageMult: 1 }
}

/**
 * Phase II — copy the highest-AP friendly piece at 50% onto the boss (one-time).
 */
export function applyGrandmasterMiddlegameCopy(
  boss: ChessPiece,
  playerPieces: ChessPiece[],
): ChessPiece {
  const living = playerPieces.filter((p) => p.side === 'player' && p.stats.hp > 0)
  if (living.length === 0) return boss

  const best = living.reduce((a, b) => (a.stats.ap >= b.stats.ap ? a : b))
  const ap = Math.max(boss.stats.ap, Math.round(best.stats.ap * 0.5))
  const hp = Math.max(
    boss.stats.hp,
    Math.min(boss.stats.maxHp, Math.round(best.stats.maxHp * 0.5)),
  )

  return {
    ...boss,
    stats: {
      ...boss.stats,
      ap,
      hp,
      maxHp: Math.max(boss.stats.maxHp, hp),
    },
  }
}

const KING_OFFSETS: BoardCoord[] = [
  { file: -1, rank: -1 },
  { file: 0, rank: -1 },
  { file: 1, rank: -1 },
  { file: -1, rank: 0 },
  { file: 1, rank: 0 },
  { file: -1, rank: 1 },
  { file: 0, rank: 1 },
  { file: 1, rank: 1 },
]

function isSquareAttackedByPlayer(
  coord: BoardCoord,
  playerPieces: ChessPiece[],
): boolean {
  return playerPieces.some(
    (p) =>
      p.side === 'player' &&
      p.stats.hp > 0 &&
      manhattanDistance(p.position, coord) === 1,
  )
}

/**
 * Simplified checkmate pattern: boss King adjacent to a player attacker and
 * no empty escape square (GDD instant phase skip).
 */
export function detectGrandmasterCheckmatePattern(
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
): boolean {
  const boss = enemyPieces.find(
    (p) => p.isBoss && p.kind === 'king' && p.side === 'enemy' && p.stats.hp > 0,
  )
  if (!boss) return false

  const inCheck = playerPieces.some(
    (p) =>
      p.side === 'player' &&
      p.stats.hp > 0 &&
      manhattanDistance(p.position, boss.position) === 1,
  )
  if (!inCheck) return false

  for (const offset of KING_OFFSETS) {
    const escape: BoardCoord = {
      file: boss.position.file + offset.file,
      rank: boss.position.rank + offset.rank,
    }
    if (escape.file < 0 || escape.file > 7 || escape.rank < 0 || escape.rank > 7) {
      continue
    }
    const occupied = getAllPieces(playerPieces, enemyPieces).some(
      (p) => p.stats.hp > 0 && coordKey(p.position) === coordKey(escape),
    )
    if (!occupied && !isSquareAttackedByPlayer(escape, playerPieces)) {
      return false
    }
  }
  return true
}

/**
 * Checkmate skip — drop boss to the next phase HP threshold (or 0 in Phase III).
 */
export function applyGrandmasterCheckmatePhaseSkip(
  enemies: ChessPiece[],
  phasesTriggered: number[],
): { enemies: ChessPiece[]; phasesTriggered: number[]; skipped: boolean } {
  const bossIndex = enemies.findIndex(
    (p) => p.isBoss && p.kind === 'king' && p.stats.hp > 0,
  )
  if (bossIndex === -1) {
    return { enemies, phasesTriggered, skipped: false }
  }

  const boss = enemies[bossIndex]!
  const ratio = boss.stats.maxHp > 0 ? boss.stats.hp / boss.stats.maxHp : 0
  const phase = getGrandmasterPhase(ratio)

  let targetHp = 0
  const nextPhases = [...phasesTriggered]

  if (phase === 1) {
    targetHp = Math.ceil(boss.stats.maxHp * PHASE2_THRESHOLD)
    if (!nextPhases.includes(PHASE2_THRESHOLD)) {
      nextPhases.push(PHASE2_THRESHOLD)
    }
  } else if (phase === 2) {
    targetHp = Math.ceil(boss.stats.maxHp * PHASE3_THRESHOLD)
    if (!nextPhases.includes(PHASE3_THRESHOLD)) {
      nextPhases.push(PHASE3_THRESHOLD)
    }
  }

  const updated = enemies.map((piece, i) =>
    i === bossIndex
      ? { ...piece, stats: { ...piece.stats, hp: targetHp } }
      : piece,
  )

  return { enemies: updated, phasesTriggered: nextPhases, skipped: true }
}
