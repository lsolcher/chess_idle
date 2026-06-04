import { describe, expect, it } from 'vitest'
import { applySuperPromotion } from '@/engine/promotion'
import { createPiece } from '@/types/game'
import {
  getKingFailReason,
  isWaveFailed,
  persistArmyPromotionsBetweenStages,
  relocateArmyToPrepRanks,
  restorePlayerKingForPrep,
} from './waveState'

describe('waveState king fail', () => {
  it('detects missing or defeated King', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    expect(getKingFailReason([king])).toBeNull()
    expect(isWaveFailed([king])).toBe(false)

    expect(getKingFailReason([])).toBe('missing')
    expect(isWaveFailed([])).toBe(true)

    const wounded = {
      ...king,
      stats: { ...king.stats, hp: 0 },
    }
    expect(getKingFailReason([wounded])).toBe('defeated')
  })

  it('restores deploy-rank King with full HP after capture', () => {
    const pawn = createPiece('p1', 'pawn', 'player', { file: 3, rank: 1 })
    const restored = restorePlayerKingForPrep([pawn], 0, 1)
    const king = restored.find((p) => p.kind === 'king')!
    expect(king.position).toEqual({ file: 4, rank: 0 })
    expect(king.stats.hp).toBe(king.stats.maxHp)
    expect(restored).toHaveLength(2)
  })
})

describe('waveState army persistence', () => {
  it('keeps super-promotion overlay and applies carry increment', () => {
    let pawn = createPiece('p1', 'pawn', 'player', { file: 4, rank: 7 })
    pawn = applySuperPromotion(pawn, 'super-queen', 0)
    const apBefore = pawn.stats.ap

    const [next] = persistArmyPromotionsBetweenStages([pawn], {
      p1: { apBonus: 3, hpBonus: 5, fromForm: 'super-queen' },
    })

    expect(next?.superPromotion?.form).toBe('super-queen')
    expect(next?.stats.ap).toBe(apBefore + 3)
    expect(next?.promotionHold).toBe(false)
  })

  it('relocates super-promoted pawn from back rank to deploy ranks', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    let pawn = createPiece('p1', 'pawn', 'player', { file: 3, rank: 7 })
    pawn = applySuperPromotion(pawn, 'super-queen', 0)

    const relocated = relocateArmyToPrepRanks([king, pawn], [])
    const queenPawn = relocated.find((p) => p.id === 'p1')!

    expect(queenPawn.position.rank).toBeLessThanOrEqual(1)
    expect(queenPawn.superPromotion?.form).toBe('super-queen')
  })
})
