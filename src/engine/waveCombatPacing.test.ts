import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  ACTIONS_WITHOUT_ENEMY_KILL_LIMIT,
  detectEnemyKill,
  nextCombatActionsSinceEnemyKill,
  shouldFailWaveForCombatStall,
  WAVE_MAX_DURATION_MS,
} from '@/engine/waveCombatPacing'

describe('waveCombatPacing', () => {
  it('detects enemy removal as a kill', () => {
    const before = [createPiece('e', 'knight', 'enemy', { file: 4, rank: 5 })]
    const after: typeof before = []
    expect(detectEnemyKill(before, after)).toBe(true)
    expect(nextCombatActionsSinceEnemyKill(40, before, after)).toBe(0)
  })

  it('increments stall counter when enemies survive', () => {
    const enemy = createPiece('e', 'knight', 'enemy', { file: 4, rank: 5 })
    expect(nextCombatActionsSinceEnemyKill(10, [enemy], [enemy])).toBe(11)
  })

  it('fails when actions without kill exceed limit', () => {
    expect(
      shouldFailWaveForCombatStall({
        livingEnemies: 1,
        combatActionsSinceEnemyKill: ACTIONS_WITHOUT_ENEMY_KILL_LIMIT,
        stageStartedAtMs: 0,
        nowMs: 1000,
        isBossStage: false,
        hasBossDeadline: false,
      }),
    ).toBe(true)
  })

  it('fails when wall-clock exceeds wave max on normal stages', () => {
    expect(
      shouldFailWaveForCombatStall({
        livingEnemies: 1,
        combatActionsSinceEnemyKill: 0,
        stageStartedAtMs: 0,
        nowMs: WAVE_MAX_DURATION_MS + 1,
        isBossStage: false,
        hasBossDeadline: false,
      }),
    ).toBe(true)
  })

  it('does not fail when all enemies are dead', () => {
    expect(
      shouldFailWaveForCombatStall({
        livingEnemies: 0,
        combatActionsSinceEnemyKill: 999,
        stageStartedAtMs: 0,
        nowMs: 999_999,
        isBossStage: false,
        hasBossDeadline: false,
      }),
    ).toBe(false)
  })
})
