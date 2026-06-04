/**
 * Shared combat clock for initiative-adjacent systems (clicks, stamina, UI sync).
 * Manual player turns freeze time; otherwise combat time follows wall clock.
 */
export interface CombatTimeInput {
  autoMode: boolean
  manualPendingPieceId: string | null
  lastSimulatedMs: number
  nowMs: number
}

/**
 * Wall-clock ms used for cooldowns and frozen initiative display.
 * Pauses while the player is choosing a manual move (GDD §1.4.1).
 */
export function getCombatTimeMs(input: CombatTimeInput): number {
  if (!input.autoMode && input.manualPendingPieceId) {
    return input.lastSimulatedMs
  }
  return input.nowMs
}

export function isCombatTimePaused(input: CombatTimeInput): boolean {
  return !input.autoMode && input.manualPendingPieceId !== null
}
