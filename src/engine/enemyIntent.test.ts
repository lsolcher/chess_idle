import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  buildIntentTimeline,
  getTelegraphedEnemyIds,
  INTENT_TIMELINE_SIZE,
} from '@/engine/enemyIntent'

describe('enemyIntent', () => {
  it('returns the next three actors in initiative order', () => {
    const now = 0
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('p', 'pawn', 'enemy', { file: 4, rank: 6 })
    pawn.initiative.nextActionAtMs = now
    king.initiative.nextActionAtMs = now + 5000

    const timeline = buildIntentTimeline([king], [pawn], now, 1)
    expect(timeline.length).toBeLessThanOrEqual(INTENT_TIMELINE_SIZE)
    expect(timeline.length).toBeGreaterThan(0)
    expect(timeline[0]!.side).toBe('enemy')
    expect(getTelegraphedEnemyIds(timeline)).toContain('p')
  })
})
