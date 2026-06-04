import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  applySuperPromotion,
  calculatePromotionFanfareGold,
  getAvailablePromotionForms,
  getPromotionStreakGoldMult,
  projectSuperStats,
  resolvePromotionForPiece,
  runPromotionEngineSanityCheck,
  selectAutoPromotionForm,
} from './promotion'

describe('promotion engine', () => {
  it('applies super stat multipliers with mastery bonus', () => {
    const pawn = createPiece('p', 'pawn', 'player', { file: 4, rank: 6 })
    const superPiece = applySuperPromotion(pawn, 'super-knight', 2)
    const projected = projectSuperStats(pawn, 'super-knight', 2)

    expect(superPiece.stats.ap).toBeCloseTo(projected.ap, 5)
    expect(superPiece.stats.maxHp).toBeCloseTo(projected.maxHp, 5)
    expect(superPiece.superPromotion?.form).toBe('super-knight')
  })

  it('promotes automatically on back rank in auto mode', () => {
    const pawn = createPiece('p', 'pawn', 'player', { file: 4, rank: 7 })
    const result = resolvePromotionForPiece(
      pawn,
      { stage: 10, masteryLevel: 0, activeMult: 1.5, royalDecreeActive: false, autoMode: true },
      [],
    )

    expect(result.promoted).toBe(true)
    expect(result.fanfareGold).toBeGreaterThan(0)
  })

  it('defers promotion on block squares until hold completes', () => {
    const pawn = createPiece('p', 'pawn', 'player', { file: 4, rank: 7 })
    const deferred = resolvePromotionForPiece(
      pawn,
      { stage: 15, masteryLevel: 0, activeMult: 1, royalDecreeActive: false, autoMode: true },
      [],
    )

    expect(deferred.deferred).toBe(true)
    expect(deferred.piece.promotionHold).toBe(true)

    const held = { ...deferred.piece, promotionHold: true }
    const promoted = resolvePromotionForPiece(
      held,
      { stage: 15, masteryLevel: 0, activeMult: 1, royalDecreeActive: false, autoMode: true },
      [],
    )
    expect(promoted.promoted).toBe(true)
  })

  it('locks super-queen until stage 45', () => {
    expect(getAvailablePromotionForms(20)).not.toContain('super-queen')
    expect(getAvailablePromotionForms(45)).toContain('super-queen')
  })

  it('scales streak gold up to 25% at cap 5', () => {
    expect(getPromotionStreakGoldMult(0)).toBe(1)
    expect(getPromotionStreakGoldMult(5)).toBe(1.25)
    expect(getPromotionStreakGoldMult(10)).toBe(1.25)
  })

  it('prefers super-queen when unlocked and respects carry hint', () => {
    const pawn = createPiece('p', 'pawn', 'player', { file: 4, rank: 7 })
    const queenPick = selectAutoPromotionForm(
      pawn,
      ['super-knight', 'super-queen', 'super-rook'],
      Array.from({ length: 5 }, (_, i) =>
        createPiece(`e${i}`, 'pawn', 'enemy', { file: i % 8, rank: 6 }),
      ),
      0,
    )
    expect(queenPick).toBe('super-queen')

    const hinted = selectAutoPromotionForm(
      pawn,
      ['super-knight', 'super-bishop'],
      [],
      0,
      'super-bishop',
    )
    expect(hinted).toBe('super-bishop')
  })

  it('passes headless sanity check', () => {
    expect(runPromotionEngineSanityCheck().passed).toBe(true)
  })
})

describe('super-piece stat scaling matrix', () => {
  it('documents AP/HP at mastery 0 and 5 for base pawn (AP 6, HP 30)', () => {
    const pawn = createPiece('p', 'pawn', 'player', { file: 0, rank: 0 })
    const forms = ['super-knight', 'super-bishop', 'super-rook', 'super-queen'] as const

    const rows = forms.map((form) => {
      const m0 = projectSuperStats(pawn, form, 0)
      const m5 = projectSuperStats(pawn, form, 5)
      return { form, ap0: m0.ap, hp0: m0.maxHp, ap5: m5.ap, hp5: m5.maxHp }
    })

    expect(rows[0]?.ap0).toBeCloseTo(15, 1)
    expect(rows[3]?.ap0).toBeCloseTo(21, 1)
    expect(rows[3]?.ap5).toBeCloseTo(21 * 1.5, 1)
  })

  it('fanfare equals 3× pawn capture gold at stage 1', () => {
    const fanfare = calculatePromotionFanfareGold({
      stage: 1,
      masteryLevel: 0,
      activeMult: 1.5,
      royalDecreeActive: false,
      autoMode: true,
    })
    expect(fanfare).toBeCloseTo(5 * 1.5 * 3, 1)
  })
})
