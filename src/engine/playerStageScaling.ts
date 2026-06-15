/**
 * Player army stat scaling by current stage — keeps friendly pieces near enemy counterparts.
 * Enemies use ENEMY_*_STAGE_GROWTH on spawn; player pieces use slightly softer curves here
 * so gold upgrades still feel meaningful.
 */
import { applySuperPromotion, projectSuperStats } from '@/engine/promotion'
import {
  PLAYER_AP_STAGE_GROWTH,
  PLAYER_HP_STAGE_GROWTH,
} from '@/engine/balanceConstants'
import {
  buildPieceStats,
  type ChessPiece,
  type CombatStats,
  type PieceUpgradeLevels,
} from '@/types/game'

export function calculatePlayerStageHpMult(stage: number): number {
  const safe = Math.max(1, Math.floor(stage))
  return PLAYER_HP_STAGE_GROWTH ** (safe - 1)
}

export function calculatePlayerStageApMult(stage: number): number {
  const safe = Math.max(1, Math.floor(stage))
  return PLAYER_AP_STAGE_GROWTH ** (safe - 1)
}

/** Baseline combat stats from upgrades (+ super-promotion overlay when present). */
export function resolvePlayerBaseCombatStats(
  piece: ChessPiece,
  promotionMasteryLevel: number,
): CombatStats {
  if (piece.kind === 'pawn' && piece.superPromotion) {
    const pawnCore = buildPieceStats('pawn', piece.upgradeLevels)
    const pawnShell: ChessPiece = {
      ...piece,
      stats: pawnCore,
      superPromotion: undefined,
    }
    return applySuperPromotion(
      pawnShell,
      piece.superPromotion.form,
      promotionMasteryLevel,
    ).stats
  }
  return buildPieceStats(piece.kind, piece.upgradeLevels)
}

export interface ScalePlayerPieceOptions {
  /** When true, current HP is scaled proportionally to maxHp change (mid-wave refresh). */
  preserveHpRatio?: boolean
}

/**
 * Rebuilds a player piece's combat stats for the current stage and meta AP bonus.
 */
export function scalePlayerPieceForStage(
  piece: ChessPiece,
  stage: number,
  promotionMasteryLevel: number,
  metaApMult: number,
  options: ScalePlayerPieceOptions = {},
): ChessPiece {
  if (piece.side !== 'player') return piece

  const base = resolvePlayerBaseCombatStats(piece, promotionMasteryLevel)
  const hpMult = calculatePlayerStageHpMult(stage)
  const apMult = calculatePlayerStageApMult(stage) * Math.max(1, metaApMult)

  const maxHp = Math.max(1, Math.round(base.maxHp * hpMult))
  const ap = Math.max(1, Math.round(base.ap * apMult))
  const def = Math.max(0, Math.round(base.def * hpMult))

  let hp = maxHp
  if (options.preserveHpRatio && piece.stats.maxHp > 0) {
    const ratio = Math.max(0, Math.min(1, piece.stats.hp / piece.stats.maxHp))
    hp = Math.max(1, Math.min(maxHp, Math.round(maxHp * ratio)))
  }

  return {
    ...piece,
    stats: { hp, maxHp, ap, def },
  }
}

export function refreshPlayerArmyCombatStats(
  pieces: readonly ChessPiece[],
  stage: number,
  promotionMasteryLevel: number,
  metaApMult: number,
  options: ScalePlayerPieceOptions = {},
): ChessPiece[] {
  return pieces.map((piece) =>
    scalePlayerPieceForStage(piece, stage, promotionMasteryLevel, metaApMult, options),
  )
}

/** Compares scaled player vs enemy of the same kind at a stage (upgrade level 0). */
export function playerEnemyStatParityRatio(
  kind: ChessPiece['kind'],
  stage: number,
  metaApMult = 1,
): { hpRatio: number; apRatio: number } {
  const levels: PieceUpgradeLevels = { ap: 1, hp: 1, def: 1, initiative: 1 }
  const player = scalePlayerPieceForStage(
    {
      id: 'probe',
      kind,
      side: 'player',
      position: { file: 0, rank: 0 },
      stats: buildPieceStats(kind, levels),
      upgradeLevels: levels,
      initiative: {
        iniLevel: 1,
        baseIntervalSec: 1,
        progress: 0,
        nextActionAtMs: 0,
      },
    },
    stage,
    0,
    metaApMult,
  )
  const enemyHpMult = 1.114 ** (Math.max(1, stage) - 1)
  const enemyApMult = 1.055 ** (Math.max(1, stage) - 1)
  const enemyBase = buildPieceStats(kind, levels)
  const enemyHp = enemyBase.maxHp * enemyHpMult
  const enemyAp = enemyBase.ap * enemyApMult
  return {
    hpRatio: player.stats.maxHp / enemyHp,
    apRatio: player.stats.ap / enemyAp,
  }
}
