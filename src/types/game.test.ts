import { describe, expect, it } from 'vitest'
import {
  calculateActionIntervalSec,
  calculateActiveMult,
  calculateDamageDealt,
  calculateEloShardsEarned,
  calculateGoldAction,
  calculateStageGoldMult,
  calculateStatAtLevel,
  calculateUpgradeCost,
  countPlayerPieces,
  createInitialGameState,
  createPiece,
  evaluateRoyalDecree,
  getInitiativeUpgradeBaseCost,
  getStatUpgradeBaseCost,
  PIECE_DEFINITIONS,
  registerPlayerPiece,
  runTypeModelSanityCheck,
  STAT_LEVEL_GROWTH,
  STAT_UPGRADE_CONFIG,
} from './game'

describe('game types & balance helpers', () => {
  it('creates initial state with solo King and Royal Decree active', () => {
    const state = createInitialGameState()
    expect(state.schemaVersion).toBe('0.3.0')
    expect(state.playerPieces).toHaveLength(1)
    expect(state.playerPieces[0]?.kind).toBe('king')
    expect(state.royalDecree.isActive).toBe(true)
    expect(state.royalDecree.armyBuilt).toBe(false)
    expect(state.royalDecree.mode).toBe('full')
  })

  it('latches army built and enables last stand when returning to solo king', () => {
    const state = createInitialGameState()
    const pawn = createPiece('pawn-1', 'pawn', 'player', { file: 3, rank: 1 })
    const result = registerPlayerPiece(state.playerPieces, state.royalDecree, pawn)

    expect(countPlayerPieces(result.pieces)).toBe(2)
    expect(result.decree.armyBuilt).toBe(true)
    expect(result.decree.isActive).toBe(false)

    const kingOnly = [state.playerPieces[0]!]
    const reeval = evaluateRoyalDecree(kingOnly, result.decree)
    expect(reeval.isActive).toBe(true)
    expect(reeval.mode).toBe('lastStand')
  })

  it('matches GDD upgrade cost example: pawn AP level 10 ≈ 352 gold', () => {
    const cost = calculateUpgradeCost(
      getStatUpgradeBaseCost('pawn'),
      STAT_UPGRADE_CONFIG.growth,
      10,
    )
    expect(Math.round(cost)).toBe(352)
  })

  it('scales stats exponentially at 1.12^(L-1)', () => {
    const base = PIECE_DEFINITIONS.pawn.baseAp
    const level10 = calculateStatAtLevel(base, 10)
    expect(level10).toBeCloseTo(base * STAT_LEVEL_GROWTH ** 9, 5)
  })

  it('caps initiative reduction at 60% by level 10', () => {
    const base = PIECE_DEFINITIONS.pawn.baseIntervalSec
    const at10 = calculateActionIntervalSec(base, 10)
    const expected = base / 1.6
    expect(at10).toBeCloseTo(expected, 5)
    expect(at10).toBeGreaterThan(base * 0.6)
    expect(at10).toBeLessThan(base * 0.65)
  })

  it('uses tier² for initiative upgrade bases', () => {
    expect(getInitiativeUpgradeBaseCost('pawn')).toBe(80)
    expect(getInitiativeUpgradeBaseCost('knight')).toBe(320)
    expect(getStatUpgradeBaseCost('rook')).toBe(900)
  })

  it('computes active multiplier with combo cap', () => {
    expect(calculateActiveMult(0)).toBeCloseTo(1.5)
    expect(calculateActiveMult(15)).toBe(3)
    expect(calculateActiveMult(100)).toBe(3)
  })

  it('computes stage gold multiplier', () => {
    expect(calculateStageGoldMult(1)).toBe(1)
    expect(calculateStageGoldMult(10)).toBeCloseTo(1.12 ** 9, 5)
  })

  it('never divides by zero in gold action calc', () => {
    const gold = calculateGoldAction(1, 0, 1.5, 0)
    expect(Number.isFinite(gold)).toBe(true)
    expect(gold).toBeGreaterThanOrEqual(0)
  })

  it('enforces minimum damage of 1', () => {
    expect(calculateDamageDealt(3, 10)).toBe(1)
    expect(calculateDamageDealt(20, 5)).toBe(15)
  })

  it('calculates prestige elo only at stage 20+', () => {
    expect(calculateEloShardsEarned(10, 999_999_999)).toBe(0)
    expect(calculateEloShardsEarned(20, 1_000_000)).toBeGreaterThanOrEqual(1)
  })

  it('passes bundled headless sanity check', () => {
    const result = runTypeModelSanityCheck()
    expect(result.passed).toBe(true)
    expect(result.messages.every((m) => m.startsWith('PASS'))).toBe(true)
  })
})

describe('progression scaling matrix (levels 1–50)', () => {
  it('documents stat and cost curves within GDD bounds', () => {
    const pawnApBase = PIECE_DEFINITIONS.pawn.baseAp
    const samples = [1, 5, 10, 25, 50].map((level) => ({
      level,
      ap: calculateStatAtLevel(pawnApBase, level),
      upgradeCost: calculateUpgradeCost(
        getStatUpgradeBaseCost('pawn'),
        STAT_UPGRADE_CONFIG.growth,
        level,
      ),
    }))

    expect(samples[0]?.ap).toBeCloseTo(6, 5)
    expect(samples[4]?.ap).toBeCloseTo(pawnApBase * STAT_LEVEL_GROWTH ** 49, 2)
    expect(samples[4]?.upgradeCost).toBeGreaterThan(samples[0]?.upgradeCost ?? 0)

    const stage50Mult = calculateStageGoldMult(50)
    expect(stage50Mult).toBeGreaterThan(100)
    expect(stage50Mult).toBeLessThan(10_000)
  })
})
