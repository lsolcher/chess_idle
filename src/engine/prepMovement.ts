/**
 * Between-wave army repositioning (GDD deploy ranks 0–1).
 * No combat — slide player pieces to empty squares on allowed prep ranks.
 */
import { buildOccupancy, coordKey, coordsEqual, getAllPieces, type BoardCoord } from './board'
import type { BoardMove } from './moves'
import type { ChessPiece, PieceKind } from '@/types/game'

/** King stays on back rank; other pieces may use rank 0 or 1. */
export function getPrepDestinationRanks(kind: PieceKind): readonly number[] {
  return kind === 'king' ? [0] : [0, 1]
}

/**
 * All legal empty-square repositions for a friendly piece during WAVE_PREP.
 */
export function generatePrepRepositionMoves(
  piece: ChessPiece,
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
): BoardMove[] {
  if (piece.side !== 'player') return []

  const occupancy = buildOccupancy(getAllPieces(playerPieces, enemyPieces))
  const moves: BoardMove[] = []

  for (const rank of getPrepDestinationRanks(piece.kind)) {
    for (let file = 0; file < 8; file += 1) {
      const to: BoardCoord = { file, rank }
      if (coordsEqual(to, piece.position)) continue
      if (occupancy.has(coordKey(to))) continue

      moves.push({
        pieceId: piece.id,
        from: { ...piece.position },
        to,
        kind: piece.kind,
        side: 'player',
        isCapture: false,
        isExtendedStep: false,
      })
    }
  }

  return moves
}
