/**
 * Ephemeral combat juice events for board VFX (Phase 6).
 * Not persisted — recreated only during live combat ticks.
 */
import type { BoardCoord, PieceKind } from '@/types/game'
import type { BoardMove } from '@/engine/moves'
import type { CombatResult } from '@/engine/combat'

export type CombatFeedbackKind = 'capture' | 'chip' | 'gold' | 'leak' | 'reflect' | 'clash'

export interface CombatFeedbackEvent {
  id: string
  kind: CombatFeedbackKind
  file: number
  rank: number
  amount?: number
  expiresAtMs: number
  /** Triggers impact freeze + board zoom when true. */
  heavy?: boolean
  /** Attacker piece kind for procedural pitch mapping. */
  attackerKind?: PieceKind
}

/** Combat loop freeze for boss / super-critical impact frames. */
export const IMPACT_FRAME_MS = 100
export const IMPACT_ZOOM_MS = 280

export const FEEDBACK_TTL_MS: Record<CombatFeedbackKind, number> = {
  capture: 700,
  chip: 550,
  gold: 900,
  leak: 800,
  reflect: 650,
  clash: 480,
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
  options?: { heavy?: boolean; attackerKind?: PieceKind },
): CombatFeedbackEvent {
  return {
    id: nextFeedbackId(nowMs),
    kind,
    file: coord.file,
    rank: coord.rank,
    amount,
    expiresAtMs: nowMs + FEEDBACK_TTL_MS[kind],
    heavy: options?.heavy,
    attackerKind: options?.attackerKind,
  }
}

export interface CombatImpactContext {
  captured: boolean
  damageDealt: number
  targetIsBoss?: boolean
  attackerHasSuper?: boolean
  defenderMaxHp?: number
}

/** Boss kills and super-piece crits earn a brief impact frame + zoom. */
export function shouldTriggerCombatImpact(ctx: CombatImpactContext): boolean {
  if (!ctx.captured && ctx.damageDealt <= 0) return false
  if (ctx.targetIsBoss && ctx.captured) return true
  if (ctx.attackerHasSuper) {
    if (ctx.captured) return true
    const maxHp = ctx.defenderMaxHp ?? 0
    if (maxHp > 0 && ctx.damageDealt >= maxHp * 0.45) return true
  }
  return false
}

export function isImpactFrameActive(impactFreezeUntilMs: number, nowMs: number): boolean {
  return impactFreezeUntilMs > nowMs
}

export function isBoardZoomActive(boardZoomUntilMs: number, nowMs: number): boolean {
  return boardZoomUntilMs > nowMs
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
  impactCtx?: Omit<CombatImpactContext, 'captured' | 'damageDealt'> & {
    attackerKind?: PieceKind
  },
): CombatFeedbackEvent[] {
  const events: CombatFeedbackEvent[] = []
  const heavy = shouldTriggerCombatImpact({
    captured: combat.captured,
    damageDealt: combat.damageDealt,
    ...impactCtx,
  })
  const attackerOpts = impactCtx?.attackerKind
    ? { attackerKind: impactCtx.attackerKind }
    : undefined
  if (combat.captured) {
    events.push(
      createCombatFeedback('capture', move.to, nowMs, undefined, {
        heavy,
        ...attackerOpts,
      }),
    )
  } else if (combat.damageDealt > 0) {
    events.push(
      createCombatFeedback('clash', move.to, nowMs, combat.damageDealt, {
        heavy,
        ...attackerOpts,
      }),
    )
  }
  return events
}
