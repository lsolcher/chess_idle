import { describe, expect, it } from 'vitest'

import { createDefaultEquippedCosmetics, createDefaultLifetimeStats } from '@/engine/cosmetics'
import { buildPostPrestigeState, projectPrestigeEloEarned } from '@/engine/prestige'
import { createDefaultAestheticPreferences, createInitialGameState } from '@/types/game'

describe('prestige', () => {
  it('projects zero elo below stage 20', () => {
    const state = createInitialGameState(0)
    state.maxStageReached = 15
    state.currencies.totalGoldEarned = 9_999_999
    expect(projectPrestigeEloEarned(state)).toBe(0)
  })

  it('resets run but keeps elo and meta', () => {
    const state = createInitialGameState(100)
    state.maxStageReached = 25
    state.currentStage = 25
    state.currencies.gold = 50_000
    state.currencies.totalGoldEarned = 2_000_000
    state.currencies.eloShards = 5
    state.metaUpgrades.openingTheory = 2

    const earned = projectPrestigeEloEarned(state)
    expect(earned).toBeGreaterThanOrEqual(1)

    const lifetime = createDefaultLifetimeStats(25)
    lifetime.lifetimeGoldEarned = 2_000_000
    lifetime.totalUpgradesBought = 12

    const next = buildPostPrestigeState(200, {
      eloShards: state.currencies.eloShards,
      trophies: 0,
      metaUpgrades: { ...state.metaUpgrades },
      achievements: state.achievements,
      hasPrestigedOnce: true,
      lifetime,
      equippedCosmetics: createDefaultEquippedCosmetics(),
      aestheticPreferences: createDefaultAestheticPreferences(),
    }, earned)

    expect(next.currentStage).toBe(1)
    expect(next.lifetime.totalPrestiges).toBe(1)
    expect(next.lifetime.lifetimeGoldEarned).toBe(2_000_000)
    expect(next.lifetime.maxStageEverReached).toBe(25)
    expect(next.currencies.gold).toBe(0)
    expect(next.currencies.totalGoldEarned).toBe(0)
    expect(next.currencies.eloShards).toBe(5 + earned)
    expect(next.metaUpgrades.openingTheory).toBe(2)
    expect(next.hasPrestigedOnce).toBe(true)
    expect(next.prestigeGoldMult).toBeCloseTo(1.1, 5)
  })
})
