import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  algebraicLabel,
  buildOccupancy,
  coordKey,
  findBoardPositionCollisions,
  isInBounds,
  reconcileUniqueBoardPositions,
} from './board'

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

  it('detects duplicate coordinates across rosters', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('p', 'pawn', 'enemy', { file: 4, rank: 0 })
    const collisions = findBoardPositionCollisions([king], [pawn])
    expect(collisions).toHaveLength(1)
    expect(collisions[0]!.pieces).toHaveLength(2)
  })

  it('reconcileUniqueBoardPositions separates stacked pieces', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('p', 'pawn', 'enemy', { file: 4, rank: 0 })
    const fixed = reconcileUniqueBoardPositions([king], [pawn])
    const keys = new Set(
      [...fixed.playerPieces, ...fixed.enemyPieces].map((piece) => coordKey(piece.position)),
    )
    expect(keys.size).toBe(2)
    expect(fixed.playerPieces.find((p) => p.id === 'k')?.position).toEqual({ file: 4, rank: 0 })
    expect(fixed.enemyPieces.find((p) => p.id === 'p')?.position).not.toEqual({ file: 4, rank: 0 })
  })
})
