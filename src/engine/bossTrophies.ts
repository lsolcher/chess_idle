/**
 * Boss trophy awards on first clear (GDD §3.2 / §4.2 milestones).
 */
import { getBossDefinition, resolveBossIdentity } from '@/engine/bossIdentity'
import { isBossStage } from '@/engine/stageManager'

export interface BossTrophyAward {
  stage: number
  trophyName: string
  bossLabel: string
}

/**
 * Returns trophy grant details if this stage is a first-time boss clear.
 */
export function evaluateBossTrophyAward(
  stage: number,
  bossTrophiesClaimed: number[],
): BossTrophyAward | null {
  if (!isBossStage(stage)) return null
  if (bossTrophiesClaimed.includes(stage)) return null

  const identity = resolveBossIdentity(stage)
  if (!identity) return null

  const def = getBossDefinition(identity)
  return {
    stage,
    trophyName: def.trophyName,
    bossLabel: def.label,
  }
}
