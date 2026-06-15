import { describe, expect, it } from 'vitest'

import {
  createCombatFeedback,
  feedbackFromCombatMove,
  pruneCombatFeedback,
} from '@/engine/combatFeedback'
import type { BoardMove } from '@/engine/moves'

describe('combatFeedback', () => {
  it('prunes expired events', () => {
    const event = createCombatFeedback('chip', { file: 1, rank: 2 }, 1000, 5)
    expect(pruneCombatFeedback([event], 1000 + 600)).toHaveLength(0)
    expect(pruneCombatFeedback([event], 1000 + 100)).toHaveLength(1)
  })

  it('emits capture vs chip from combat result', () => {
    const move: BoardMove = {
      pieceId: 'p',
      side: 'player',
      kind: 'pawn',
      from: { file: 1, rank: 1 },
      to: { file: 1, rank: 2 },
      isCapture: true,
      isExtendedStep: false,
    }
    const capture = feedbackFromCombatMove(
      move,
      {
        playerPieces: [],
        enemyPieces: [],
        damageDealt: 10,
        captured: true,
        captureGold: 5,
      },
      0,
    )
    expect(capture[0]?.kind).toBe('capture')

    const chip = feedbackFromCombatMove(
      move,
      {
        playerPieces: [],
        enemyPieces: [],
        damageDealt: 3,
        captured: false,
        captureGold: 0,
      },
      0,
    )
    expect(chip[0]?.kind).toBe('clash')
    expect(chip[0]?.amount).toBe(3)
  })

  it('flags boss capture as heavy impact', () => {
    const move: BoardMove = {
      pieceId: 'p',
      side: 'player',
      kind: 'queen',
      from: { file: 1, rank: 1 },
      to: { file: 1, rank: 2 },
      isCapture: true,
      isExtendedStep: false,
    }
    const events = feedbackFromCombatMove(
      move,
      {
        playerPieces: [],
        enemyPieces: [],
        damageDealt: 99,
        captured: true,
        captureGold: 0,
      },
      0,
      { targetIsBoss: true },
    )
    expect(events[0]?.heavy).toBe(true)
  })
})
