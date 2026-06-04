import { describe, expect, it } from 'vitest'

import {
  applySuperPromotionWithCarry,
  computeSuperPromotionMarginalBonus,
  getEnPassantCarryPercent,
  snapshotEnPassantCarry,
  stripStageScopedPromotions,
} from '@/engine/enPassantEconomy'
import { applySuperPromotion } from '@/engine/promotion'
import { createPiece } from '@/types/game'

describe('enPassantEconomy', () => {
  it('scales carry percent by meta rank', () => {
    expect(getEnPassantCarryPercent(0)).toBe(0)
    expect(getEnPassantCarryPercent(2)).toBe(0.5)
    expect(getEnPassantCarryPercent(5)).toBe(1.25)
  })

  it('snapshots carry from super-promoted pawn', () => {
    let pawn = createPiece('p1', 'pawn', 'player', { file: 0, rank: 7 })
    pawn = applySuperPromotion(pawn, 'super-knight', 0)
    const map = snapshotEnPassantCarry([pawn], 0.25, {})
    expect(map.p1?.apBonus).toBeGreaterThan(0)
    expect(map.p1?.hpBonus).toBeGreaterThan(0)
  })

  it('applies carry on next promotion', () => {
    const pawn = createPiece('p2', 'pawn', 'player', { file: 1, rank: 7 })
    const withCarry = applySuperPromotionWithCarry(pawn, 'super-bishop', 0, {
      apBonus: 5,
      hpBonus: 10,
    })
    expect(withCarry.stats.ap).toBeGreaterThan(pawn.stats.ap)
    expect(withCarry.stats.maxHp).toBeGreaterThan(pawn.stats.maxHp)
  })

  it('strip helper still removes overlay for prestige-style resets', () => {
    let pawn = createPiece('p3', 'pawn', 'player', { file: 2, rank: 7 })
    pawn = applySuperPromotion(pawn, 'super-rook', 0)
    const stripped = stripStageScopedPromotions([pawn])[0]!
    expect(stripped.superPromotion).toBeUndefined()
    expect(computeSuperPromotionMarginalBonus(stripped)).toBeNull()
  })
})
