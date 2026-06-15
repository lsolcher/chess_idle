import { describe, expect, it } from 'vitest'
import { coordKey } from '@/engine/board'
import { createBossCombatRuntime, tickBossMechanics } from '@/engine/bossMechanics'
import { createPiece } from '@/types/game'

describe('bossMechanics board occupancy', () => {
  it('phase spawns do not stack on player-occupied squares', () => {
    const king = createPiece('player-king', 'king', 'player', { file: 4, rank: 0 })
    const blocker = createPiece('blocker', 'rook', 'player', { file: 3, rank: 5 })
    const boss = createPiece('gm', 'king', 'enemy', { file: 4, rank: 7 })
    const enemies = [{ ...boss, isBoss: true, bossId: 'grandmaster' as const, stats: { ...boss.stats, hp: 1, maxHp: 100 } }]
    const runtime = createBossCombatRuntime(50, enemies)
    expect(runtime).not.toBeNull()

    const result = tickBossMechanics(
      runtime!,
      50,
      [king, blocker],
      enemies,
      boss.id,
      1,
      1,
    )

    for (const enemy of result.enemyPieces) {
      if (enemy.id === boss.id) continue
      expect(coordKey(enemy.position)).not.toBe(coordKey(blocker.position))
    }
  })
})
