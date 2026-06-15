/**
 * Post-modularization combat integrity — stages 1–5, Royal Decree, Intent Ribbon.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resolveWavePatternForStage } from '@/engine/wavePatterns'
import { createPiniaForTest, useGameStore } from '@/store/gameStore'

describe('combat regression (store modularization)', () => {
  beforeEach(() => {
    createPiniaForTest()
  })

  it('stages 1–5: Royal Decree active on solo king prep; ends after pawn deploy', () => {
    const store = useGameStore()
    store.initGame(0)

    for (let stage = 1; stage <= 5; stage += 1) {
      store.$patch({ currentStage: stage, maxStageReached: stage })
      expect(store.isRoyalDecreeActive).toBe(true)
      expect(store.royalDecree.mode).toBe('full')
      expect(resolveWavePatternForStage(stage)).toBe('procedural')
    }

    store.addGold(500)
    store.purchasePieceFromShop('pawn', 0)
    expect(store.isRoyalDecreeActive).toBe(false)
    expect(store.royalDecree.armyBuilt).toBe(true)
  })

  it('stages 1–2: decree-safe pawn spawns on rank 6 via hub startWave', () => {
    const store = useGameStore()
    store.initGame(0)

    for (let stage = 1; stage <= 2; stage += 1) {
      store.$patch({ currentStage: stage, wavePhase: 'WAVE_PREP' })
      expect(store.startWave(0)).toBe(true)
      expect(store.isWaveActive).toBe(true)
      const pawns = store.enemyPieces.filter((e) => e.kind === 'pawn')
      expect(pawns.length).toBeGreaterThanOrEqual(1)
      for (const pawn of pawns) {
        expect(pawn.position.rank).toBe(6)
      }
      store.enemyPieces = []
      store.$patch({ wavePhase: 'WAVE_PREP' })
      store.stopCombatLoop()
    }
  })

  it('stages 3–5: procedural waves spawn without player collision', () => {
    const store = useGameStore()
    store.initGame(0)

    for (let stage = 3; stage <= 5; stage += 1) {
      store.$patch({ currentStage: stage, wavePhase: 'WAVE_PREP' })
      expect(store.startWave(0)).toBe(true)
      expect(store.enemyPieces.length).toBeGreaterThanOrEqual(1)
      const playerKeys = new Set(
        store.playerPieces.map((p) => `${p.position.file},${p.position.rank}`),
      )
      for (const enemy of store.enemyPieces) {
        expect(playerKeys.has(`${enemy.position.file},${enemy.position.rank}`)).toBe(false)
      }
      store.enemyPieces = []
      store.$patch({ wavePhase: 'WAVE_PREP' })
      store.stopCombatLoop()
    }
  })

  it('Intent Ribbon: telegraphed ids stay synced with timeline after hub tickCombat', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)

    expect(store.enemyIntentTimeline.length).toBeGreaterThan(0)
    expect(store.telegraphedEnemyIds.length).toBeGreaterThan(0)

    store.tickCombat(500)

    const timelineEnemyIds = store.enemyIntentTimeline
      .filter((e) => e.side === 'enemy')
      .map((e) => e.pieceId)
    expect(store.telegraphedEnemyIds.length).toBeLessThanOrEqual(3)
    for (const id of store.telegraphedEnemyIds) {
      expect(timelineEnemyIds).toContain(id)
    }
  })

  it('WAVE_PREP → WAVE_ACTIVE → WAVE_COMPLETE → WAVE_PREP cycle via hub', () => {
    const store = useGameStore()
    store.initGame(0)

    expect(store.isWavePrep).toBe(true)
    expect(store.startWave(0)).toBe(true)
    expect(store.isWaveActive).toBe(true)

    store.enemyPieces = []
    store.evaluateWaveOutcome()
    expect(store.isWaveComplete).toBe(true)

    store.dismissWaveOutcome(0)
    expect(store.isWavePrep).toBe(true)
    expect(store.currentStage).toBe(2)
  })
})
