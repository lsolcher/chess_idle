/**
 * Wave pacing guards — prevents endless avoidance stalemates (GDD §1.4 / §1.8).
 * Clearing still requires eliminating all enemies; failure applies fail scaling / checkpoints.
 */
import { countLivingEnemies } from '@/engine/waveState'
import type { ChessPiece } from '@/types/game'

/** Initiative actions without an enemy kill before the wave is forfeited. */
export const ACTIONS_WITHOUT_ENEMY_KILL_LIMIT = 72

/** Wall-clock cap for non-boss waves (boss waves use `bossWaveDeadlineMs`). */
export const WAVE_MAX_DURATION_MS = 240_000

export interface CombatStallInput {
  livingEnemies: number
  combatActionsSinceEnemyKill: number
  stageStartedAtMs: number
  nowMs: number
  isBossStage: boolean
  hasBossDeadline: boolean
}

export function shouldFailWaveForCombatStall(input: CombatStallInput): boolean {
  if (input.livingEnemies <= 0) return false

  if (input.combatActionsSinceEnemyKill >= ACTIONS_WITHOUT_ENEMY_KILL_LIMIT) {
    return true
  }

  if (!input.isBossStage && input.nowMs - input.stageStartedAtMs >= WAVE_MAX_DURATION_MS) {
    return true
  }

  if (
    input.isBossStage &&
    !input.hasBossDeadline &&
    input.nowMs - input.stageStartedAtMs >= WAVE_MAX_DURATION_MS
  ) {
    return true
  }

  return false
}

export function detectEnemyKill(
  enemiesBefore: ChessPiece[],
  enemiesAfter: ChessPiece[],
): boolean {
  return countLivingEnemies(enemiesBefore) > countLivingEnemies(enemiesAfter)
}

export function nextCombatActionsSinceEnemyKill(
  current: number,
  enemiesBefore: ChessPiece[],
  enemiesAfter: ChessPiece[],
): number {
  if (detectEnemyKill(enemiesBefore, enemiesAfter)) return 0
  if (countLivingEnemies(enemiesAfter) <= 0) return 0
  return current + 1
}
