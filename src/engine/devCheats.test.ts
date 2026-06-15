import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  applyMaxUpgradeLevelsToArmy,
  devSetStageTarget,
  maxPieceUpgradeLevels,
  runDevCheat,
  type DevCheatGameActions,
} from './devCheats'

describe('devCheats', () => {
  it('clamps stage targets', () => {
    expect(devSetStageTarget(0)).toBe(1)
    expect(devSetStageTarget(50.7)).toBe(50)
    expect(devSetStageTarget(5000)).toBe(999)
  })

  it('maxes player upgrade tracks', () => {
    const levels = maxPieceUpgradeLevels()
    expect(levels.ap).toBe(50)
    expect(levels.initiative).toBe(10)

    const king = createPiece('k1', 'king', 'player', { file: 4, rank: 0 })
    const [upgraded] = applyMaxUpgradeLevelsToArmy([king])
    expect(upgraded!.upgradeLevels.ap).toBe(50)
    expect(upgraded!.upgradeLevels.initiative).toBe(10)
  })

  it('addGold10k cheat increases wallet', () => {
    let gold = 0
    const store = {
      wavePhase: 'WAVE_PREP',
      currentStage: 1,
      maxStageReached: 1,
      playerPieces: [],
      deploySlots: 2,
      unlockedSlots: { pawn: 1, knight: 0, bishop: 0, rook: 0, queen: 0 },
      clickPowerLevel: 0,
      stamina: { current: 0, max: 100 },
      enemyPieces: [],
      addGold(amount: number) {
        gold += amount
      },
      addEloShards: () => {},
      syncMilestoneUnlocks: () => {},
      syncPlayerArmyCombatStats: () => {},
      enterWavePrep: () => {},
      startWave: () => {},
      completeWave: () => {},
      dismissWaveOutcome: () => {},
      evaluateWaveOutcome: () => {},
    } satisfies DevCheatGameActions & { enemyPieces: [] }

    runDevCheat(store, 'addGold10k')
    expect(gold).toBe(10_000)
  })
})
