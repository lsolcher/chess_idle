/**
 * Post-attack positioning (GDD §1.1 / line slam).
 * Sliding pieces that strike at range advance to the square beside the target.
 */
import { coordsEqual, type BoardCoord } from './board'
import { getMovementKind } from './pieceMovement'
import type { BoardMove } from './moves'
import type { ChessPiece, PieceKind } from '@/types/game'

export function isSlidingPieceKind(kind: PieceKind): boolean {
  return kind === 'rook' || kind === 'bishop' || kind === 'queen'
}

/** Chebyshev distance along a straight or diagonal line. */
export function lineAttackDistance(from: BoardCoord, to: BoardCoord): number {
  return Math.max(Math.abs(to.file - from.file), Math.abs(to.rank - from.rank))
}

/**
 * Square immediately before the defender along the attack ray (toward the attacker).
 */
export function getLineSlamLandingSquare(
  from: BoardCoord,
  defenderPosition: BoardCoord,
): BoardCoord {
  const df = Math.sign(defenderPosition.file - from.file)
  const dr = Math.sign(defenderPosition.rank - from.rank)
  return {
    file: defenderPosition.file - df,
    rank: defenderPosition.rank - dr,
  }
}

/**
 * Where the attacker ends after a capture/chip.
 * - Sliding line attack (dist > 1): adjacent to target, not on its square.
 * - Adjacent / knights / pawns / kings: lethal takes target square; chip stays put.
 */
export function isLineSlamAttack(attacker: ChessPiece, defender: ChessPiece): boolean {
  const kind = getMovementKind(attacker)
  const dist = lineAttackDistance(attacker.position, defender.position)
  return isSlidingPieceKind(kind) && dist > 1
}

export function resolveAttackLanding(
  _move: BoardMove,
  attacker: ChessPiece,
  defender: ChessPiece,
  lethal: boolean,
): BoardCoord {
  if (isLineSlamAttack(attacker, defender)) {
    return getLineSlamLandingSquare(attacker.position, defender.position)
  }

  if (lethal) {
    return { ...defender.position }
  }

  return { ...attacker.position }
}

function isSquareOccupiedByOther(
  coord: BoardCoord,
  excludeIds: Set<string>,
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
): boolean {
  for (const piece of [...playerPieces, ...enemyPieces]) {
    if (excludeIds.has(piece.id)) continue
    if (coordsEqual(piece.position, coord)) return true
  }
  return false
}

/**
 * Applies line-slam / melee landing rules, but never stacks onto another piece.
 * When the ideal square is blocked, the attacker stays on its current square.
 */
export function resolveSafeAttackLanding(
  move: BoardMove,
  attacker: ChessPiece,
  defender: ChessPiece,
  lethal: boolean,
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
  defenderRemoved: boolean,
): BoardCoord {
  const ideal = resolveAttackLanding(move, attacker, defender, lethal)
  const exclude = new Set([attacker.id])
  if (!defenderRemoved) {
    exclude.add(defender.id)
  }

  if (!isSquareOccupiedByOther(ideal, exclude, playerPieces, enemyPieces)) {
    return ideal
  }

  if (
    lethal &&
    defenderRemoved &&
    !isLineSlamAttack(attacker, defender) &&
    !isSquareOccupiedByOther(defender.position, exclude, playerPieces, enemyPieces)
  ) {
    return { ...defender.position }
  }

  return { ...attacker.position }
}

export function repositionPiece(
  pieceId: string,
  side: ChessPiece['side'],
  landing: BoardCoord,
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
): { playerPieces: ChessPiece[]; enemyPieces: ChessPiece[] } {
  const apply = (pieces: ChessPiece[]) =>
    pieces.map((piece) =>
      piece.id === pieceId ? { ...piece, position: { ...landing } } : piece,
    )

  if (side === 'player') {
    return { playerPieces: apply(playerPieces), enemyPieces }
  }
  return { playerPieces, enemyPieces: apply(enemyPieces) }
}

export function removeDefender(
  defenderId: string,
  attackerSide: ChessPiece['side'],
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
): { playerPieces: ChessPiece[]; enemyPieces: ChessPiece[] } {
  if (attackerSide === 'player') {
    return {
      playerPieces,
      enemyPieces: enemyPieces.filter((piece) => piece.id !== defenderId),
    }
  }
  return {
    playerPieces: playerPieces.filter((piece) => piece.id !== defenderId),
    enemyPieces,
  }
}
