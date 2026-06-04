/**
 * Ephemeral combat juice events for board VFX (Phase 6).
 * Not persisted — recreated only during live combat ticks.
 */
import type { BoardCoord } from '@/types/game'
import type { BoardMove } from '@/engine/moves'
import type { CombatResult } from '@/engine/combat'

export type CombatFeedbackKind = 'capture' | 'chip' | 'gold' | 'leak' | 'reflect'

export interface CombatFeedbackEvent {
  id: string
  kind: CombatFeedbackKind
  file: number
  rank: number
  amount?: number
  expiresAtMs: number
}

export const FEEDBACK_TTL_MS: Record<CombatFeedbackKind, number> = {
  capture: 700,
  chip: 550,
  gold: 900,
  leak: 800,
  reflect: 650,
}

export const SCREEN_SHAKE_MS = 380

let feedbackSeq = 0

function nextFeedbackId(nowMs: number): string {
  feedbackSeq += 1
  return `fx-${nowMs}-${feedbackSeq}`
}

/** Creates a board-local feedback event with automatic expiry. */
export function createCombatFeedback(
  kind: CombatFeedbackKind,
  coord: BoardCoord,
  nowMs: number,
  amount?: number,
): CombatFeedbackEvent {
  return {
    id: nextFeedbackId(nowMs),
    kind,
    file: coord.file,
    rank: coord.rank,
    amount,
    expiresAtMs: nowMs + FEEDBACK_TTL_MS[kind],
  }
}

/** Drops expired VFX entries so the overlay stays cheap to render. */
export function pruneCombatFeedback(
  events: CombatFeedbackEvent[],
  nowMs: number,
): CombatFeedbackEvent[] {
  return events.filter((event) => event.expiresAtMs > nowMs)
}

export function isScreenShaking(screenShakeUntilMs: number, nowMs: number): boolean {
  return screenShakeUntilMs > nowMs
}

/**
 * Maps a combat resolution into capture/chip feedback on the strike square.
 */
export function feedbackFromCombatMove(
  move: BoardMove,
  combat: CombatResult,
  nowMs: number,
): CombatFeedbackEvent[] {
  const events: CombatFeedbackEvent[] = []
  if (combat.captured) {
    events.push(createCombatFeedback('capture', move.to, nowMs))
  } else if (combat.damageDealt > 0) {
    events.push(createCombatFeedback('chip', move.to, nowMs, combat.damageDealt))
  }
  return events
}
