import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '@/types/game'
import { SUPPORTER_OFFLINE_GOLD_MULT } from '@/engine/supporterQoL'
import {
  calculateOfflineGoldGrant,
  getOfflineCapMs,
  OFFLINE_COMBAT_EFFICIENCY,
  OFFLINE_MIN_AWAY_MS,
} from './offlineProgress'

describe('offlineProgress', () => {
  const game = createInitialGameState(0)

  it('caps away time at 8h by default', () => {
    expect(getOfflineCapMs(false)).toBe(8 * 3_600_000)
    expect(getOfflineCapMs(true)).toBe(12 * 3_600_000)
  })

  it('grants no gold for short absences', () => {
    const result = calculateOfflineGoldGrant({
      awayMs: OFFLINE_MIN_AWAY_MS - 1,
      currentStage: game.currentStage,
      wavePhase: 'WAVE_PREP',
      prestigeGoldMult: 1,
      globalSpeedMult: 1,
      playerPieces: game.playerPieces,
      metaUpgrades: game.metaUpgrades,
      achievements: game.achievements,
      friendlyActionsThisStage: 0,
    })
    expect(result.gold).toBe(0)
  })

  it('applies 50% primary drip only during WAVE_ACTIVE', () => {
    const awayMs = 3_600_000
    const active = calculateOfflineGoldGrant({
      awayMs,
      currentStage: 5,
      wavePhase: 'WAVE_ACTIVE',
      prestigeGoldMult: 1,
      globalSpeedMult: 1,
      playerPieces: game.playerPieces,
      metaUpgrades: game.metaUpgrades,
      achievements: game.achievements,
      friendlyActionsThisStage: 0,
    })
    const prep = calculateOfflineGoldGrant({
      awayMs,
      currentStage: 5,
      wavePhase: 'WAVE_PREP',
      prestigeGoldMult: 1,
      globalSpeedMult: 1,
      playerPieces: game.playerPieces,
      metaUpgrades: game.metaUpgrades,
      achievements: game.achievements,
      friendlyActionsThisStage: 0,
    })
    expect(active.primaryGoldPerSec).toBeGreaterThan(0)
    expect(prep.primaryGoldPerSec).toBe(0)
    expect(active.gold).toBeGreaterThan(prep.gold)
    expect(active.creditedMs).toBe(awayMs)
  })

  it('respects efficiency constant in primary estimate', () => {
    const result = calculateOfflineGoldGrant({
      awayMs: 60_000,
      currentStage: 1,
      wavePhase: 'WAVE_ACTIVE',
      prestigeGoldMult: 1,
      globalSpeedMult: 1,
      playerPieces: game.playerPieces,
      metaUpgrades: game.metaUpgrades,
      achievements: game.achievements,
      friendlyActionsThisStage: 0,
    })
    const rawPerSec = result.primaryGoldPerSec / OFFLINE_COMBAT_EFFICIENCY
    expect(rawPerSec).toBeGreaterThan(0)
    expect(result.gold).toBe(
      Math.floor((result.primaryGoldPerSec + result.exhibitionGoldPerSec) * 60),
    )
  })

  it('applies supporter offline gold multiplier when flag is set', () => {
    const awayMs = 60_000
    const plain = calculateOfflineGoldGrant({
      awayMs,
      currentStage: 1,
      wavePhase: 'WAVE_ACTIVE',
      prestigeGoldMult: 1,
      globalSpeedMult: 1,
      playerPieces: game.playerPieces,
      metaUpgrades: game.metaUpgrades,
      achievements: game.achievements,
      friendlyActionsThisStage: 0,
      supporterOfflineGoldMultiplier: false,
    })
    const boosted = calculateOfflineGoldGrant({
      awayMs,
      currentStage: 1,
      wavePhase: 'WAVE_ACTIVE',
      prestigeGoldMult: 1,
      globalSpeedMult: 1,
      playerPieces: game.playerPieces,
      metaUpgrades: game.metaUpgrades,
      achievements: game.achievements,
      friendlyActionsThisStage: 0,
      supporterOfflineGoldMultiplier: true,
    })
    expect(boosted.gold).toBeGreaterThan(plain.gold)
    expect(boosted.gold).toBe(
      Math.floor(
        (plain.primaryGoldPerSec + plain.exhibitionGoldPerSec) *
          60 *
          SUPPORTER_OFFLINE_GOLD_MULT,
      ),
    )
  })
})
