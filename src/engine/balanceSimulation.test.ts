import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MIN_MINUTES_TO_PRESTIGE, STAGE_GOLD_MULT_BASE } from '@/engine/balanceConstants'
import { ENEMY_HP_STAGE_GROWTH } from '@/engine/balanceConstants'
import {
  buildBalanceReport,
  estimateStageClearSec,
  formatBalanceReport,
  simulateProgressionToStage,
} from '@/engine/balanceSimulation'
import { calculateEnemyStageHpMult } from '@/engine/stageManager'
import { BASE_PC, calculateArmyPvPValue } from '@/engine/pvpMath'
import { countGhostArmyVariety, exportArmySnapshot, saveGhostArmy, selectGhostOpponent } from '@/engine/ghostSystem'
import { createInitialGameState, createPiece } from '@/types/game'

describe('balanceSimulation', () => {
  it('reports prestige pacing at or above the minimum band', () => {
    const report = buildBalanceReport()
    expect(report.progression.minutesToStage20).toBeGreaterThanOrEqual(
      MIN_MINUTES_TO_PRESTIGE,
    )
    expect(STAGE_GOLD_MULT_BASE).toBeLessThan(1.14)
  })

  it('documents gold per minute at milestone stages', () => {
    const report = buildBalanceReport()
    expect(report.goldPerMinuteStage1).toBeGreaterThan(0)
    expect(report.goldPerMinuteStage50).toBeGreaterThan(report.goldPerMinuteStage1)
    expect(report.goldPerMinuteStage100).toBeGreaterThan(report.goldPerMinuteStage50)
  })

  it('writes balance-report.txt for design review', () => {
    const report = buildBalanceReport()
    const text = formatBalanceReport(report)
    writeFileSync('balance-report.txt', text, 'utf8')
    expect(text.length).toBeGreaterThan(50)
  })

  it('queen-heavy loadouts cost more PC than pawn swarms', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const queen = createPiece('q', 'queen', 'player', { file: 3, rank: 1 })
    const knight = createPiece('n', 'knight', 'player', { file: 5, rank: 1 })
    const queenArmy = calculateArmyPvPValue([king, queen, knight])

    const pawns = Array.from({ length: 6 }, (_, i) =>
      createPiece(`p${i}`, 'pawn', 'player', { file: i, rank: 1 }),
    )
    const pawnArmy = calculateArmyPvPValue([king, ...pawns])

    expect(queenArmy).toBeGreaterThan(pawnArmy * 1.15)
    expect(BASE_PC.queen).toBeGreaterThan(BASE_PC.pawn * 6)
  })

  it('selectGhostOpponent prefers mixed armies at similar power', () => {
    const pawnOnly = createInitialGameState(0)
    for (let i = 0; i < 5; i++) {
      pawnOnly.playerPieces.push(
        createPiece(`pp${i}`, 'pawn', 'player', { file: i, rank: 1 }),
      )
    }
    const mixed = createInitialGameState(0)
    mixed.playerPieces.push(
      createPiece('n1', 'knight', 'player', { file: 1, rank: 1 }),
      createPiece('b1', 'bishop', 'player', { file: 2, rank: 1 }),
      createPiece('r1', 'rook', 'player', { file: 3, rank: 1 }),
    )

    const pawnSnap = exportArmySnapshot(pawnOnly, 0)
    const mixedSnap = exportArmySnapshot(mixed, 0)
    pawnSnap.powerScore = mixedSnap.powerScore

    saveGhostArmy(pawnSnap, 'pawns')
    saveGhostArmy(mixedSnap, 'mixed')

    const pick = selectGhostOpponent(mixedSnap.powerScore)
    expect(pick?.label).toBe('mixed')
    expect(countGhostArmyVariety(mixedSnap)).toBeGreaterThan(
      countGhostArmyVariety(pawnSnap),
    )
  })

  it('stage 100 simulation completes without NaN', () => {
    const result = simulateProgressionToStage(101)
    expect(result.minutesToStage100).toBeGreaterThan(result.minutesToStage50)
    expect(Number.isFinite(result.minutesToStage100)).toBe(true)
  })

  it('stage 50 clear time is finite with soft-capped enemy HP at 80+', () => {
    const sec50 = estimateStageClearSec(50)
    expect(Number.isFinite(sec50)).toBe(true)
    expect(sec50).toBeGreaterThan(0)
    const hp50 = simulateProgressionToStage(51).stageSamples.find((s) => s.stage === 50)
    const hp80 = simulateProgressionToStage(81).stageSamples.find((s) => s.stage === 80)
    if (hp50 && hp80) {
      const hpGrowth50to80 = hp80.totalEnemyHp / hp50.totalEnemyHp
      expect(hpGrowth50to80).toBeLessThan(30)
    }
  })

  it('stage 80 enemy HP is softer than pure exponential scaling', () => {
    expect(calculateEnemyStageHpMult(80)).toBeLessThan(ENEMY_HP_STAGE_GROWTH ** 79)
  })
})
