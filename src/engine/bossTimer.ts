/**
 * Boss wave time limits (GDD §3.2) — 180s base, +30s per Deep Clock meta rank.
 */
import { isBossStage } from '@/engine/stageManager'
import type { MetaUpgradeState } from '@/types/game'

export const BASE_BOSS_WAVE_MS = 180_000
export const BOSS_TIMER_EXTENSION_MS = 30_000

/**
 * Bonus boss-wave duration from meta (Deep Clock — one rank = +30s).
 */
export function getBossTimerExtensionMs(meta: MetaUpgradeState): number {
  const ranks = meta.deepClock ?? 0
  return ranks * BOSS_TIMER_EXTENSION_MS
}

/** Total allowed boss-wave duration for a stage. */
export function getBossWaveLimitMs(stage: number, meta: MetaUpgradeState): number {
  if (!isBossStage(stage)) return 0
  return BASE_BOSS_WAVE_MS + getBossTimerExtensionMs(meta)
}

/** Milliseconds remaining on an active boss deadline (0 if expired). */
export function getBossTimeRemainingMs(deadlineMs: number | null, nowMs: number): number {
  if (deadlineMs === null) return 0
  return Math.max(0, deadlineMs - nowMs)
}

export function isBossWaveTimedOut(deadlineMs: number | null, nowMs: number): boolean {
  if (deadlineMs === null) return false
  return nowMs >= deadlineMs
}
