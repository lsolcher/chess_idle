import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import { algebraicLabel, buildOccupancy, coordKey, isInBounds } from './board'

describe('board utilities', () => {
  it('maps coords to algebraic labels', () => {
    expect(algebraicLabel({ file: 0, rank: 0 })).toBe('a1')
    expect(algebraicLabel({ file: 4, rank: 4 })).toBe('e5')
  })

  it('builds occupancy map', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const map = buildOccupancy([king])
    expect(map.get(coordKey({ file: 4, rank: 0 }))?.id).toBe('k')
  })

  it('prefers player piece when two rosters share a coordinate', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 7 })
    const boss = createPiece('e', 'king', 'enemy', { file: 4, rank: 7 })
    const map = buildOccupancy([boss, king])
    expect(map.get(coordKey({ file: 4, rank: 7 }))?.side).toBe('player')
  })

  it('validates bounds', () => {
    expect(isInBounds({ file: 0, rank: 0 })).toBe(true)
    expect(isInBounds({ file: 8, rank: 0 })).toBe(false)
  })
})
