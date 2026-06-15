import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  playerEnemyStatParityRatio,
  refreshPlayerArmyCombatStats,
  scalePlayerPieceForStage,
} from '@/engine/playerStageScaling'
import { applyEnemyStageScaling } from '@/engine/stageManager'

describe('playerStageScaling', () => {
  it('keeps level-1 player pieces within reasonable parity vs enemies at mid stage', () => {
    const { hpRatio, apRatio } = playerEnemyStatParityRatio('knight', 20)
    expect(hpRatio).toBeGreaterThan(0.85)
    expect(hpRatio).toBeLessThan(1.15)
    expect(apRatio).toBeGreaterThan(0.85)
    expect(apRatio).toBeLessThan(1.15)
  })

  it('scales higher when stage increases', () => {
    const pawn = createPiece('p', 'pawn', 'player', { file: 4, rank: 1 })
    const early = scalePlayerPieceForStage(pawn, 5, 0, 1)
    const late = scalePlayerPieceForStage(pawn, 25, 0, 1)
    expect(late.stats.maxHp).toBeGreaterThan(early.stats.maxHp)
    expect(late.stats.ap).toBeGreaterThan(early.stats.ap)
  })

  it('applies meta AP mult to the whole army', () => {
    const pawn = createPiece('p', 'pawn', 'player', { file: 4, rank: 1 })
    const base = scalePlayerPieceForStage(pawn, 10, 0, 1)
    const boosted = scalePlayerPieceForStage(pawn, 10, 0, 1.15)
    expect(boosted.stats.ap).toBeGreaterThan(base.stats.ap)
  })

  it('matches enemy knight HP order-of-magnitude at stage 15', () => {
    const stage = 15
    const playerKnight = scalePlayerPieceForStage(
      createPiece('pk', 'knight', 'player', { file: 2, rank: 1 }),
      stage,
      0,
      1,
    )
    const enemyKnight = applyEnemyStageScaling(
      createPiece('ek', 'knight', 'enemy', { file: 2, rank: 6 }),
      stage,
      1,
      false,
    )
    expect(playerKnight.stats.maxHp).toBeGreaterThan(enemyKnight.stats.maxHp * 0.8)
    expect(playerKnight.stats.maxHp).toBeLessThan(enemyKnight.stats.maxHp * 1.2)
  })

  it('preserves HP ratio when requested', () => {
    const wounded = createPiece('p', 'pawn', 'player', { file: 0, rank: 0 })
    wounded.stats.hp = Math.floor(wounded.stats.maxHp * 0.4)
    const [refreshed] = refreshPlayerArmyCombatStats([wounded], 12, 0, 1, {
      preserveHpRatio: true,
    })
    expect(refreshed!.stats.hp).toBeLessThan(refreshed!.stats.maxHp)
    expect(refreshed!.stats.hp / refreshed!.stats.maxHp).toBeCloseTo(0.4, 1)
  })
})
