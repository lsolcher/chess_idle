/**
 * Legal move generation for the full roster (GDD §1.7) plus Royal Decree King slides.
 */
import {
  buildOccupancy,
  coordKey,
  getPieceAt,
  isInBounds,
  type BoardCoord,
} from './board'
import { getMovementKind } from './pieceMovement'
import type { ChessPiece, PieceKind } from '@/types/game'

export interface BoardMove {
  from: BoardCoord
  to: BoardCoord
  pieceId: string
  kind: PieceKind
  side: ChessPiece['side']
  isCapture: boolean
  capturedPieceId?: string
  isExtendedStep: boolean
}

export interface MoveContext {
  allPieces: ChessPiece[]
  decreeStepEnabled: boolean
}

const KING_DIRECTIONS: BoardCoord[] = [
  { file: -1, rank: -1 },
  { file: 0, rank: -1 },
  { file: 1, rank: -1 },
  { file: -1, rank: 0 },
  { file: 1, rank: 0 },
  { file: -1, rank: 1 },
  { file: 0, rank: 1 },
  { file: 1, rank: 1 },
]

const ORTHOGONAL_DIRS: BoardCoord[] = [
  { file: 0, rank: 1 },
  { file: 0, rank: -1 },
  { file: 1, rank: 0 },
  { file: -1, rank: 0 },
]

const DIAGONAL_DIRS: BoardCoord[] = [
  { file: 1, rank: 1 },
  { file: 1, rank: -1 },
  { file: -1, rank: 1 },
  { file: -1, rank: -1 },
]

const KNIGHT_OFFSETS: BoardCoord[] = [
  { file: -2, rank: -1 },
  { file: -2, rank: 1 },
  { file: -1, rank: -2 },
  { file: -1, rank: 2 },
  { file: 1, rank: -2 },
  { file: 1, rank: 2 },
  { file: 2, rank: -1 },
  { file: 2, rank: 1 },
]

function addOffset(from: BoardCoord, delta: BoardCoord): BoardCoord {
  return { file: from.file + delta.file, rank: from.rank + delta.rank }
}

function createMove(
  piece: ChessPiece,
  to: BoardCoord,
  isCapture: boolean,
  capturedPieceId: string | undefined,
  isExtendedStep: boolean,
): BoardMove {
  return {
    from: { ...piece.position },
    to,
    pieceId: piece.id,
    kind: getMovementKind(piece),
    side: piece.side,
    isCapture,
    capturedPieceId,
    isExtendedStep,
  }
}

function isPathClear(
  from: BoardCoord,
  to: BoardCoord,
  occupancy: Map<string, ChessPiece>,
): boolean {
  const df = Math.sign(to.file - from.file)
  const dr = Math.sign(to.rank - from.rank)
  let cursor: BoardCoord = { file: from.file + df, rank: from.rank + dr }

  while (cursor.file !== to.file || cursor.rank !== to.rank) {
    if (occupancy.has(coordKey(cursor))) return false
    cursor = { file: cursor.file + df, rank: cursor.rank + dr }
  }
  return true
}

function canPieceAttackSquare(attacker: ChessPiece, square: BoardCoord, allPieces: ChessPiece[]): boolean {
  const from = attacker.position
  const df = square.file - from.file
  const dr = square.rank - from.rank
  const kind = getMovementKind(attacker)

  if (kind === 'king') {
    return Math.abs(df) <= 1 && Math.abs(dr) <= 1 && (df !== 0 || dr !== 0)
  }

  if (kind === 'knight') {
    const af = Math.abs(df)
    const ar = Math.abs(dr)
    return (af === 2 && ar === 1) || (af === 1 && ar === 2)
  }

  if (kind === 'pawn') {
    const forward = attacker.side === 'player' ? 1 : -1
    return dr === forward && Math.abs(df) === 1
  }

  if (kind === 'rook' || kind === 'bishop' || kind === 'queen') {
    if (df === 0 && dr === 0) return false
    const isOrtho = df === 0 || dr === 0
    const isDiag = Math.abs(df) === Math.abs(dr)
    if (kind === 'rook' && !isOrtho) return false
    if (kind === 'bishop' && !isDiag) return false
    if (kind === 'queen' && !isOrtho && !isDiag) return false

    const stepFile = Math.sign(df)
    const stepRank = Math.sign(dr)
    let cursor: BoardCoord = { file: from.file + stepFile, rank: from.rank + stepRank }
    const occupancy = buildOccupancy(allPieces)

    while (cursor.file !== square.file || cursor.rank !== square.rank) {
      if (occupancy.has(coordKey(cursor))) return false
      cursor = { file: cursor.file + stepFile, rank: cursor.rank + stepRank }
    }
    return true
  }

  return false
}

/**
 * Returns true if `square` is attacked by any enemy of `defenderSide`.
 * Supports full roster move patterns (GDD §1.7).
 */
export function isSquareAttacked(
  square: BoardCoord,
  allPieces: ChessPiece[],
  defenderSide: ChessPiece['side'],
): boolean {
  const enemySide = defenderSide === 'player' ? 'enemy' : 'player'

  for (const piece of allPieces) {
    if (piece.side !== enemySide) continue
    if (canPieceAttackSquare(piece, square, allPieces)) return true
  }

  return false
}

function pushSlideMoves(
  piece: ChessPiece,
  directions: BoardCoord[],
  occupancy: Map<string, ChessPiece>,
  moves: BoardMove[],
): void {
  for (const dir of directions) {
    let cursor = addOffset(piece.position, dir)
    while (isInBounds(cursor)) {
      const target = getPieceAt(occupancy, cursor)
      if (target?.side === piece.side) break

      const isCapture = target !== undefined && target.side !== piece.side
      moves.push(createMove(piece, cursor, isCapture, isCapture ? target?.id : undefined, false))

      if (target) break
      cursor = addOffset(cursor, dir)
    }
  }
}

/**
 * King movement — 1 square normally; Royal Decree adds a 2nd slide along the same ray.
 * Two-step moves require a clear intermediate square (queen slide, no jumping).
 */
function generateKingMoves(piece: ChessPiece, ctx: MoveContext): BoardMove[] {
  const moves: BoardMove[] = []
  const occupancy = buildOccupancy(ctx.allPieces)
  const allowDecreeSlide = piece.kind === 'king' && ctx.decreeStepEnabled

  for (const dir of KING_DIRECTIONS) {
    const oneStep = addOffset(piece.position, dir)
    if (!isInBounds(oneStep)) continue

    const blockerOne = getPieceAt(occupancy, oneStep)
    if (blockerOne?.side === piece.side) continue

    const captureOne = blockerOne !== undefined && blockerOne.side !== piece.side
    if (!captureOne && isSquareAttacked(oneStep, ctx.allPieces, piece.side)) {
      continue
    }

    moves.push(createMove(piece, oneStep, captureOne, captureOne ? blockerOne?.id : undefined, false))

    if (blockerOne) continue
    if (!allowDecreeSlide) continue

    const twoStep = addOffset(oneStep, dir)
    if (!isInBounds(twoStep)) continue
    if (!isPathClear(piece.position, twoStep, occupancy)) continue

    const blockerTwo = getPieceAt(occupancy, twoStep)
    if (blockerTwo?.side === piece.side) continue

    const captureTwo = blockerTwo !== undefined && blockerTwo.side !== piece.side
    if (!captureTwo && isSquareAttacked(twoStep, ctx.allPieces, piece.side)) {
      continue
    }

    moves.push(
      createMove(piece, twoStep, captureTwo, captureTwo ? blockerTwo?.id : undefined, true),
    )
  }

  return moves
}

function generateKnightMoves(piece: ChessPiece, ctx: MoveContext): BoardMove[] {
  const moves: BoardMove[] = []
  const occupancy = buildOccupancy(ctx.allPieces)

  for (const offset of KNIGHT_OFFSETS) {
    const to = addOffset(piece.position, offset)
    if (!isInBounds(to)) continue

    const target = getPieceAt(occupancy, to)
    if (target?.side === piece.side) continue

    const isCapture = target !== undefined && target.side !== piece.side
    moves.push(createMove(piece, to, isCapture, isCapture ? target?.id : undefined, false))
  }

  return moves
}

function generateSlidingMoves(piece: ChessPiece, ctx: MoveContext, kind: 'rook' | 'bishop' | 'queen'): BoardMove[] {
  const moves: BoardMove[] = []
  const occupancy = buildOccupancy(ctx.allPieces)
  const dirs =
    kind === 'rook' ? ORTHOGONAL_DIRS : kind === 'bishop' ? DIAGONAL_DIRS : [...ORTHOGONAL_DIRS, ...DIAGONAL_DIRS]
  pushSlideMoves(piece, dirs, occupancy, moves)
  return moves
}

function generatePawnMoves(piece: ChessPiece, ctx: MoveContext): BoardMove[] {
  const moves: BoardMove[] = []
  const occupancy = buildOccupancy(ctx.allPieces)
  const forward = piece.side === 'player' ? 1 : -1
  const startRank = piece.side === 'player' ? 1 : 6

  const oneForward: BoardCoord = {
    file: piece.position.file,
    rank: piece.position.rank + forward,
  }

  if (isInBounds(oneForward) && !getPieceAt(occupancy, oneForward)) {
    moves.push(createMove(piece, oneForward, false, undefined, false))

    const twoForward: BoardCoord = {
      file: piece.position.file,
      rank: piece.position.rank + forward * 2,
    }
    if (
      piece.position.rank === startRank &&
      isInBounds(twoForward) &&
      !getPieceAt(occupancy, twoForward)
    ) {
      moves.push(createMove(piece, twoForward, false, undefined, true))
    }
  } else if (isInBounds(oneForward)) {
    const blocker = getPieceAt(occupancy, oneForward)
    // Idle combat: head-on pawn clash when blocked on the same file (GDD pacing).
    if (blocker && blocker.side !== piece.side && blocker.kind === 'pawn') {
      moves.push(createMove(piece, oneForward, true, blocker.id, false))
    }
  }

  for (const df of [-1, 1]) {
    const captureSquare: BoardCoord = {
      file: piece.position.file + df,
      rank: piece.position.rank + forward,
    }
    if (!isInBounds(captureSquare)) continue
    const target = getPieceAt(occupancy, captureSquare)
    if (target && target.side !== piece.side) {
      moves.push(createMove(piece, captureSquare, true, target.id, false))
    }
  }

  return moves
}

/** Generates pseudo-legal moves for the piece's effective movement kind. */
export function generateLegalMoves(piece: ChessPiece, ctx: MoveContext): BoardMove[] {
  const kind = getMovementKind(piece)

  switch (kind) {
    case 'king':
      return generateKingMoves(piece, ctx)
    case 'pawn':
      return generatePawnMoves(piece, ctx)
    case 'knight':
      return generateKnightMoves(piece, ctx)
    case 'bishop':
      return generateSlidingMoves(piece, ctx, 'bishop')
    case 'rook':
      return generateSlidingMoves(piece, ctx, 'rook')
    case 'queen':
      return generateSlidingMoves(piece, ctx, 'queen')
    default:
      return []
  }
}

/** Applies a move to piece arrays — returns updated player/enemy lists. */
export function applyBoardMove(
  move: BoardMove,
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
): { playerPieces: ChessPiece[]; enemyPieces: ChessPiece[]; capturedId?: string } {
  const updateSide = (pieces: ChessPiece[]): ChessPiece[] =>
    pieces.map((piece) =>
      piece.id === move.pieceId ? { ...piece, position: { ...move.to } } : piece,
    )

  let nextPlayer = playerPieces
  let nextEnemy = enemyPieces

  if (move.side === 'player') {
    nextPlayer = updateSide(playerPieces)
    if (move.isCapture && move.capturedPieceId) {
      nextEnemy = enemyPieces.filter((piece) => piece.id !== move.capturedPieceId)
    }
  } else {
    nextEnemy = updateSide(enemyPieces)
    if (move.isCapture && move.capturedPieceId) {
      nextPlayer = playerPieces.filter((piece) => piece.id !== move.capturedPieceId)
    }
  }

  return {
    playerPieces: nextPlayer,
    enemyPieces: nextEnemy,
    capturedId: move.isCapture ? move.capturedPieceId : undefined,
  }
}
