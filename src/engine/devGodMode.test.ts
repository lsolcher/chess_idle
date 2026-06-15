import { describe, expect, it, beforeEach } from 'vitest'
import { createPiece } from '@/types/game'
import { setDevGodModeActive, withDevGodModeDamage } from './devGodMode'

describe('devGodMode', () => {
  beforeEach(() => {
    setDevGodModeActive(false)
  })

  it('passes through when god mode is off', () => {
    const inner = (raw: number) => raw * 2
    const adjust = withDevGodModeDamage(inner)
    const enemy = createPiece('e1', 'pawn', 'enemy', { file: 0, rank: 6 })
    expect(adjust!(10, enemy)).toBe(20)
  })

  it('one-shots enemies and blocks player damage when on', () => {
    setDevGodModeActive(true)
    const adjust = withDevGodModeDamage(undefined)!
    const enemy = createPiece('e1', 'pawn', 'enemy', { file: 0, rank: 6 })
    enemy.stats.hp = 40
    expect(adjust(5, enemy)).toBe(40)

    const king = createPiece('k1', 'king', 'player', { file: 4, rank: 0 })
    expect(adjust(999, king)).toBe(0)
  })
})
