import { describe, expect, it } from 'vitest'

import {
  calculatePawnLeakDamage,
  findLeakingEnemyPawns,
  resolveEnemyPawnLeaks,
} from '@/engine/pawnLeak'
import { ENEMY_BACK_RANK } from '@/engine/board'
import { createPiece } from '@/types/game'

describe('pawnLeak', () => {
  it('detects enemy pawns on player back rank', () => {
    const pawn = createPiece('e', 'pawn', 'enemy', { file: 3, rank: ENEMY_BACK_RANK })
    expect(findLeakingEnemyPawns([pawn])).toHaveLength(1)
  })

  it('damages king and removes leaking pawn', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('e', 'pawn', 'enemy', { file: 3, rank: ENEMY_BACK_RANK })
    const result = resolveEnemyPawnLeaks([king], [pawn], 5)
    expect(result.leakedPawnIds).toEqual(['e'])
    expect(result.enemyPieces).toHaveLength(0)
    expect(result.totalDamage).toBeGreaterThanOrEqual(8)
    expect(result.playerPieces[0]?.stats.hp).toBeLessThan(king.stats.hp)
  })

  it('scales leak damage with stage', () => {
    const pawn = createPiece('p', 'pawn', 'enemy', { file: 0, rank: 6 })
    const low = calculatePawnLeakDamage(pawn, 1)
    const high = calculatePawnLeakDamage(pawn, 20)
    expect(high).toBeGreaterThan(low)
  })
})
