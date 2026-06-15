/**
 * Tempo Bonus — reward answering the Intent Ribbon before the telegraphed enemy acts.
 */
import type { BoardMove } from '@/engine/moves'
import type { CombatResult } from '@/engine/combat'
import type { ChessPiece } from '@/types/game'

/** −5% initiative interval on the player's next action (GDD pivot). */
export const TEMPO_INITIATIVE_MULT = 0.95

export interface TempoBonusCheckInput {
  telegraphedEnemyIds: readonly string[]
  primaryTelegraphedId: string | null
  move: BoardMove
  combat: Pick<CombatResult, 'captured' | 'damageDealt'>
  enemiesBefore: readonly ChessPiece[]
  manualOnly: boolean
  isManualMove: boolean
}

/**
 * Returns true when the player interrupts a telegraphed enemy before it acts:
 * - full capture of a telegraphed enemy, or
 * - chip damage ("block") on the primary telegraphed threat.
 */
export function shouldGrantTempoBonus(input: TempoBonusCheckInput): boolean {
  if (input.manualOnly && !input.isManualMove) return false
  if (input.telegraphedEnemyIds.length === 0) return false

  const targetId =
    input.move.capturedPieceId ??
    input.enemiesBefore.find(
      (enemy) =>
        enemy.position.file === input.move.to.file &&
        enemy.position.rank === input.move.to.rank,
    )?.id

  if (!targetId) return false
  if (!input.telegraphedEnemyIds.includes(targetId)) return false

  if (input.combat.captured) return true

  const primary = input.primaryTelegraphedId
  if (primary && targetId === primary && input.combat.damageDealt > 0) {
    return true
  }

  return false
}

export function applyTempoIntervalMult(
  intervalMs: number,
  tempoHasteMult: number,
): number {
  if (tempoHasteMult >= 1) return intervalMs
  return Math.max(100, Math.round(intervalMs * tempoHasteMult))
}
