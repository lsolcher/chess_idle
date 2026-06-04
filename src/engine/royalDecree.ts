/**
 * Royal Decree state machine (GDD §1.2).
 * Handles solo-King onboarding bonuses and permanent falloff on second deploy.
 */
import {
  countPlayerPieces,
  createInitialGameState,
  createPiece,
  evaluateRoyalDecree,
  type ChessPiece,
  type RoyalDecreeState,
} from '@/types/game'

export type RoyalDecreeEvent =
  | { type: 'RUN_INITIALIZED' }
  | { type: 'PLAYER_PIECE_DEPLOYED'; playerPieces: ChessPiece[] }
  | { type: 'PLAYER_PIECE_REMOVED'; playerPieces: ChessPiece[] }
  | { type: 'FORCE_SYNC'; playerPieces: ChessPiece[] }

/** Passive/combat modifiers while Decree is active. */
export interface RoyalDecreeModifiers {
  captureGoldMult: number
  kingAttackMult: number
  staminaRegenMult: number
  decreeStepEnabled: boolean
  soloCheckmateImmunity: boolean
}

const ACTIVE_MODIFIERS: RoyalDecreeModifiers = {
  captureGoldMult: 2,
  kingAttackMult: 2,
  staminaRegenMult: 2,
  decreeStepEnabled: true,
  soloCheckmateImmunity: true,
}

const INACTIVE_MODIFIERS: RoyalDecreeModifiers = {
  captureGoldMult: 1,
  kingAttackMult: 1,
  staminaRegenMult: 1,
  decreeStepEnabled: false,
  soloCheckmateImmunity: false,
}

/**
 * Pure reducer for Royal Decree transitions.
 * Permanent expiry latches on deploy — never reactivates even if back to solo King.
 */
export function reduceRoyalDecree(
  decree: RoyalDecreeState,
  event: RoyalDecreeEvent,
): RoyalDecreeState {
  if (decree.permanentlyExpired) {
    return { isActive: false, permanentlyExpired: true }
  }

  switch (event.type) {
    case 'RUN_INITIALIZED':
      return { isActive: true, permanentlyExpired: false }

    case 'PLAYER_PIECE_DEPLOYED': {
      const count = countPlayerPieces(event.playerPieces)
      if (count > 1) {
        return { isActive: false, permanentlyExpired: true }
      }
      return evaluateRoyalDecree(event.playerPieces, decree)
    }

    case 'PLAYER_PIECE_REMOVED':
    case 'FORCE_SYNC':
      return evaluateRoyalDecree(event.playerPieces, decree)

    default:
      return decree
  }
}

/** Returns GDD modifier bundle for combat/economy hooks. */
export function getRoyalDecreeModifiers(decree: RoyalDecreeState): RoyalDecreeModifiers {
  return decree.isActive ? ACTIVE_MODIFIERS : INACTIVE_MODIFIERS
}

/**
 * Headless state-machine verification — decree must drop instantly on second piece.
 */
export function runRoyalDecreeStateMachineCheck(nowMs = 0): {
  passed: boolean
  messages: string[]
} {
  const messages: string[] = []
  let passed = true
  const assert = (label: string, ok: boolean) => {
    messages.push(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
    if (!ok) passed = false
  }

  const state = createInitialGameState(nowMs)
  let decree = state.royalDecree
  let pieces = [...state.playerPieces]

  assert('solo king starts with active decree', decree.isActive)
  assert('modifiers doubled while active', getRoyalDecreeModifiers(decree).captureGoldMult === 2)

  const pawn = createPiece('pawn-1', 'pawn', 'player', { file: 3, rank: 1 })
  pieces = [...pieces, pawn]
  decree = reduceRoyalDecree(decree, { type: 'PLAYER_PIECE_DEPLOYED', playerPieces: pieces })

  assert('decree inactive immediately after second piece', !decree.isActive)
  assert('decree permanently expired after deploy', decree.permanentlyExpired)

  pieces = pieces.filter((piece) => piece.kind === 'king')
  decree = reduceRoyalDecree(decree, { type: 'PLAYER_PIECE_REMOVED', playerPieces: pieces })
  assert('decree stays off after returning to solo king', !decree.isActive)
  assert('permanent latch survives piece loss', decree.permanentlyExpired)

  return { passed, messages }
}
