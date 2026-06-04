import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  CLICK_COOLDOWN_MS,
  calculateClickDamage,
  computeClickCooldownProgress,
  isClickCombatReady,
  resolveClickDamage,
} from './clickCombat'

describe('clickCombat', () => {
  it('cooldown helpers gate strikes until interval elapses', () => {
    const readyAt = 10_000
    expect(isClickCombatReady(readyAt, 9_999)).toBe(false)
    expect(isClickCombatReady(readyAt, 10_000)).toBe(true)
    expect(computeClickCooldownProgress(readyAt, 9_000)).toBeCloseTo(0.6, 1)
    expect(computeClickCooldownProgress(readyAt, 10_000 + CLICK_COOLDOWN_MS)).toBe(1)
  })

  it('scales click damage with click power and active mult', () => {
    const low = calculateClickDamage(1, 'pawn', 1.5)
    const high = calculateClickDamage(5, 'pawn', 2)
    expect(high).toBeGreaterThan(low)
  })

  it('chips enemy HP without removing on non-lethal click', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 4 })
    const result = resolveClickDamage('ep', [king], [enemy], {
      clickPowerLevel: 3,
      activeMult: 1.5,
      stage: 1,
      royalDecreeActive: false,
    })
    expect(result.damageDealt).toBeGreaterThan(0)
    expect(result.captured).toBe(false)
    expect(result.enemyPieces[0]?.stats.hp).toBeLessThan(enemy.stats.hp)
  })

  it('removes enemy and flags capture when click damage is lethal', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 4 })
    enemy.stats.hp = 3
    const result = resolveClickDamage('ep', [king], [enemy], {
      clickPowerLevel: 10,
      activeMult: 2,
      stage: 5,
      royalDecreeActive: false,
    })
    expect(result.captured).toBe(true)
    expect(result.enemyPieces).toHaveLength(0)
    expect(result.captureGold).toBeGreaterThan(0)
  })
})
