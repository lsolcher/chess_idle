import { describe, expect, it } from 'vitest'
import { getProceduralWaveSize, isBossStage, spawnEnemiesForStage } from './waves'

describe('wave spawning (procedural facade)', () => {
  it('spawns 1 pawn on stage 1', () => {
    expect(getProceduralWaveSize(1)).toBe(1)
    const enemies = spawnEnemiesForStage(1, 0)
    expect(enemies.filter((e) => e.kind === 'pawn')).toHaveLength(1)
    expect(enemies.some((e) => e.kind === 'king')).toBe(false)
  })

  it('boss stage 10 spawns En Passant Phantom knight with minions', () => {
    expect(isBossStage(10)).toBe(true)
    const enemies = spawnEnemiesForStage(10, 0)
    expect(enemies.some((e) => e.isBoss && e.kind === 'knight')).toBe(true)
    expect(enemies.some((e) => e.bossId === 'enPassantPhantom')).toBe(true)
    expect(enemies.length).toBeGreaterThan(1)
  })

  it('applies fail HP scale on top of stage scaling', () => {
    const base = spawnEnemiesForStage(5, 0, 1)[0]!
    const scaled = spawnEnemiesForStage(5, 0, 0.8)[0]!
    expect(scaled.stats.maxHp).toBeLessThan(base.stats.maxHp)
  })

  it('uses decree-safe rank for early stage pawns', () => {
    const enemies = spawnEnemiesForStage(2, 0)
    expect(enemies[0]!.kind).toBe('pawn')
    expect(enemies[0]!.position.rank).toBe(6)
  })
})
