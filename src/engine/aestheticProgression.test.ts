import { describe, expect, it } from 'vitest'
import {
  getBoardEvolutionMaterial,
  getBoardEvolutionTier,
  getPieceAuraTier,
  getPiecePowerAuraTier,
  getPieceVictoryGlowClasses,
  getRunVictoryGlowTier,
  getShellAtmosphereClasses,
  getVictoryBackgroundTier,
  getVictoryGlowTier,
  getVisualTier,
  getVisualTierUnlockStage,
  getWavesClearedThisRun,
  isGodTierVisualUnlocked,
  resolvePermanentVisualTrophies,
} from '@/engine/aestheticProgression'
import { createDefaultUpgradeLevels } from '@/types/game'

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

  it('maps board tier to wood → obsidian → celestial materials', () => {
    expect(getBoardEvolutionMaterial(1)).toBe('wood')
    expect(getBoardEvolutionMaterial(3)).toBe('obsidian')
    expect(getBoardEvolutionMaterial(6)).toBe('celestial')
  })

  it('scales piece power aura from upgrade totals', () => {
    expect(getPiecePowerAuraTier(createDefaultUpgradeLevels())).toBe(0)
    expect(
      getPiecePowerAuraTier({ ap: 5, hp: 5, def: 5, initiative: 5 }),
    ).toBeGreaterThanOrEqual(2)
  })

  it('ramps victory glow with waves cleared this run', () => {
    expect(getWavesClearedThisRun(1)).toBe(0)
    expect(getWavesClearedThisRun(4)).toBe(3)
    expect(getRunVictoryGlowTier(0)).toBe(0)
    expect(getRunVictoryGlowTier(3)).toBe(2)
    expect(getVictoryGlowTier(8, 0)).toBeGreaterThanOrEqual(3)
    expect(getPieceVictoryGlowClasses(4, 'queen')).toContain('victory-glow-sparkle')
    expect(getVictoryBackgroundTier(0)).toBe('worn')
    expect(getVictoryBackgroundTier(2)).toBe('rising')
    expect(getVictoryBackgroundTier(6)).toBe('triumphant')
  })

  it('adds music layer atmosphere classes', () => {
    const classes = getShellAtmosphereClasses(50, ['strings', 'god'])
    expect(classes).toContain('shell-atmosphere-strings')
    expect(classes).toContain('shell-atmosphere-god')
  })
})
