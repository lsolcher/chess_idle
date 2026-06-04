import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMetaStore } from '@/store/metaStore'

describe('metaStore dojo', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('grants skill points on dojoVictory', () => {
    const meta = useMetaStore()
    const granted = meta.dojoVictory('hard')
    expect(granted).toBe(3)
    expect(meta.skillPoints).toBe(3)
    expect(meta.dojoVictories.hard).toBe(1)
  })

  it('purchases Deep Thought and exposes extra search plies', () => {
    const meta = useMetaStore()
    meta.skillPoints = 10
    expect(meta.purchaseDojoUpgrade('deepThought')).toBe(true)
    expect(meta.dojoExtraSearchPlies).toBe(1)
    expect(meta.hardAiSearchPlies).toBe(3)
  })
})

describe('metaStore supporter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('purchaseConvenienceUpgrade unlocks QoL flags', () => {
    const meta = useMetaStore()
    expect(meta.purchaseConvenienceUpgrade('offlineGoldMultiplier')).toBe(true)
    expect(meta.hasOfflineGoldMultiplier).toBe(true)
    expect(meta.lastConvenienceThankYouId).toBe('offlineGoldMultiplier')
    expect(meta.purchaseConvenienceUpgrade('offlineGoldMultiplier')).toBe(false)
  })
})
