import { describe, expect, it } from 'vitest'
import {
  resolveSupporterOfflineGoldMultiplier,
  shouldRunAutoShopAssistant,
  SUPPORTER_OFFLINE_GOLD_MULT,
} from '@/engine/supporterQoL'

describe('supporterQoL', () => {
  it('doubles offline drip only when owned', () => {
    expect(resolveSupporterOfflineGoldMultiplier({ offlineGoldMultiplier: false })).toBe(1)
    expect(resolveSupporterOfflineGoldMultiplier({ offlineGoldMultiplier: true })).toBe(
      SUPPORTER_OFFLINE_GOLD_MULT,
    )
  })

  it('auto-shop runs in prep only', () => {
    expect(
      shouldRunAutoShopAssistant({ autoShopAssistant: true }, 'WAVE_PREP'),
    ).toBe(true)
    expect(
      shouldRunAutoShopAssistant({ autoShopAssistant: true }, 'WAVE_ACTIVE'),
    ).toBe(false)
  })
})
