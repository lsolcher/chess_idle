/**
 * Supporter convenience QoL — no combat stats; isolated from Arena/PvP (Phase 10).
 */
import type { WavePhase } from '@/types/game'

export type SupporterConvenienceFlags = {
  offlineGoldMultiplier: boolean
  autoShopAssistant: boolean
  advancedCombatLog: boolean
}

/** Bonus applied to offline gold drip when Supporter upgrade is owned. */
export const SUPPORTER_OFFLINE_GOLD_MULT = 1.5

export function resolveSupporterOfflineGoldMultiplier(
  flags: Pick<SupporterConvenienceFlags, 'offlineGoldMultiplier'>,
): number {
  return flags.offlineGoldMultiplier ? SUPPORTER_OFFLINE_GOLD_MULT : 1
}

/**
 * Stage flow hook — auto-shop only in prep; never changes enemy generation.
 */
export function shouldRunAutoShopAssistant(
  flags: Pick<SupporterConvenienceFlags, 'autoShopAssistant'>,
  wavePhase: WavePhase,
): boolean {
  return flags.autoShopAssistant && wavePhase === 'WAVE_PREP'
}

/** Re-export for StageManager consumers (enemy scaling stays untouched). */
export function getSupporterOfflineGoldMult(offlineGoldMultiplierOwned: boolean): number {
  return resolveSupporterOfflineGoldMultiplier({
    offlineGoldMultiplier: offlineGoldMultiplierOwned,
  })
}
