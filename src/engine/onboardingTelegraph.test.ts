import { describe, expect, it } from 'vitest'
import {
  buildOnboardingEnemyPieces,
  buildOnboardingPlayerPieces,
  isOnboardingTelegraphWave,
} from './onboardingTelegraph'

describe('onboardingTelegraph', () => {
  it('only runs on stage 1 before completion', () => {
    expect(isOnboardingTelegraphWave(1, false)).toBe(true)
    expect(isOnboardingTelegraphWave(1, true)).toBe(false)
    expect(isOnboardingTelegraphWave(2, false)).toBe(false)
  })

  it('builds rook threat and pawn blocker', () => {
    const players = buildOnboardingPlayerPieces(0, 1)
    const enemies = buildOnboardingEnemyPieces(0, 1)
    expect(players.some((p) => p.kind === 'king')).toBe(true)
    expect(players.some((p) => p.kind === 'pawn')).toBe(true)
    expect(enemies).toHaveLength(1)
    expect(enemies[0]!.kind).toBe('rook')
  })
})
