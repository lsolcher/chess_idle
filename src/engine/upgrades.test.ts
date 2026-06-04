import { describe, expect, it } from 'vitest'
import { createInitialGameState, createPiece } from '@/types/game'
import {
  buildUpgradeCatalog,
  calculateTrackRoi,
  getHighlightedUpgradeCatalog,
  markBestRoiOffers,
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
