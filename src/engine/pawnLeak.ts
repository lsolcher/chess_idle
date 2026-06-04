/**
 * Enemy Pawn Leak — reaching the player back rank sacrifices the pawn for direct King damage (GDD / tasks.md Phase 5).
 * Damage bypasses DEF; pawn is removed after the strike.
 */
import { ENEMY_BACK_RANK, findKing } from '@/engine/board'
import { calculateEnemyStageApMult } from '@/engine/stageManager'
import type { ChessPiece } from '@/types/game'

/** Base leak multiplier on pawn AP before stage scaling. */
export const PAWN_LEAK_AP_MULT = 2

/** Minimum unblockable leak damage so early pawns still threaten the King. */
export const PAWN_LEAK_DAMAGE_FLOOR = 8

export interface PawnLeakResult {
  playerPieces: ChessPiece[]
  enemyPieces: ChessPiece[]
  totalDamage: number
  leakedPawnIds: string[]
}

/**
 * Enemy pawns on rank 0 (player back rank) trigger leak (GDD: "Rank 1" in 1-indexed terms).
 */
export function findLeakingEnemyPawns(enemies: ChessPiece[]): ChessPiece[] {
  return enemies.filter(
    (piece) =>
      piece.side === 'enemy' &&
      piece.kind === 'pawn' &&
      piece.position.rank === ENEMY_BACK_RANK,
  )
}

/**
 * `Damage = max(floor, pawnAP × leakMult × stageAPMult)` — ignores DEF (GDD unblockable).
 */
export function calculatePawnLeakDamage(pawn: ChessPiece, stage: number): number {
  const stageMult = calculateEnemyStageApMult(stage)
  const raw = pawn.stats.ap * PAWN_LEAK_AP_MULT * stageMult
  return Math.max(PAWN_LEAK_DAMAGE_FLOOR, Math.floor(raw))
}

/**
 * Applies all pending leaks: remove pawns, chip King HP, fail wave if King dies.
 */
export function resolveEnemyPawnLeaks(
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
  stage: number,
): PawnLeakResult {
  const leaking = findLeakingEnemyPawns(enemyPieces)
  if (leaking.length === 0) {
    return { playerPieces, enemyPieces, totalDamage: 0, leakedPawnIds: [] }
  }

  let totalDamage = 0
  const leakedIds: string[] = []
  let nextPlayers = playerPieces
  let nextEnemies = enemyPieces

  const king = findKing(nextPlayers, 'player')
  if (!king) {
    return { playerPieces, enemyPieces, totalDamage: 0, leakedPawnIds: [] }
  }

  for (const pawn of leaking) {
    const damage = calculatePawnLeakDamage(pawn, stage)
    totalDamage += damage
    leakedIds.push(pawn.id)
    nextEnemies = nextEnemies.filter((piece) => piece.id !== pawn.id)
  }

  nextPlayers = nextPlayers.map((piece) => {
    if (piece.id !== king.id) return piece
    const hp = Math.max(0, piece.stats.hp - totalDamage)
    return { ...piece, stats: { ...piece.stats, hp } }
  })

  return {
    playerPieces: nextPlayers,
    enemyPieces: nextEnemies,
    totalDamage,
    leakedPawnIds: leakedIds,
  }
}
