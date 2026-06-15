import { describe, expect, it } from 'vitest'
import {
  CHESS_PIECE_RENDER_MODE,
  CHESS_SILHOUETTE_REQUIREMENT,
  distinctChessGlyphsByKind,
  isChessSilhouetteRecognizable,
} from '@/ui/chessIdentity'

describe('chessIdentity', () => {
  it('uses Unicode glyphs until fantasy sprite sheet ships', () => {
    expect(CHESS_PIECE_RENDER_MODE).toBe('glyph')
  })

  it('documents a silhouette requirement for every piece kind', () => {
    const kinds = Object.keys(CHESS_SILHOUETTE_REQUIREMENT) as (keyof typeof CHESS_SILHOUETTE_REQUIREMENT)[]
    expect(kinds).toHaveLength(6)
    for (const kind of kinds) {
      expect(CHESS_SILHOUETTE_REQUIREMENT[kind].length).toBeGreaterThan(10)
    }
  })

  it('uses six distinct chess symbols across kinds', () => {
    const glyphs = Object.values(distinctChessGlyphsByKind())
    expect(new Set(glyphs).size).toBe(6)
    expect(glyphs).toContain('♖')
    expect(glyphs).toContain('♘')
    expect(glyphs).toContain('♗')
  })

  it('rejects fantasy-only sprite ids without chess-silhouette prefix', () => {
    expect(isChessSilhouetteRecognizable('rook', 'dwarf-warrior')).toBe(false)
    expect(isChessSilhouetteRecognizable('rook', 'chess-silhouette-rook-elf-v1')).toBe(true)
  })
})
