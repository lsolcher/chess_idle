/**
 * Enemy auto-AI heuristic — capture-first, check pressure, march on player back rank.
 * Runs when an enemy piece's initiative bar fills (GDD §1.6 mirror).
 */
import { findKing, manhattanDistance } from './board'
import { generateLegalMoves, isSquareAttacked, type BoardMove, type MoveContext } from './moves'
import {
  calculateDamageDealt,
  PIECE_DEFINITIONS,
  type ChessPiece,
} from '@/types/game'

export const ENEMY_AI_WEIGHTS = {
  capture: 10.0,
  check: 5.0,
  advanceTowardBackRank: 3.0,
  damageRatio: 2.0,
  centralAdvance: 0.5,
} as const

export interface EnemyAiContext extends MoveContext {
  movingPiece: ChessPiece
}

function pieceMaterialValue(kind: ChessPiece['kind']): number {
  return PIECE_DEFINITIONS[kind].captureValue
}

function wouldGiveCheckToPlayerKing(move: BoardMove, ctx: EnemyAiContext): boolean {
  const playerKing = findKing(ctx.allPieces, 'player')
  if (!playerKing) return false
  return move.to.file === playerKing.position.file && move.to.rank === playerKing.position.rank
}

/** Enemy marches toward player back rank (rank 0). */
function backRankAdvanceBonus(move: BoardMove, side: ChessPiece['side']): number {
  if (side !== 'enemy') return 0
  if (move.to.rank < move.from.rank) {
    return ENEMY_AI_WEIGHTS.advanceTowardBackRank
  }
  return 0
}

/**
 * Scores one enemy candidate move — higher is better for the AI.
 */
export function scoreEnemyMove(move: BoardMove, ctx: EnemyAiContext): number {
  let score = 0

  if (move.isCapture) {
    score += ENEMY_AI_WEIGHTS.capture
    const target = ctx.allPieces.find((piece) => piece.id === move.capturedPieceId)
    if (target) {
      const damage = calculateDamageDealt(ctx.movingPiece.stats.ap, target.stats.def)
      score += ENEMY_AI_WEIGHTS.damageRatio * (damage / target.stats.maxHp)
      score += pieceMaterialValue(target.kind) * 0.1
    }
  }

  if (wouldGiveCheckToPlayerKing(move, ctx)) {
    score += ENEMY_AI_WEIGHTS.check
  }

  score += backRankAdvanceBonus(move, move.side)

  const playerKing = findKing(ctx.allPieces, 'player')
  if (playerKing && !move.isCapture) {
    const distBefore = manhattanDistance(move.from, playerKing.position)
    const distAfter = manhattanDistance(move.to, playerKing.position)
    if (distAfter < distBefore) {
      score += ENEMY_AI_WEIGHTS.centralAdvance * 2
    }
  }

  if (isSquareAttacked(move.to, ctx.allPieces, move.side) && !move.isCapture) {
    score -= 0.35
  }

  const players = ctx.allPieces.filter(
    (piece) => piece.side === 'player' && piece.stats.hp > 0,
  )
  if (players.length > 0 && !move.isCapture) {
    const minBefore = Math.min(
      ...players.map((p) => manhattanDistance(move.from, p.position)),
    )
    const minAfter = Math.min(
      ...players.map((p) => manhattanDistance(move.to, p.position)),
    )
    if (minAfter < minBefore) {
      score += ENEMY_AI_WEIGHTS.advanceTowardBackRank
    }
  }

  return score
}

/** Returns all enemy moves ranked by heuristic score (highest first). */
export function scoreAllEnemyMoves(piece: ChessPiece, ctx: EnemyAiContext): { move: BoardMove; score: number }[] {
  const moves = generateLegalMoves(piece, { ...ctx, decreeStepEnabled: false })
  return moves
    .map((move) => ({ move, score: scoreEnemyMove(move, { ...ctx, movingPiece: piece }) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aVal = a.move.isCapture
        ? pieceMaterialValue(
            ctx.allPieces.find((p) => p.id === a.move.capturedPieceId)?.kind ?? 'pawn',
          )
        : 0
      const bVal = b.move.isCapture
        ? pieceMaterialValue(
            ctx.allPieces.find((p) => p.id === b.move.capturedPieceId)?.kind ?? 'pawn',
          )
        : 0
      return bVal - aVal
    })
}

/** Picks the best enemy move for the acting piece. */
export function getEnemyMoveHeuristic(piece: ChessPiece, ctx: EnemyAiContext): BoardMove | null {
  return scoreAllEnemyMoves(piece, ctx)[0]?.move ?? null
}

/** Alias matching task naming. */
export const selectBestEnemyMove = getEnemyMoveHeuristic
