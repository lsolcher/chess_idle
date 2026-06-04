import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import { generateLegalMoves } from './moves'
import { getMovementKind } from './pieceMovement'

describe('pieceMovement', () => {
  it('maps super-forms to standard movement kinds', () => {
    const pawn = createPiece('p', 'pawn', 'player', { file: 4, rank: 4 })
    pawn.superPromotion = {
      form: 'super-queen',
      sourcePawnId: pawn.id,
      apMult: 3.5,
      hpMult: 2.5,
      traits: {},
    }
    expect(getMovementKind(pawn)).toBe('queen')
    const moves = generateLegalMoves(pawn, { allPieces: [pawn], decreeStepEnabled: false })
    expect(moves.length).toBeGreaterThan(10)
  })
})
