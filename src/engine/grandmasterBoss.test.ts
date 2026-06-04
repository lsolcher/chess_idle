import { describe, expect, it } from 'vitest'
import { createBossCombatRuntime } from '@/engine/bossMechanics'
import {
  applyGrandmasterCheckmatePhaseSkip,
  detectGrandmasterCheckmatePattern,
  getGrandmasterCombatModifiers,
  getGrandmasterPhase,
  GRANDMASTER_PHASE3_CLICK_MULT,
  GRANDMASTER_PHASE3_INITIATIVE_MULT,
} from '@/engine/grandmasterBoss'
import { createPiece } from '@/types/game'

describe('grandmasterBoss', () => {
  it('maps HP ratio to phases I–III', () => {
    expect(getGrandmasterPhase(0.9)).toBe(1)
    expect(getGrandmasterPhase(0.5)).toBe(2)
    expect(getGrandmasterPhase(0.2)).toBe(3)
  })

  it('applies Phase III initiative and click mults when boss is low', () => {
    const runtime = createBossCombatRuntime(50, [])
    const boss = createPiece('bk', 'king', 'enemy', { file: 4, rank: 7 })
    boss.isBoss = true
    boss.stats.maxHp = 1000
    boss.stats.hp = 200

    const mods = getGrandmasterCombatModifiers(runtime, [boss])
    expect(mods.phase).toBe(3)
    expect(mods.playerInitiativeMult).toBe(GRANDMASTER_PHASE3_INITIATIVE_MULT)
    expect(mods.clickDamageMult).toBe(GRANDMASTER_PHASE3_CLICK_MULT)
  })

  it('skips phase HP on checkmate pattern apply', () => {
    const boss = createPiece('bk', 'king', 'enemy', { file: 4, rank: 4 })
    boss.isBoss = true
    boss.stats.maxHp = 1000
    boss.stats.hp = 900

    const result = applyGrandmasterCheckmatePhaseSkip([boss], [])
    expect(result.skipped).toBe(true)
    expect(result.enemies[0]!.stats.hp).toBe(660)
  })

  it('detects checkmate when boss is in check with no empty escape', () => {
    const boss = createPiece('bk', 'king', 'enemy', { file: 4, rank: 4 })
    boss.isBoss = true
    boss.stats.hp = 100
    const attacker = createPiece('p1', 'pawn', 'player', { file: 3, rank: 4 })
    attacker.stats.hp = 10
    const ringCoords = [
      { file: 3, rank: 3 },
      { file: 4, rank: 3 },
      { file: 5, rank: 3 },
      { file: 5, rank: 4 },
      { file: 3, rank: 5 },
      { file: 4, rank: 5 },
      { file: 5, rank: 5 },
    ]
    const ring = ringCoords.map((pos, i) => {
      const piece = createPiece(`e${i}`, 'pawn', 'enemy', pos)
      piece.stats.hp = 10
      return piece
    })

    expect(
      detectGrandmasterCheckmatePattern([attacker], [boss, ...ring]),
    ).toBe(true)
  })
})
