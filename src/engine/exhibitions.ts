/**
 * Simultaneous Exhibitions — background board gold drip (GDD §2.5).
 * Side boards farm at reduced gold rate and 0.5× initiative resolution speed.
 */
import { calculateActionIntervalSec, calculateGoldAction, type ChessPiece } from '@/types/game'

export interface ExhibitionBoardConfig {
  id: 'B' | 'C'
  /** Virtual stage for gold formula. */
  stage: number
  /** Fraction of primary-board gold per action (0.5, 0.65, 0.4). */
  goldMult: number
}

/** Initiative resolution is half speed on exhibition boards (GDD §2.5). */
export const EXHIBITION_INITIATIVE_RATE_MULT = 0.5

/**
 * Exhibition board unlocks by Simultaneous Exhibitions rank (GDD §2.5 table).
 */
export function getExhibitionBoardConfigs(
  exhibitionRank: number,
  currentStage: number,
): ExhibitionBoardConfig[] {
  if (exhibitionRank <= 0) return []
  const virtualStage = Math.max(1, currentStage - 5)
  const boards: ExhibitionBoardConfig[] = []

  if (exhibitionRank >= 1) {
    boards.push({
      id: 'B',
      stage: virtualStage,
      goldMult: exhibitionRank >= 2 ? 0.65 : 0.5,
    })
  }
  if (exhibitionRank >= 3) {
    boards.push({
      id: 'C',
      stage: virtualStage,
      goldMult: 0.4,
    })
  }
  return boards
}

/**
 * Estimates friendly actions per second from roster initiative intervals.
 */
export function estimateArmyActionsPerSec(
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

/**
 * Gold per second from one exhibition board at the given virtual stage.
 */
export function calculateExhibitionGoldPerSec(
  board: ExhibitionBoardConfig,
  playerPieces: ChessPiece[],
  prestigeGoldMult: number,
  globalSpeedMult: number,
): number {
  const perAction = calculateGoldAction(board.stage, prestigeGoldMult, 1, 0)
  const actionsPerSec =
    estimateArmyActionsPerSec(playerPieces, globalSpeedMult) *
    EXHIBITION_INITIATIVE_RATE_MULT
  return perAction * board.goldMult * actionsPerSec
}

/**
 * Total exhibition drip across all unlocked side boards.
 */
export function calculateTotalExhibitionGoldPerSec(
  exhibitionRank: number,
  currentStage: number,
  playerPieces: ChessPiece[],
  prestigeGoldMult: number,
  globalSpeedMult: number,
): number {
  const boards = getExhibitionBoardConfigs(exhibitionRank, currentStage)
  return boards.reduce(
    (sum, board) =>
      sum +
      calculateExhibitionGoldPerSec(board, playerPieces, prestigeGoldMult, globalSpeedMult),
    0,
  )
}

/**
 * Awards exhibition gold for elapsed wall time (called every RAF frame).
 */
export function tickExhibitionGold(
  exhibitionRank: number,
  currentStage: number,
  playerPieces: ChessPiece[],
  prestigeGoldMult: number,
  globalSpeedMult: number,
  deltaSec: number,
): number {
  if (exhibitionRank <= 0 || deltaSec <= 0) return 0
  const gps = calculateTotalExhibitionGoldPerSec(
    exhibitionRank,
    currentStage,
    playerPieces,
    prestigeGoldMult,
    globalSpeedMult,
  )
  return gps * deltaSec
}
