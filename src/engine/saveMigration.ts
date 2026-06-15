/**
 * Save hydration helpers — normalizes legacy snapshots before runtime use.
 */
import { createDefaultLifetimeStats } from '@/engine/cosmetics'
import type { GameState } from '@/types/game'

/** Migrates saves created before Phase 8 lifetime tracking. */
export function normalizePersistedLifetime(state: GameState): GameState['lifetime'] {
  const base = state.lifetime ?? createDefaultLifetimeStats(state.maxStageReached ?? 1)
  return {
    maxStageEverReached: Math.max(
      base.maxStageEverReached,
      state.maxStageReached ?? 1,
    ),
    lifetimeGoldEarned: Math.max(
      base.lifetimeGoldEarned,
      state.currencies?.totalGoldEarned ?? 0,
    ),
    totalUpgradesBought: base.totalUpgradesBought ?? 0,
    totalPrestiges: base.totalPrestiges ?? 0,
    lifetimeWavesCleared: base.lifetimeWavesCleared ?? 0,
    onboardingTelegraphComplete: base.onboardingTelegraphComplete ?? false,
  }
}
