/**
 * Wave spawning facade — delegates to procedural stage manager (Phase 3.10).
 */
export {
  BOSS_CLEAR_GOLD_MULTIPLIER,
  BOSS_HP_MULTIPLIER,
  BOSS_STAGE_INTERVAL,
  calculateEnemyStageApMult,
  calculateEnemyStageHpMult,
  generateEnemyComposition,
  getBossWaveClearMultiplier,
  getEnemyCountForStage,
  getProceduralWaveSize,
  getSpawnWeights,
  isBossStage,
  MAX_WAVE_PIECES,
  pickEnemyKindForSlot,
  runStageManagerSanityCheck,
  spawnProceduralWave,
} from './stageManager'

import { spawnProceduralWave } from './stageManager'
import type { ChessPiece } from '@/types/game'

/**
 * Spawns enemies for the current stage (endless procedural system).
 */
export function spawnEnemiesForStage(
  stage: number,
  nowMs: number,
  failHpScale = 1,
  playerPieces: ChessPiece[] = [],
): ChessPiece[] {
  return spawnProceduralWave(stage, nowMs, failHpScale, playerPieces)
}
