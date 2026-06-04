import { describe, expect, it } from 'vitest'
import { buildPieceShopCatalog } from '@/engine/pieceShop'
import { createInitialGameState, createPiece } from '@/types/game'
import {
  buildUpgradeCatalog,
  calculateClickPowerRoi,
  calculatePromotionMasteryRoi,
  calculateRecruitRoi,
  calculateTrackRoi,
  getHighlightedUpgradeCatalog,
  markBestRoiOffers,
  pickBestAffordablePurchase,
  pickBestAffordableUpgrade,
  runUpgradeCatalogSanityCheck,
} from './upgrades'

describe('upgrade catalog', () => {
  it('builds offers for each player piece track', () => {
    const state = createInitialGameState(0)
    const catalog = buildUpgradeCatalog({
      gold: 500,
      playerPieces: state.playerPieces,
      clickPowerLevel: 1,
      promotionMasteryLevel: 0,
      globalSpeedMult: 1,
      currentStage: 1,
      autoAdvanceWavesPurchased: false,
    })

    expect(catalog.length).toBeGreaterThan(4)
    expect(catalog.some((o) => o.track === 'ap')).toBe(true)
    expect(catalog.some((o) => o.track === 'clickPower')).toBe(true)
  })

  it('marks best affordable ROI offer', () => {
    const state = createInitialGameState(0)
    const highlighted = getHighlightedUpgradeCatalog({
      gold: 1_000_000,
      playerPieces: state.playerPieces,
      clickPowerLevel: 1,
      promotionMasteryLevel: 0,
      globalSpeedMult: 1,
      currentStage: 1,
      autoAdvanceWavesPurchased: false,
    })

    const best = highlighted.filter((o) => o.isBestRoi)
    expect(best).toHaveLength(1)
    expect(best[0]?.affordable).toBe(true)
    expect(best[0]?.id).toBe(pickBestAffordableUpgrade(highlighted)?.id)
  })

  it('sorts by ROI descending', () => {
    const king = createInitialGameState(0).playerPieces[0]!
    const roi = calculateTrackRoi(king, 'ap', 100, 1)
    expect(roi).toBeGreaterThan(0)

    const catalog = buildUpgradeCatalog({
      gold: 0,
      playerPieces: [king],
      clickPowerLevel: 1,
      promotionMasteryLevel: 0,
      globalSpeedMult: 1,
      currentStage: 1,
      autoAdvanceWavesPurchased: false,
    })
    for (let i = 1; i < catalog.length; i += 1) {
      expect(catalog[i - 1]!.roiScore).toBeGreaterThanOrEqual(catalog[i]!.roiScore)
    }
  })

  it('compares AP and initiative on the same DPS/gold scale', () => {
    const king = createInitialGameState(0).playerPieces[0]!
    const apRoi = calculateTrackRoi(king, 'ap', 100, 1)
    const iniRoi = calculateTrackRoi(king, 'initiative', 80, 1)
    expect(apRoi).toBeGreaterThan(iniRoi)
  })

  it('prefers recruiting a pawn over king AP early game', () => {
    const state = createInitialGameState(0)
    const upgrades = buildUpgradeCatalog({
      gold: 500,
      playerPieces: state.playerPieces,
      clickPowerLevel: 1,
      promotionMasteryLevel: 0,
      globalSpeedMult: 1,
      currentStage: 1,
      autoAdvanceWavesPurchased: false,
    })
    const shop = buildPieceShopCatalog({
      gold: 500,
      maxStageReached: state.maxStageReached,
      currentStage: state.currentStage,
      wavePhase: 'WAVE_PREP',
      playerPieces: state.playerPieces,
      enemyPieces: [],
      unlockedSlots: state.unlockedSlots,
      deploySlots: state.deploySlots,
      globalSpeedMult: 1,
    })

    const pick = pickBestAffordablePurchase(upgrades, shop)
    expect(pick?.source).toBe('shop')
    expect(pick?.id).toBe('shop:piece:pawn')
  })

  it('excludes auto-advance from best ROI highlight', () => {
    const state = createInitialGameState(0)
    const catalog = buildUpgradeCatalog({
      gold: 10_000,
      playerPieces: state.playerPieces,
      clickPowerLevel: 1,
      promotionMasteryLevel: 0,
      globalSpeedMult: 1,
      currentStage: 10,
      autoAdvanceWavesPurchased: false,
    })
    const highlighted = markBestRoiOffers(catalog)
    const best = highlighted.find((o) => o.isBestRoi)
    expect(best?.track).not.toBe('autoAdvanceWaves')
  })

  it('scores click power from marginal click DPS', () => {
    const roi = calculateClickPowerRoi(1, 236)
    expect(roi).toBeGreaterThan(0)
    expect(roi).toBeLessThan(calculateRecruitRoi('pawn', 100, 1))
  })

  it('scores promotion mastery from super pieces and pawns', () => {
    const pawn = createPiece('p1', 'pawn', 'player', { file: 0, rank: 1 })
    const roi = calculatePromotionMasteryRoi([pawn], 250, 1)
    expect(roi).toBeGreaterThan(0)
  })

  it('passes sanity check', () => {
    expect(runUpgradeCatalogSanityCheck().passed).toBe(true)
  })
})

describe('upgrade cost scaling matrix (king AP, levels 1–10)', () => {
  it('documents exponential costs from GDD', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const samples = [1, 2, 5, 10].map((level) => {
      const offer = buildUpgradeCatalog({
        gold: 999_999,
        playerPieces: [{ ...king, upgradeLevels: { ap: level, hp: 1, def: 1, initiative: 0 } }],
        clickPowerLevel: 1,
        promotionMasteryLevel: 0,
        globalSpeedMult: 1,
        currentStage: 1,
        autoAdvanceWavesPurchased: false,
      }).find((o) => o.track === 'ap')
      return { level, cost: offer?.cost ?? 0 }
    })

    expect(samples[0]?.cost).toBeCloseTo(115, 0)
    expect(samples[3]?.cost).toBeGreaterThan(samples[1]?.cost ?? 0)
  })
})
