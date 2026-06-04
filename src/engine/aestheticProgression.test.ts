import { describe, expect, it } from 'vitest'
import {
  getBoardEvolutionTier,
  getPieceAuraTier,
  getVisualTier,
  getVisualTierUnlockStage,
  isGodTierVisualUnlocked,
  resolvePermanentVisualTrophies,
} from '@/engine/aestheticProgression'

describe('aestheticProgression', () => {
  it('uses n^1.5 unlock stages for early dense tiers', () => {
    expect(getVisualTierUnlockStage(1)).toBe(1)
    expect(getVisualTierUnlockStage(2)).toBe(3)
    expect(getVisualTierUnlockStage(3)).toBe(5)
    expect(getVisualTier(1)).toBe(1)
    expect(getVisualTier(20)).toBeGreaterThanOrEqual(6)
  })

  it('slows board evolution with log curve', () => {
    expect(getBoardEvolutionTier(1)).toBe(2)
    expect(getBoardEvolutionTier(100)).toBeLessThanOrEqual(6)
  })

  it('maps visual tier to aura sub-tiers', () => {
    expect(getPieceAuraTier(1)).toBe(0)
    expect(getPieceAuraTier(10)).toBeGreaterThanOrEqual(2)
  })

  it('gates god-tier on prestige and lifetime stage', () => {
    expect(isGodTierVisualUnlocked(60, 2)).toBe(false)
    expect(isGodTierVisualUnlocked(50, 3)).toBe(true)
  })

  it('resolves permanent trophies from lifetime', () => {
    expect(resolvePermanentVisualTrophies(10, 0)).toEqual([])
    expect(resolvePermanentVisualTrophies(50, 1)).toContain('prestige-frame')
    expect(resolvePermanentVisualTrophies(100, 3)).toContain('god-crown')
  })
})
