/**
 * Chess Dojo — traditional training matches on the shared move generator (Phase 9.5).
 * Uses `aiHeuristic` for Medium/Hard; Easy samples from the top three scored moves.
 */
import {
  scoreAllMoves,
  scoreMove,
  type AiScoreContext,
  type ScoredMove,
} from '@/engine/aiHeuristic'
import type { BoardMove } from '@/engine/moves'
import type { AutoAiPersonality, ChessPiece, PieceSide } from '@/types/game'

export type DojoDifficulty = 'easy' | 'medium' | 'hard'

/** Dojo board snapshot — one side to move per ply. */
export interface Board {
  pieces: ChessPiece[]
  sideToMove: PieceSide
  /** Side the Dojo AI controls (default enemy). */
  aiSide?: PieceSide
  decreeStepEnabled?: boolean
  royalDecreeActive?: boolean
  personality?: AutoAiPersonality
}

export interface DojoMoveCandidate {
  piece: ChessPiece
  move: BoardMove
  score: number
}

const DEFAULT_PERSONALITY: AutoAiPersonality = 'defensive'

import { DOJO_HARD_LOOKAHEAD_PLIES } from '@/engine/balanceConstants'

/** Base minimax plies for Hard (AI move + opponent reply, then evaluate). */
export const HARD_LOOKAHEAD_PLIES = DOJO_HARD_LOOKAHEAD_PLIES

export function opponentSide(side: PieceSide): PieceSide {
  return side === 'player' ? 'enemy' : 'player'
}

export function resolveAiSide(board: Board): PieceSide {
  return board.aiSide ?? 'enemy'
}

function buildAiContext(board: Board, movingPiece: ChessPiece): AiScoreContext {
  return {
    allPieces: board.pieces,
    decreeStepEnabled: board.decreeStepEnabled ?? false,
    royalDecreeActive: board.royalDecreeActive ?? false,
    personality: board.personality ?? DEFAULT_PERSONALITY,
    movingPiece: movingPiece,
    combatMode: 'wave',
  }
}

/** Lists every legal move for the side to move. */
export function enumerateMovesForSide(
  board: Board,
  side: PieceSide = board.sideToMove,
): DojoMoveCandidate[] {
  const ctxBase: Omit<AiScoreContext, 'movingPiece'> = {
    allPieces: board.pieces,
    decreeStepEnabled: board.decreeStepEnabled ?? false,
    royalDecreeActive: board.royalDecreeActive ?? false,
    personality: board.personality ?? DEFAULT_PERSONALITY,
    combatMode: 'wave',
  }

  const candidates: DojoMoveCandidate[] = []

  for (const piece of board.pieces) {
    if (piece.side !== side || piece.stats.hp <= 0) continue
    const ctx: AiScoreContext = { ...ctxBase, movingPiece: piece }
    const ranked = scoreAllMoves(piece, ctx)
    for (const entry of ranked) {
      candidates.push({ piece, move: entry.move, score: entry.score })
    }
  }

  return candidates.sort((a, b) => b.score - a.score)
}

/** Heuristic score for a candidate move from the current board. */
export function scoreDojoMove(board: Board, move: BoardMove): number {
  const piece = board.pieces.find((p) => p.id === move.pieceId)
  if (!piece) return 0
  return scoreMove(move, buildAiContext(board, piece))
}

/**
 * Applies a move for Dojo simulation — instant capture removal, no HP chip logic.
 */
export function applyDojoMove(board: Board, move: BoardMove): Board {
  let pieces = board.pieces.map((piece) => ({ ...piece, position: { ...piece.position } }))

  if (move.isCapture && move.capturedPieceId) {
    pieces = pieces.filter((piece) => piece.id !== move.capturedPieceId)
  }

  pieces = pieces.map((piece) =>
    piece.id === move.pieceId ? { ...piece, position: { ...move.to } } : piece,
  )

  return {
    ...board,
    pieces,
    sideToMove: opponentSide(board.sideToMove),
  }
}

function materialBalance(board: Board, perspective: PieceSide): number {
  let score = 0
  for (const piece of board.pieces) {
    if (piece.stats.hp <= 0) continue
    const value =
      piece.kind === 'pawn'
        ? 1
        : piece.kind === 'knight' || piece.kind === 'bishop'
          ? 3
          : piece.kind === 'rook'
            ? 5
            : piece.kind === 'queen'
              ? 9
              : 0
    if (piece.side === perspective) score += value
    else score -= value
  }
  return score
}

/** Static evaluation from the AI side's perspective (centipawn-style scale). */
export function evaluateDojoPosition(board: Board, aiSide: PieceSide): number {
  const playerSide = opponentSide(aiSide)
  let score = materialBalance(board, aiSide) * 100

  const aiKing = board.pieces.find((p) => p.side === aiSide && p.kind === 'king')
  const playerKing = board.pieces.find((p) => p.side === playerSide && p.kind === 'king')
  if (!aiKing) score -= 5000
  if (!playerKing) score += 5000

  if (board.sideToMove === aiSide) {
    const top = enumerateMovesForSide(board, aiSide)[0]
    if (top) score += top.score * 0.15
  }

  return score
}

function pickRandomTopMove(ranked: ScoredMove[]): BoardMove | null {
  if (ranked.length === 0) return null
  const pool = ranked.slice(0, Math.min(3, ranked.length))
  const index = Math.floor(Math.random() * pool.length)
  return pool[index]!.move
}

function pickEasyMove(board: Board): BoardMove | null {
  const aiSide = resolveAiSide(board)
  if (board.sideToMove !== aiSide) return null

  const ranked: ScoredMove[] = enumerateMovesForSide(board, aiSide).map((entry) => ({
    move: entry.move,
    score: entry.score,
  }))
  return pickRandomTopMove(ranked)
}

function pickMediumMove(board: Board): BoardMove | null {
  const aiSide = resolveAiSide(board)
  if (board.sideToMove !== aiSide) return null
  return enumerateMovesForSide(board, aiSide)[0]?.move ?? null
}

function pickHardMove(board: Board, searchPlies: number): BoardMove | null {
  const aiSide = resolveAiSide(board)
  if (board.sideToMove !== aiSide) return null

  const aiMoves = enumerateMovesForSide(board, aiSide)
  if (aiMoves.length === 0) return null

  const playerSide = opponentSide(aiSide)
  let bestMove: BoardMove | null = null
  let bestScore = -Infinity

  for (const candidate of aiMoves) {
    const afterAi = applyDojoMove(board, candidate.move)
    let lineScore: number

    if (searchPlies <= 1) {
      lineScore = evaluateDojoPosition(afterAi, aiSide)
    } else {
      const replies = enumerateMovesForSide(afterAi, playerSide)
      if (replies.length === 0) {
        lineScore = evaluateDojoPosition(afterAi, aiSide)
      } else {
        let worstReply = Infinity
        for (const reply of replies) {
          const afterReply = applyDojoMove(afterAi, reply.move)
          const leaf =
            searchPlies > 2
              ? minimax(afterReply, searchPlies - 2, true, aiSide)
              : evaluateDojoPosition(afterReply, aiSide)
          worstReply = Math.min(worstReply, leaf)
        }
        lineScore = worstReply
      }
    }

    if (lineScore > bestScore) {
      bestScore = lineScore
      bestMove = candidate.move
    }
  }

  return bestMove
}

function minimax(
  board: Board,
  depth: number,
  maximizing: boolean,
  aiSide: PieceSide,
): number {
  if (depth <= 0) {
    return evaluateDojoPosition(board, aiSide)
  }

  const side = maximizing ? aiSide : opponentSide(aiSide)
  const moves = enumerateMovesForSide(board, side)
  if (moves.length === 0) {
    return evaluateDojoPosition(board, aiSide)
  }

  if (maximizing) {
    return Math.max(
      ...moves.map((entry) =>
        minimax(applyDojoMove(board, entry.move), depth - 1, false, aiSide),
      ),
    )
  }

  return Math.min(
    ...moves.map((entry) =>
      minimax(applyDojoMove(board, entry.move), depth - 1, true, aiSide),
    ),
  )
}

/**
 * Selects an AI move for the Chess Dojo.
 * @param extraSearchPlies — bonus depth from meta (e.g. Deep Thought ranks).
 */
export function getAiMove(
  board: Board,
  difficulty: DojoDifficulty,
  options?: { extraSearchPlies?: number },
): BoardMove | null {
  const aiSide = resolveAiSide(board)
  if (board.sideToMove !== aiSide) return null

  switch (difficulty) {
    case 'easy':
      return pickEasyMove(board)
    case 'medium':
      return pickMediumMove(board)
    case 'hard':
      return pickHardMove(
        board,
        HARD_LOOKAHEAD_PLIES + Math.max(0, options?.extraSearchPlies ?? 0),
      )
    default:
      return null
  }
}

/** Returns legal moves for the side to move (utility for UI). */
export function getLegalMovesForBoard(board: Board): BoardMove[] {
  return enumerateMovesForSide(board, board.sideToMove).map((entry) => entry.move)
}

/** Clones pieces for a fresh Dojo session. */
export function cloneBoard(board: Board): Board {
  return {
    ...board,
    pieces: board.pieces.map((piece) => ({
      ...piece,
      position: { ...piece.position },
      stats: { ...piece.stats },
      upgradeLevels: { ...piece.upgradeLevels },
      initiative: { ...piece.initiative },
    })),
  }
}
