/**
 * Chess Dojo training match setup and outcome checks (Phase 9.5).
 */
import type { Board } from '@/engine/chessDojo'
import { resolveAiSide } from '@/engine/chessDojo'
import { createPiece, type PieceSide } from '@/types/game'

export type DojoMatchOutcome = 'player-win' | 'ai-win' | null

export function createTrainingBoard(): Board {
  const pieces = [
    createPiece('dojo-pk', 'king', 'player', { file: 4, rank: 0 }),
    createPiece('dojo-pq', 'queen', 'player', { file: 3, rank: 0 }),
    createPiece('dojo-pr', 'rook', 'player', { file: 0, rank: 0 }),
    createPiece('dojo-pb', 'bishop', 'player', { file: 2, rank: 0 }),
    createPiece('dojo-pn', 'knight', 'player', { file: 6, rank: 0 }),
    createPiece('dojo-ek', 'king', 'enemy', { file: 4, rank: 7 }),
    createPiece('dojo-eq', 'queen', 'enemy', { file: 3, rank: 7 }),
    createPiece('dojo-er', 'rook', 'enemy', { file: 7, rank: 7 }),
    createPiece('dojo-eb', 'bishop', 'enemy', { file: 5, rank: 7 }),
    createPiece('dojo-en', 'knight', 'enemy', { file: 1, rank: 7 }),
  ]

  return {
    pieces,
    sideToMove: 'player',
    aiSide: 'enemy',
    decreeStepEnabled: false,
    royalDecreeActive: false,
    personality: 'defensive',
  }
}

function sideHasKing(board: Board, side: PieceSide): boolean {
  return board.pieces.some(
    (piece) => piece.side === side && piece.kind === 'king' && piece.stats.hp > 0,
  )
}

export function checkDojoOutcome(board: Board): DojoMatchOutcome {
  const aiSide = resolveAiSide(board)
  const playerSide: PieceSide = aiSide === 'enemy' ? 'player' : 'enemy'
  if (!sideHasKing(board, playerSide)) return 'ai-win'
  if (!sideHasKing(board, aiSide)) return 'player-win'
  return null
}
