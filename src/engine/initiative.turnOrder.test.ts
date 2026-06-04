import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  bootstrapPieceInitiative,
  buildTurnOrderQueue,
  getNextReadyActor,
} from './initiative'

describe('initiative turn order', () => {
  it('orders player and enemy pieces by nextActionAtMs', () => {
    const now = 0
    const king = bootstrapPieceInitiative(
      createPiece('pk', 'king', 'player', { file: 4, rank: 0 }),
      now,
      1,
    )
    const pawn = bootstrapPieceInitiative(
      createPiece('ep', 'pawn', 'enemy', { file: 0, rank: 6 }),
      now,
      1,
    )
    king.initiative.nextActionAtMs = 1000
    pawn.initiative.nextActionAtMs = 5000
    const queue = buildTurnOrderQueue([king], [pawn], now + 3000, 1)
    expect(queue).toHaveLength(2)
    expect(queue[0]!.id).toBe('pk')
    expect(queue[1]!.id).toBe('ep')
  })

  it('picks earliest ready actor across both sides', () => {
    const now = 5000
    const king = bootstrapPieceInitiative(
      createPiece('pk', 'king', 'player', { file: 4, rank: 0 }),
      0,
      1,
    )
    const pawn = bootstrapPieceInitiative(
      createPiece('ep', 'pawn', 'enemy', { file: 0, rank: 6 }),
      0,
      1,
    )
    king.initiative.nextActionAtMs = 6000
    pawn.initiative.nextActionAtMs = 4000
    const actor = getNextReadyActor([king], [pawn], now)
    expect(actor?.id).toBe('ep')
  })
})
