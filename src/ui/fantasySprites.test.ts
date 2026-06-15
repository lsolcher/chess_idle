import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  getSpriteBackgroundPosition,
  getLevelGlowStyle,
  resolvePieceDisplayLevel,
  sideToFantasyTeam,
  spriteFrameId,
  SPRITE_CELL_WIDTH,
} from './fantasySprites'

describe('fantasySprites', () => {
  it('maps player to elf and enemy to dwarf', () => {
    expect(sideToFantasyTeam('player')).toBe('elf')
    expect(sideToFantasyTeam('enemy')).toBe('dwarf')
  })

  it('positions king at origin for elf row', () => {
    const pos = getSpriteBackgroundPosition('king', 'elf')
    expect(pos.backgroundPosition).toBe('0px 0px')
  })

  it('offsets queen column by one cell', () => {
    const pos = getSpriteBackgroundPosition('queen', 'elf')
    expect(pos.backgroundPosition).toBe(`-${SPRITE_CELL_WIDTH}px 0px`)
  })

  it('offsets dwarf row by one cell height', () => {
    const pos = getSpriteBackgroundPosition('pawn', 'dwarf')
    expect(pos.backgroundPosition).toBe(`-${SPRITE_CELL_WIDTH * 5}px -64px`)
  })

  it('intensifies glow with level', () => {
    const blurPx = (filter: string) => Number(filter.match(/drop-shadow\([^)]+\s+(\d+(?:\.\d+)?)px/)?.[1] ?? 0)
    const low = getLevelGlowStyle(1, 'elf')
    const high = getLevelGlowStyle(10, 'elf')
    expect(blurPx(high.filter)).toBeGreaterThan(blurPx(low.filter))
  })

  it('derives display level from upgrade peak', () => {
    const pawn = createPiece('p', 'pawn', 'player', { file: 0, rank: 0 })
    pawn.upgradeLevels = { ap: 3, hp: 2, def: 1, initiative: 0 }
    expect(resolvePieceDisplayLevel(pawn)).toBe(3)
  })

  it('uses chess-silhouette frame ids', () => {
    expect(spriteFrameId('rook', 'dwarf')).toBe('chess-silhouette-rook-dwarf-v1')
  })
})
