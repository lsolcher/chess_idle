import { describe, expect, it } from 'vitest'
import { coordKey } from '@/engine/board'
import { createPiece } from '@/types/game'
import {
  BOSS_HP_MULTIPLIER,
  calculateEnemyStageApMult,
  calculateEnemyStageHpMult,
  generateEnemyComposition,
  getBossWaveClearMultiplier,
  getProceduralWaveSize,
  getSpawnWeights,
  isBossStage,
  MAX_WAVE_PIECES,
  pickEnemyKindForSlot,
  runStageManagerSanityCheck,
  spawnProceduralWave,
} from './stageManager'

describe('stageManager endless scaling', () => {
  it('passes headless sanity check', () => {
    expect(runStageManagerSanityCheck().passed).toBe(true)
  })

  it('scales HP by 1.08^(stage-1)', () => {
    expect(calculateEnemyStageHpMult(1)).toBeCloseTo(1, 5)
    expect(calculateEnemyStageHpMult(2)).toBeCloseTo(1.08, 5)
    expect(calculateEnemyStageHpMult(50)).toBeCloseTo(1.08 ** 49, 2)
  })

  it('scales AP by 1.06^(stage-1)', () => {
    expect(calculateEnemyStageApMult(1)).toBeCloseTo(1, 5)
    expect(calculateEnemyStageApMult(20)).toBeCloseTo(1.06 ** 19, 2)
  })

  it('caps wave size at 16', () => {
    expect(getProceduralWaveSize(1)).toBe(1)
    expect(getProceduralWaveSize(34)).toBe(MAX_WAVE_PIECES)
    expect(getProceduralWaveSize(1000)).toBe(MAX_WAVE_PIECES)
  })

  it('flags milestone and endless boss stages', () => {
    expect(isBossStage(10)).toBe(true)
    expect(isBossStage(15)).toBe(true)
    expect(isBossStage(20)).toBe(true)
    expect(isBossStage(45)).toBe(true)
    expect(isBossStage(60)).toBe(true)
    expect(isBossStage(11)).toBe(false)
    expect(isBossStage(25)).toBe(false)
  })

  it('shifts composition away from pawns at high stage', () => {
    const early = getSpawnWeights(5).pawn
    const late = getSpawnWeights(50).pawn
    expect(late).toBeLessThan(early)
    expect(getSpawnWeights(50).queen).toBeGreaterThan(0)
  })

  it('castle boss wave leads with rook on stage 20', () => {
    const kinds = generateEnemyComposition(20, 10)
    expect(kinds[0]).toBe('rook')
    expect(kinds.length).toBe(10)
  })

  it('applies 5x HP to phantom knight boss on stage 10', () => {
    const wave = spawnProceduralWave(10, 0)
    const boss = wave.find((p) => p.isBoss && p.kind === 'knight')
    const minion = wave.find((p) => !p.isBoss)
    expect(boss).toBeDefined()
    expect(minion).toBeDefined()
    expect(boss!.stats.maxHp).toBeGreaterThan(minion!.stats.maxHp * BOSS_HP_MULTIPLIER * 0.9)
  })

  it('stage 1 remains decree-safe single pawn', () => {
    const wave = spawnProceduralWave(1, 0)
    expect(wave).toHaveLength(1)
    expect(wave[0]!.kind).toBe('pawn')
    expect(wave[0]!.position.rank).toBe(6)
  })

  it('high stage waves mix multiple piece types', () => {
    const kinds = new Set(
      spawnProceduralWave(50, 0).map((p) => p.kind).filter((k) => k !== 'king'),
    )
    expect(kinds.size).toBeGreaterThan(1)
  })

  it('deterministic kind pick per slot', () => {
    const a = pickEnemyKindForSlot(25, 0)
    const b = pickEnemyKindForSlot(25, 0)
    expect(a).toBe(b)
  })

  it('boss clear multiplier is 3x on boss stages', () => {
    expect(getBossWaveClearMultiplier(10)).toBe(3)
    expect(getBossWaveClearMultiplier(9)).toBe(1)
  })

  it('never spawns enemies on player-occupied squares', () => {
    const king = createPiece('player-king-0', 'king', 'player', { file: 4, rank: 7 })
    const pawn = createPiece('player-pawn-0', 'pawn', 'player', { file: 3, rank: 6 })
    const wave = spawnProceduralWave(10, 0, 1, [king, pawn])
    const playerKeys = new Set([coordKey(king.position), coordKey(pawn.position)])

    for (const enemy of wave) {
      expect(playerKeys.has(coordKey(enemy.position))).toBe(false)
    }

    const enemyKeys = wave.map((enemy) => coordKey(enemy.position))
    expect(new Set(enemyKeys).size).toBe(enemyKeys.length)
  })
})
