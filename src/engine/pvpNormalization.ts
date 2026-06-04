/**
 * Ranked Arena stat clamp — season baseline without mutating campaign rosters (GDD §9.2).
 */
import {
  buildPieceStats,
  PIECE_DEFINITIONS,
  PROMOTION_MULTIPLIERS,
  type ChessPiece,
  type PieceUpgradeLevels,
} from '@/types/game'

function deepClonePiece(piece: ChessPiece): ChessPiece {
  return JSON.parse(JSON.stringify(piece)) as ChessPiece
}

function applySuperPromotionCombatStats(piece: ChessPiece): ChessPiece {
  if (!piece.superPromotion) return piece
  const mult = PROMOTION_MULTIPLIERS[piece.superPromotion.form]
  const apMult = piece.superPromotion.apMult ?? mult.apMult
  const hpMult = piece.superPromotion.hpMult ?? mult.hpMult
  const maxHp = Math.max(1, Math.round(piece.stats.maxHp * hpMult))
  return {
    ...piece,
    stats: {
      ...piece.stats,
      ap: Math.max(1, Math.round(piece.stats.ap * apMult)),
      maxHp,
      hp: maxHp,
    },
  }
}

function clampedLevels(baselineSeasonLevel: number): PieceUpgradeLevels {
  const level = Math.max(1, Math.floor(baselineSeasonLevel))
  return {
    ap: level,
    hp: level,
    def: level,
    initiative: level,
  }
}

/**
 * Returns a new piece with upgrade tracks set to the season baseline and stats rebuilt.
 * Preserves identity, position, side, and super-promotion form overlay.
 */
export function normalizePieceStats(
  piece: ChessPiece,
  baselineSeasonLevel: number,
): ChessPiece {
  const levels = clampedLevels(baselineSeasonLevel)
  const definition = PIECE_DEFINITIONS[piece.kind]

  let normalized: ChessPiece = {
    ...deepClonePiece(piece),
    upgradeLevels: { ...levels },
    stats: buildPieceStats(piece.kind, levels),
    initiative: {
      ...piece.initiative,
      iniLevel: levels.initiative,
      baseIntervalSec: definition.baseIntervalSec,
      progress: piece.initiative.progress,
      nextActionAtMs: piece.initiative.nextActionAtMs,
    },
    pvpValue: undefined,
    arenaBaseline: {
      ap: buildPieceStats(piece.kind, levels).ap,
      hp: buildPieceStats(piece.kind, levels).maxHp,
      def: buildPieceStats(piece.kind, levels).def,
    },
  }

  normalized = applySuperPromotionCombatStats(normalized)
  return normalized
}

/** Normalizes every piece in a roster (arena export / ranked lobby). */
export function normalizeArmyStats(
  pieces: ChessPiece[],
  baselineSeasonLevel: number,
): ChessPiece[] {
  return pieces.map((piece) => normalizePieceStats(piece, baselineSeasonLevel))
}
