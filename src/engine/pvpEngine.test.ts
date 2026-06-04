import { describe, expect, it } from 'vitest'
import { applySuperPromotion } from '@/engine/promotion'
import { calculatePvPValue } from '@/engine/pvpMath'
import { normalizePieceStats } from '@/engine/pvpNormalization'
import {
  buildPieceStats,
  calculateStatAtLevel,
  createPiece,
  PIECE_DEFINITIONS,
} from '@/types/game'

describe('pvpMath', () => {
  it('values a level-1 pawn below a level-20 super-queen', () => {
    const pawn = createPiece('pawn-1', 'pawn', 'player', { file: 0, rank: 0 })
    expect(pawn.upgradeLevels).toEqual({ ap: 1, hp: 1, def: 1, initiative: 0 })

    const superQueen = applySuperPromotion(
      createPiece('sq', 'pawn', 'player', { file: 4, rank: 4 }),
      'super-queen',
      0,
    )
    superQueen.upgradeLevels = { ap: 20, hp: 20, def: 20, initiative: 20 }

    const pawnPc = calculatePvPValue(pawn)
    const queenPc = calculatePvPValue(superQueen)

    expect(pawnPc).toBe(40)
    expect(queenPc).toBeGreaterThan(pawnPc * 10)
    expect(queenPc).toBe(2776)
  })
})

describe('pvpNormalization', () => {
  it('clamps a level-50 king to baseline 15 without mutating the source', () => {
    const king = createPiece('king-1', 'king', 'player', { file: 4, rank: 0 })
    king.upgradeLevels = { ap: 50, hp: 50, def: 50, initiative: 50 }
    const beforeStats = { ...king.stats }
    const beforeLevels = { ...king.upgradeLevels }

    const normalized = normalizePieceStats(king, 15)
    const baselineStats = buildPieceStats('king', {
      ap: 15,
      hp: 15,
      def: 15,
      initiative: 15,
    })

    expect(king.upgradeLevels).toEqual(beforeLevels)
    expect(king.stats).toEqual(beforeStats)
    expect(king.id).toBe('king-1')

    expect(normalized.upgradeLevels).toEqual({
      ap: 15,
      hp: 15,
      def: 15,
      initiative: 15,
    })
    expect(normalized.stats.ap).toBe(baselineStats.ap)
    expect(normalized.stats.maxHp).toBe(baselineStats.maxHp)
    expect(normalized.stats.def).toBe(baselineStats.def)
    expect(normalized.kind).toBe('king')
    expect(normalized.side).toBe('player')
    expect(normalized.position).toEqual({ file: 4, rank: 0 })
  })

  it('preserves super-promotion form while clamping levels', () => {
    const promoted = applySuperPromotion(
      createPiece('p', 'pawn', 'player', { file: 2, rank: 2 }),
      'super-knight',
      0,
    )
    promoted.upgradeLevels = { ap: 40, hp: 40, def: 40, initiative: 40 }

    const normalized = normalizePieceStats(promoted, 10)

    expect(normalized.superPromotion?.form).toBe('super-knight')
    expect(normalized.upgradeLevels.ap).toBe(10)
    expect(normalized.stats.ap).toBeGreaterThan(
      buildPieceStats('pawn', { ap: 10, hp: 10, def: 10, initiative: 10 }).ap,
    )
  })
})

describe('pvpEngine verification samples', () => {
  it('documents reference PC for a naked knight at level 1', () => {
    const knight = createPiece('n', 'knight', 'player', { file: 1, rank: 1 })
    expect(calculatePvPValue(knight)).toBe(120)
  })

  it('matches GDD stat growth on king AP at level 15', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    king.upgradeLevels = { ap: 15, hp: 1, def: 1, initiative: 0 }
    const expectedApOnly =
      150 * (1 + 0.08 * 14) * 1 * 1 * 1 * 1
    expect(calculatePvPValue(king)).toBe(Math.round(expectedApOnly))
    expect(calculateStatAtLevel(PIECE_DEFINITIONS.king.baseAp, 15)).toBeGreaterThan(
      PIECE_DEFINITIONS.king.baseAp,
    )
  })
})
