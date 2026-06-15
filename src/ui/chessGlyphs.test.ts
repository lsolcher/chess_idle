import { describe, expect, it } from 'vitest'
import { chessGlyph, chessGlyphForPiece } from '@/ui/chessGlyphs'
import type { ChessPiece } from '@/types/game'

function piece(partial: Partial<ChessPiece> & Pick<ChessPiece, 'kind' | 'side'>): ChessPiece {
  return {
    id: 'p1',
    position: { file: 0, rank: 0 },
    stats: { hp: 10, maxHp: 10, ap: 1, def: 0 },
    initiative: { progress: 0, baseIntervalSec: 1 },
    upgradeLevels: { ap: 0, hp: 0, def: 0 },
    ...partial,
  }
}

describe('chessGlyphs', () => {
  it('uses standard white/black sets', () => {
    expect(chessGlyph('rook', 'player')).toBe('♖')
    expect(chessGlyph('rook', 'enemy')).toBe('♜')
    expect(chessGlyph('king', 'enemy')).toBe('♚')
  })

  it('maps super promotions to promoted piece symbols', () => {
    const promoted = piece({
      kind: 'pawn',
      side: 'player',
      superPromotion: { form: 'super-queen', wave: 1 },
    })
    expect(chessGlyphForPiece(promoted)).toBe('♛')
  })
})
