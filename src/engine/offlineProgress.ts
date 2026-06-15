/**
 * Offline progression — math abstraction for away-time gold (GDD §1.6, Phase 7.5).
 * Uses 50% of active drip efficiency; caps at 8h (12h with Idle Grandmaster).
 */
import { resolveSupporterOfflineGoldMultiplier } from '@/engine/supporterQoL'
import {
  calculateActionIntervalSec,
  calculateGoldAction,
  type ChessPiece,
  type MetaUpgradeState,
  type WavePhase,
} from '@/types/game'

function estimateArmyActionsPerSec(
  playerPieces: ChessPiece[],
  globalSpeedMult: number,
): number {
  let actionsPerSec = 0
  for (const piece of playerPieces) {
    const interval = calculateActionIntervalSec(
      piece.initiative.baseIntervalSec,
      piece.upgradeLevels.initiative,
      globalSpeedMult,
    )
    if (interval > 0) actionsPerSec += 1 / interval
  }
  return actionsPerSec
}

/** GDD offline sim efficiency. */
export const OFFLINE_COMBAT_EFFICIENCY = 0.5

/** Minimum away time before granting offline gold (avoids refresh double-dip). */
export const OFFLINE_MIN_AWAY_MS = 30_000

const HOUR_MS = 3_600_000

export interface OfflineProgressInput {
  awayMs: number
  currentStage: number
  wavePhase: WavePhase
  prestigeGoldMult: number
  globalSpeedMult: number
  playerPieces: ChessPiece[]
  metaUpgrades: MetaUpgradeState
  achievements: { idleGrandmaster: boolean }
  friendlyActionsThisStage: number
  /** Supporter QoL — 1.5× offline drip when owned (metaStore, not combat). */
  supporterOfflineGoldMultiplier?: boolean
}

export interface OfflineProgressResult {
  gold: number
  creditedMs: number
  cappedHours: number
  primaryGoldPerSec: number
  exhibitionGoldPerSec: number
}

/**
 * Caps away-time credit per GDD (8h base, 12h with Idle Grandmaster).
 */
export function getOfflineCapMs(idleGrandmaster: boolean): number {
  return (idleGrandmaster ? 12 : 8) * HOUR_MS
}

/**
 * Estimates gold earned while the tab was closed.
 * Primary-board drip applies only during saved `WAVE_ACTIVE` (combat was running).
 */
export function calculateOfflineGoldGrant(
  input: OfflineProgressInput,
): OfflineProgressResult {
  const empty: OfflineProgressResult = {
    gold: 0,
    creditedMs: 0,
    cappedHours: (input.achievements.idleGrandmaster ? 12 : 8),
    primaryGoldPerSec: 0,
    exhibitionGoldPerSec: 0,
  }

  if (input.awayMs < OFFLINE_MIN_AWAY_MS) return empty

  const capMs = getOfflineCapMs(input.achievements.idleGrandmaster)
  const creditedMs = Math.min(input.awayMs, capMs)
  const creditedSec = creditedMs / 1000

  const perAction = calculateGoldAction(
    input.currentStage,
    input.prestigeGoldMult,
    1,
    input.friendlyActionsThisStage,
  )
  const actionsPerSec = estimateArmyActionsPerSec(
    input.playerPieces,
    input.globalSpeedMult,
  )

  const primaryGoldPerSec =
    input.wavePhase === 'WAVE_ACTIVE'
      ? perAction * actionsPerSec * OFFLINE_COMBAT_EFFICIENCY
      : 0

  const exhibitionGoldPerSec = 0

  const supporterMult = resolveSupporterOfflineGoldMultiplier({
    offlineGoldMultiplier: input.supporterOfflineGoldMultiplier ?? false,
  })
  const gold = Math.floor(
    (primaryGoldPerSec + exhibitionGoldPerSec) * creditedSec * supporterMult,
  )

  return {
    gold,
    creditedMs,
    cappedHours: capMs / HOUR_MS,
    primaryGoldPerSec,
    exhibitionGoldPerSec,
  }
}
