import { describe, expect, it } from 'vitest'
import { applyDojoMove } from '@/engine/chessDojo'
import { checkDojoOutcome, createTrainingBoard } from '@/engine/dojoSession'
import { createPiece } from '@/types/game'

describe('dojoSession', () => {
  it('starts with both kings and no outcome', () => {
    const board = createTrainingBoard()
    expect(checkDojoOutcome(board)).toBeNull()
  })

  it('detects player win when enemy king is captured', () => {
    const board = createTrainingBoard()
    const capture = {
      pieceId: 'dojo-pq',
      from: { file: 3, rank: 0 },
      to: { file: 4, rank: 7 },
      isCapture: true,
      capturedPieceId: 'dojo-ek',
    }
    const next = applyDojoMove(board, capture)
    expect(checkDojoOutcome(next)).toBe('player-win')
  })

  it('detects ai win when player king is removed', () => {
    const board = {
      ...createTrainingBoard(),
      pieces: [createPiece('solo-ek', 'king', 'enemy', { file: 4, rank: 7 })],
    }
    expect(checkDojoOutcome(board)).toBe('ai-win')
  })
})
