/**
 * Royal Decree state machine (GDD §1.2) + Last Stand recovery (Ludological Unification).
 */
import {
  countPlayerPieces,
  createInitialGameState,
  createPiece,
  evaluateRoyalDecree,
  type ChessPiece,
  type RoyalDecreeMode,
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
  /** UI label key suffix: full | lastStand */
  modeLabel: RoyalDecreeMode
}

const FULL_MODIFIERS: RoyalDecreeModifiers = {
  captureGoldMult: 2,
  kingAttackMult: 2,
  staminaRegenMult: 2,
  decreeStepEnabled: true,
  soloCheckmateImmunity: true,
  modeLabel: 'full',
}

/** 30% of full decree combat power, 2× stamina regen comeback fantasy. */
const LAST_STAND_MODIFIERS: RoyalDecreeModifiers = {
  captureGoldMult: 1.3,
  kingAttackMult: 1.3,
  staminaRegenMult: 2,
  decreeStepEnabled: false,
  soloCheckmateImmunity: true,
  modeLabel: 'lastStand',
}

const INACTIVE_MODIFIERS: RoyalDecreeModifiers = {
  captureGoldMult: 1,
  kingAttackMult: 1,
  staminaRegenMult: 1,
  decreeStepEnabled: false,
  soloCheckmateImmunity: false,
  modeLabel: 'inactive',
}

/**
 * Pure reducer for Royal Decree transitions.
 * `armyBuilt` latches on first multi-piece deploy; solo King can re-enter Last Stand.
 */
export function reduceRoyalDecree(
  decree: RoyalDecreeState,
  event: RoyalDecreeEvent,
): RoyalDecreeState {
  switch (event.type) {
    case 'RUN_INITIALIZED':
      return { isActive: true, armyBuilt: false, mode: 'full' }

    case 'PLAYER_PIECE_DEPLOYED': {
      const count = countPlayerPieces(event.playerPieces)
      if (count > 1) {
        return evaluateRoyalDecree(event.playerPieces, { ...decree, armyBuilt: true })
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
  if (!decree.isActive) return INACTIVE_MODIFIERS
  if (decree.mode === 'full') return FULL_MODIFIERS
  if (decree.mode === 'lastStand') return LAST_STAND_MODIFIERS
  return INACTIVE_MODIFIERS
}

/** Migrates legacy saves that used `permanentlyExpired`. */
export function normalizeRoyalDecreeState(raw: RoyalDecreeState): RoyalDecreeState {
  const armyBuilt =
    raw.armyBuilt ??
    Boolean((raw as { permanentlyExpired?: boolean }).permanentlyExpired)
  const base = { ...raw, armyBuilt }
  if (base.mode) {
    return {
      isActive: base.isActive,
      armyBuilt,
      mode: base.isActive ? base.mode : 'inactive',
    }
  }
  if (base.isActive && !armyBuilt) return { isActive: true, armyBuilt: false, mode: 'full' }
  if (base.isActive && armyBuilt) return { isActive: true, armyBuilt: true, mode: 'lastStand' }
  return { isActive: false, armyBuilt, mode: 'inactive' }
}

/**
 * Headless state-machine verification — Last Stand reactivates on solo King after army built.
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

  assert('solo king starts with active full decree', decree.isActive && decree.mode === 'full')
  assert('modifiers doubled while full', getRoyalDecreeModifiers(decree).captureGoldMult === 2)

  const pawn = createPiece('pawn-1', 'pawn', 'player', { file: 3, rank: 1 })
  pieces = [...pieces, pawn]
  decree = reduceRoyalDecree(decree, { type: 'PLAYER_PIECE_DEPLOYED', playerPieces: pieces })

  assert('decree inactive after second piece', !decree.isActive)
  assert('army built latched', decree.armyBuilt)

  pieces = pieces.filter((piece) => piece.kind === 'king')
  decree = reduceRoyalDecree(decree, { type: 'PLAYER_PIECE_REMOVED', playerPieces: pieces })
  assert('last stand active on solo recovery', decree.isActive && decree.mode === 'lastStand')
  assert('last stand regen doubled', getRoyalDecreeModifiers(decree).staminaRegenMult === 2)
  assert('last stand attack ~30% over baseline', getRoyalDecreeModifiers(decree).kingAttackMult === 1.3)

  return { passed, messages }
}
