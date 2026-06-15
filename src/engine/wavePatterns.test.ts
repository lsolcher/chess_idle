import { describe, expect, it } from 'vitest'
import {
  generatePatternEnemyComposition,
  getWavePatternPlayerApMult,
  resolveWavePatternForStage,
} from '@/engine/wavePatterns'

describe('wavePatterns', () => {
  it('cycles tactical patterns after onboarding', () => {
    expect(resolveWavePatternForStage(6)).toBe('knight_rush')
    expect(resolveWavePatternForStage(10)).toBe('pawn_wall')
  })

  it('knight rush favors knights', () => {
    const kinds = generatePatternEnemyComposition(12, 6, 'knight_rush')
    const knights = kinds.filter((k) => k === 'knight').length
    expect(knights).toBeGreaterThanOrEqual(2)
  })

  it('dojo module unlocks pattern counter AP', () => {
    const mult = getWavePatternPlayerApMult('knight_rush', { knightDefense: true, pawnWallBreak: false, bishopDiagonal: false, rookSiege: false }, 'knight')
    expect(mult).toBe(1.15)
  })
})
