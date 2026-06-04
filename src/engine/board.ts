/**
 * 8×8 board coordinate utilities and occupancy mapping.
 * Player starts at low ranks (0–1); enemy back rank is rank 7 (GDD promotion target).
 */
import type { BoardCoord, ChessPiece, PieceSide } from '@/types/game'

export type { BoardCoord }

export const BOARD_SIZE = 8
export const PLAYER_PROMOTION_RANK = 7
export const ENEMY_BACK_RANK = 0

/** Center squares e4,d4,e5,d5 in 0-indexed coords. */
export const CENTER_SQUARES: BoardCoord[] = [
  { file: 3, rank: 3 },
  { file: 4, rank: 3 },
  { file: 3, rank: 4 },
  { file: 4, rank: 4 },
]

export function coordKey(coord: BoardCoord): string {
  return `${coord.file},${coord.rank}`
}

export function isInBounds(coord: BoardCoord): boolean {
  return (
    coord.file >= 0 &&
    coord.file < BOARD_SIZE &&
    coord.rank >= 0 &&
    coord.rank < BOARD_SIZE
  )
}

export function coordsEqual(a: BoardCoord, b: BoardCoord): boolean {
  return a.file === b.file && a.rank === b.rank
}

export function manhattanDistance(a: BoardCoord, b: BoardCoord): number {
  return Math.abs(a.file - b.file) + Math.abs(a.rank - b.rank)
}

/** Coordinate keys occupied by a roster (spawn / deploy collision checks). */
export function occupiedKeysFromPieces(pieces: ChessPiece[]): Set<string> {
  return new Set(pieces.map((piece) => coordKey(piece.position)))
}

/**
 * Builds O(1) lookup from all on-board pieces (player + enemy).
 * On duplicate coordinates the friendly piece wins so UI/combat never "hides" the King.
 */
export function buildOccupancy(pieces: ChessPiece[]): Map<string, ChessPiece> {
  const map = new Map<string, ChessPiece>()
  for (const piece of pieces) {
    if (piece.side === 'enemy') {
      map.set(coordKey(piece.position), piece)
    }
  }
  for (const piece of pieces) {
    if (piece.side === 'player') {
      map.set(coordKey(piece.position), piece)
    }
  }
  return map
}

export function getPieceAt(
  occupancy: Map<string, ChessPiece>,
  coord: BoardCoord,
): ChessPiece | undefined {
  return occupancy.get(coordKey(coord))
}

export function getAllPieces(player: ChessPiece[], enemy: ChessPiece[]): ChessPiece[] {
  return [...player, ...enemy]
}

export function findKing(pieces: ChessPiece[], side: PieceSide): ChessPiece | undefined {
  return pieces.find((piece) => piece.side === side && piece.kind === 'king')
}

/** Progress toward enemy back rank for promotion AI weighting (0–1). */
export function promotionProgress(coord: BoardCoord, side: PieceSide): number {
  if (side === 'player') {
    return coord.rank / PLAYER_PROMOTION_RANK
  }
  return (BOARD_SIZE - 1 - coord.rank) / PLAYER_PROMOTION_RANK
}

/** Returns 0, 0.25, or 0.5 central control bonus weight for AI scoring. */
export function centralControlWeight(coord: BoardCoord): number {
  if (CENTER_SQUARES.some((c) => coordsEqual(c, coord))) return 0.5
  const nearCenter = CENTER_SQUARES.some(
    (c) => manhattanDistance(c, coord) === 1 && isInBounds(coord),
  )
  return nearCenter ? 0.25 : 0
}

export function algebraicLabel(coord: BoardCoord): string {
  return `${String.fromCharCode(97 + coord.file)}${coord.rank + 1}`
}
