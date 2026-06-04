import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  attributionFromEnemyMove,
  formatKingFailTelegraph,
} from './kingFailAttribution'

describe('kingFailAttribution', () => {
  it('formats capture and leak telegraphs', () => {
    expect(
      formatKingFailTelegraph(
        { source: 'capture', attackerKind: 'pawn', attackerSide: 'enemy' },
        'missing',
        0,
      ),
    ).toContain('Enemy Pawn captured')

    expect(
      formatKingFailTelegraph({ source: 'leak', leakDamage: 12 }, null, 12),
    ).toContain('leak −12')
  })

  it('builds attribution from enemy capture move', () => {
    const pawn = createPiece('e1', 'pawn', 'enemy', { file: 4, rank: 1 })
    const attr = attributionFromEnemyMove(
      { pieceId: 'e1', capturedPieceId: 'player-king-0' },
      pawn,
      true,
      false,
    )
    expect(attr?.source).toBe('capture')
    expect(attr?.attackerKind).toBe('pawn')
  })
})
