import { describe, expect, it } from 'vitest'
import { applySuperPromotion } from '@/engine/promotion'
import { createPiece } from '@/types/game'
import {
  getKingFailReason,
  healPlayerPiecesForPrep,
  isWaveFailed,
  persistArmyPromotionsBetweenStages,
  PREP_MISSING_HP_RECOVERY_BASE,
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

  it('keeps wounded King HP when returning to deploy rank', () => {
    const king = createPiece('k', 'king', 'player', { file: 2, rank: 3 })
    const wounded = {
      ...king,
      stats: { ...king.stats, maxHp: 50, hp: 20 },
    }
    const restored = restorePlayerKingForPrep([wounded], 0, 1)
    const next = restored.find((p) => p.kind === 'king')!
    expect(next.position).toEqual({ file: 4, rank: 0 })
    expect(next.stats.hp).toBe(20)
  })
})

describe('waveState prep heal', () => {
  it('restores 50% of missing HP by default', () => {
    const pawn = createPiece('p1', 'pawn', 'player', { file: 0, rank: 1 })
    const wounded = {
      ...pawn,
      stats: { ...pawn.stats, maxHp: 100, hp: 40 },
    }
    const [healed] = healPlayerPiecesForPrep([wounded])
    expect(PREP_MISSING_HP_RECOVERY_BASE).toBe(0.5)
    expect(healed?.stats.hp).toBe(70)
  })

  it('can fully heal when recovery fraction is 1', () => {
    const pawn = createPiece('p1', 'pawn', 'player', { file: 0, rank: 1 })
    const wounded = {
      ...pawn,
      stats: { ...pawn.stats, maxHp: 100, hp: 40 },
    }
    const [healed] = healPlayerPiecesForPrep([wounded], { missingHpRecoveryFraction: 1 })
    expect(healed?.stats.hp).toBe(100)
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
