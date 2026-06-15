/**
 * Module-level god-mode flag (avoids Pinia import cycles with gameStore).
 * Synced from devStore when cheats are toggled.
 */
import type { ChessPiece } from '@/types/game'

let godModeActive = false

export function setDevGodModeActive(active: boolean): void {
  godModeActive = active
}

export function isDevGodModeActive(): boolean {
  return godModeActive
}

/** One-shots enemy HP; blocks damage to player pieces when god mode is on. */
export function withDevGodModeDamage(
  inner: ((rawDamage: number, defender: ChessPiece) => number) | undefined,
): ((rawDamage: number, defender: ChessPiece) => number) | undefined {
  if (!godModeActive) return inner
  return (rawDamage, defender) => {
    if (defender.side === 'player') return 0
    const base = inner ? inner(rawDamage, defender) : rawDamage
    return Math.max(base, defender.stats.hp)
  }
}
