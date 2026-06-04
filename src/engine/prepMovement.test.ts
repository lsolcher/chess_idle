import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import { generatePrepRepositionMoves } from './prepMovement'

describe('prepMovement', () => {
  it('king may only reposition along rank 0', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const moves = generatePrepRepositionMoves(king, [king], [])
    expect(moves.every((m) => m.to.rank === 0)).toBe(true)
    expect(moves.some((m) => m.to.file === 3)).toBe(true)
  })

  it('pawn may use ranks 0 and 1', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('p', 'pawn', 'player', { file: 0, rank: 1 })
    const moves = generatePrepRepositionMoves(pawn, [king, pawn], [])
    expect(moves.some((m) => m.to.rank === 0 && m.to.file === 2)).toBe(true)
    expect(moves.some((m) => m.to.rank === 1 && m.to.file === 2)).toBe(true)
    expect(moves.some((m) => m.to.file === 4 && m.to.rank === 0)).toBe(false)
  })
})
