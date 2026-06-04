/**
 * Wave checkpoint milestones (GDD §1.8) — on King fail, rewind to the last secured milestone.
 *
 * A milestone is **secured** when the player clears that stage (`maxStageReached > milestone`).
 * Example: after clearing stage 10, `maxStageReached` is 11 → checkpoint is 10; failing on 12 rewinds to 10.
 */
import { BOSS_STAGE_INTERVAL, MILESTONE_BOSS_STAGES } from '@/engine/stageManager'

/** Core respawn milestones — boss bands + early pawn slot gate. */
export const WAVE_CHECKPOINT_MILESTONES = [1, 6, 10, 15, 20, 30, 45, 50] as const

/**
 * All checkpoint stages up to `maxStageReached` (includes endless ×10 bosses after 50).
 */
export function listWaveCheckpointMilestones(maxStageReached: number): number[] {
  const cap = Math.max(50, maxStageReached)
  const milestones = new Set<number>(WAVE_CHECKPOINT_MILESTONES)
  for (const boss of MILESTONE_BOSS_STAGES) {
    milestones.add(boss)
  }
  for (let stage = 60; stage <= cap; stage += BOSS_STAGE_INTERVAL) {
    milestones.add(stage)
  }
  return [...milestones].sort((a, b) => a - b)
}

/**
 * Highest milestone stage the player may respawn at after a fail.
 * Uses `maxStageReached` (furthest wave unlocked this run).
 */
export function getWaveCheckpointStage(maxStageReached: number): number {
  const safe = Math.max(1, Math.floor(maxStageReached))
  let checkpoint = 1
  for (const milestone of listWaveCheckpointMilestones(safe)) {
    if (safe > milestone) {
      checkpoint = milestone
    }
  }
  return checkpoint
}

export interface FailStageResolution {
  /** Stage to fight next in prep. */
  nextStage: number
  /** Secured checkpoint used for the respawn. */
  checkpoint: number
  /** True when the run dropped below the failed stage. */
  rewound: boolean
}

/**
 * Resolves post-fail stage: rewind to checkpoint when ahead of it, else retry same stage.
 */
export function resolveStageAfterFail(
  currentStage: number,
  maxStageReached: number,
): FailStageResolution {
  const checkpoint = getWaveCheckpointStage(maxStageReached)
  const stage = Math.max(1, Math.floor(currentStage))
  if (stage > checkpoint) {
    return { nextStage: checkpoint, checkpoint, rewound: true }
  }
  return { nextStage: stage, checkpoint, rewound: false }
}

/** True when clearing `clearedStage` secures a new checkpoint milestone. */
export function isNewCheckpointUnlocked(
  clearedStage: number,
  previousCheckpoint: number,
): boolean {
  const next = getWaveCheckpointStage(clearedStage + 1)
  return next > previousCheckpoint
}
