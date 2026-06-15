/**
 * One-time Intent Ribbon tutorial — scripted stage-1 wave (rook telegraph + pawn tempo).
 */
import { bootstrapPieceInitiative } from '@/engine/initiative'
import { applyEnemyStageScaling } from '@/engine/stageManager'
import { createPiece, type ChessPiece } from '@/types/game'

export const ONBOARDING_ROOK_ID = 'onboarding-enemy-rook'
export const ONBOARDING_PAWN_ID = 'onboarding-player-pawn'

/** Positions: player king e1, pawn c2, enemy rook c7 (telegraphed strike lane). */
export function buildOnboardingPlayerPieces(nowMs: number, globalSpeedMult: number): ChessPiece[] {
  const king = bootstrapPieceInitiative(
    createPiece('player-king-0', 'king', 'player', { file: 4, rank: 0 }),
    nowMs,
    globalSpeedMult,
  )
  const pawn = bootstrapPieceInitiative(
    createPiece(ONBOARDING_PAWN_ID, 'pawn', 'player', { file: 2, rank: 1 }),
    nowMs,
    globalSpeedMult,
  )
  return [king, pawn]
}

export function buildOnboardingEnemyPieces(nowMs: number, stage: number): ChessPiece[] {
  const base = bootstrapPieceInitiative(
    createPiece(ONBOARDING_ROOK_ID, 'rook', 'enemy', { file: 2, rank: 6 }),
    nowMs,
    1,
  )
  return [applyEnemyStageScaling(base, stage, 1, false)]
}

export function isOnboardingTelegraphWave(
  stage: number,
  onboardingComplete: boolean,
): boolean {
  return !onboardingComplete && stage === 1
}
