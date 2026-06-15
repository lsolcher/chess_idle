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

export interface BoardPositionCollision {
  key: string
  pieces: ChessPiece[]
}

/** Groups pieces that share the same board coordinate (root cause of vanishing/jumping sprites). */
export function findBoardPositionCollisions(
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
): BoardPositionCollision[] {
  const byKey = new Map<string, ChessPiece[]>()
  for (const piece of getAllPieces(playerPieces, enemyPieces)) {
    const key = coordKey(piece.position)
    const group = byKey.get(key) ?? []
    group.push(piece)
    byKey.set(key, group)
  }
  return [...byKey.entries()]
    .filter(([, pieces]) => pieces.length > 1)
    .map(([key, pieces]) => ({ key, pieces }))
}

function collisionKeepPriority(piece: ChessPiece): number {
  let score = piece.side === 'player' ? 1000 : 0
  if (piece.kind === 'king') score += 500
  if (piece.isBoss) score += 200
  return score
}

function findNearestVacantSquare(origin: BoardCoord, occupied: Set<string>): BoardCoord | null {
  if (!occupied.has(coordKey(origin))) {
    return { ...origin }
  }

  for (let dist = 1; dist < BOARD_SIZE * 2; dist += 1) {
    for (let df = -dist; df <= dist; df += 1) {
      for (let dr = -dist; dr <= dist; dr += 1) {
        if (Math.abs(df) + Math.abs(dr) !== dist) continue
        const coord = { file: origin.file + df, rank: origin.rank + dr }
        if (!isInBounds(coord)) continue
        const key = coordKey(coord)
        if (!occupied.has(key)) return coord
      }
    }
  }
  return null
}

/**
 * Ensures every living piece occupies a unique square.
 * Matches `buildOccupancy` priority: player over enemy; kings/bosses stay put when possible.
 */
export function reconcileUniqueBoardPositions(
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
): { playerPieces: ChessPiece[]; enemyPieces: ChessPiece[] } {
  let players = playerPieces.map((piece) => ({
    ...piece,
    position: { ...piece.position },
  }))
  let enemies = enemyPieces.map((piece) => ({
    ...piece,
    position: { ...piece.position },
  }))

  const applyPosition = (pieceId: string, side: ChessPiece['side'], position: BoardCoord) => {
    if (side === 'player') {
      players = players.map((piece) =>
        piece.id === pieceId ? { ...piece, position: { ...position } } : piece,
      )
    } else {
      enemies = enemies.map((piece) =>
        piece.id === pieceId ? { ...piece, position: { ...position } } : piece,
      )
    }
  }

  const buildOccupied = (): Set<string> =>
    new Set(getAllPieces(players, enemies).map((piece) => coordKey(piece.position)))

  for (let pass = 0; pass < 32; pass += 1) {
    const collisions = findBoardPositionCollisions(players, enemies)
    if (collisions.length === 0) break

    let occupied = buildOccupied()

    for (const { pieces } of collisions) {
      const sorted = [...pieces].sort(
        (a, b) => collisionKeepPriority(b) - collisionKeepPriority(a),
      )
      const keeper = sorted[0]!

      for (let i = 1; i < sorted.length; i += 1) {
        const displaced = sorted[i]!
        const vacant = findNearestVacantSquare(displaced.position, occupied)
        if (!vacant) continue

        applyPosition(displaced.id, displaced.side, vacant)
        occupied.add(coordKey(vacant))
      }
    }
  }

  return { playerPieces: players, enemyPieces: enemies }
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
