import { describe, expect, it } from 'vitest'
import {
  ARENA_POINT_CAP,
  canSaveArenaLoadout,
  deployPieceAt,
  mergeDeployedWithRoster,
} from '@/engine/arenaLoadout'
import { calculatePvPValue } from '@/engine/pvpMath'
import { createPiece } from '@/types/game'

describe('arenaLoadout', () => {
  it('updates point total when a piece is deployed', () => {
    const king = createPiece('k1', 'king', 'player', { file: 4, rank: 0 })
    const knight = createPiece('n1', 'knight', 'player', { file: 1, rank: 0 })
    knight.upgradeLevels.ap = 3

    const placed = deployPieceAt([], knight, { file: 2, rank: 1 })
    expect(placed).not.toBeNull()
    expect(calculatePvPValue(knight)).toBeGreaterThan(calculatePvPValue(createPiece('n0', 'knight', 'player', { file: 0, rank: 0 })))

    const withKing = deployPieceAt(placed!, king, { file: 4, rank: 0 })
    expect(withKing).toHaveLength(2)
    expect(canSaveArenaLoadout(withKing!, ARENA_POINT_CAP)).toBe(true)
  })

  it('reflects roster upgrade changes via mergeDeployedWithRoster', () => {
    const king = createPiece('k1', 'king', 'player', { file: 4, rank: 0 })
    const deployed = [king]
    const upgradedKing = {
      ...king,
      upgradeLevels: { ...king.upgradeLevels, ap: 5 },
      stats: { ...king.stats, ap: king.stats.ap + 20 },
    }
    const merged = mergeDeployedWithRoster(deployed, [upgradedKing])
    expect(merged[0]!.upgradeLevels.ap).toBe(5)
    expect(merged[0]!.stats.ap).toBe(upgradedKing.stats.ap)
  })
})
