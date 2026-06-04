import { describe, expect, it } from 'vitest'

import {
  calculateMetaModifiers,
  canPurchaseMetaUpgrade,
  getPrestigeEloMultBonus,
  isMetaTreeUnlocked,
} from '@/engine/metaUpgrades'
import { createDefaultMetaUpgrades } from '@/types/game'

describe('metaUpgrades', () => {
  it('stacks opening theory gold at 5% per rank', () => {
    const meta = createDefaultMetaUpgrades()
    meta.openingTheory = 4
    expect(calculateMetaModifiers(meta).goldMult).toBeCloseTo(1.2, 5)
  })

  it('requires prestige before purchases', () => {
    const meta = createDefaultMetaUpgrades()
    expect(
      canPurchaseMetaUpgrade('openingTheory', meta, 10, false),
    ).toBe(false)
    expect(
      canPurchaseMetaUpgrade('openingTheory', meta, 1, true),
    ).toBe(true)
  })

  it('unlocks meta tree after first prestige flag', () => {
    expect(isMetaTreeUnlocked(false, 0)).toBe(false)
    expect(isMetaTreeUnlocked(true, 0)).toBe(true)
    expect(isMetaTreeUnlocked(false, 3)).toBe(true)
  })

  it('applies tempo tyrant elo bonus', () => {
    expect(
      getPrestigeEloMultBonus({
        scholarsMate: false,
        promotedProphet: false,
        idleGrandmaster: false,
        exchangeArtist: false,
        tempoTyrant: true,
      }),
    ).toBe(1.05)
  })
})
