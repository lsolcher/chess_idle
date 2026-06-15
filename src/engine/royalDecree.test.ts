import { describe, expect, it } from 'vitest'
import { createInitialGameState, createPiece } from '@/types/game'
import {
  getRoyalDecreeModifiers,
  reduceRoyalDecree,
  runRoyalDecreeStateMachineCheck,
} from './royalDecree'

describe('royal decree state machine', () => {
  it('starts active on solo king run', () => {
    const state = createInitialGameState(0)
    expect(state.royalDecree.isActive).toBe(true)
    expect(state.royalDecree.mode).toBe('full')
    expect(getRoyalDecreeModifiers(state.royalDecree).kingAttackMult).toBe(2)
  })

  it('deactivates instantly when second piece is deployed', () => {
    const state = createInitialGameState(0)
    const pawn = createPiece('p1', 'pawn', 'player', { file: 3, rank: 1 })
    const pieces = [...state.playerPieces, pawn]

    const next = reduceRoyalDecree(state.royalDecree, {
      type: 'PLAYER_PIECE_DEPLOYED',
      playerPieces: pieces,
    })

    expect(next.isActive).toBe(false)
    expect(next.armyBuilt).toBe(true)
  })

  it('reactivates last stand when solo again after army built', () => {
    const state = createInitialGameState(0)
    let decree = state.royalDecree
    const pawn = createPiece('p1', 'pawn', 'player', { file: 3, rank: 1 })

    decree = reduceRoyalDecree(decree, {
      type: 'PLAYER_PIECE_DEPLOYED',
      playerPieces: [...state.playerPieces, pawn],
    })

    const soloAgain = [state.playerPieces[0]!]
    decree = reduceRoyalDecree(decree, {
      type: 'PLAYER_PIECE_REMOVED',
      playerPieces: soloAgain,
    })

    expect(decree.isActive).toBe(true)
    expect(decree.mode).toBe('lastStand')
    expect(getRoyalDecreeModifiers(decree).staminaRegenMult).toBe(2)
    expect(getRoyalDecreeModifiers(decree).kingAttackMult).toBe(1.3)
  })

  it('passes headless state machine check', () => {
    const result = runRoyalDecreeStateMachineCheck(0)
    expect(result.passed).toBe(true)
    expect(result.messages.every((m) => m.startsWith('PASS'))).toBe(true)
  })
})
