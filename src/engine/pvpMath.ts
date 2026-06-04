/**
 * Arena point-cost (PC) engine — deterministic loadout valuation (GDD §9.1).
 */
import type { ChessPiece, PieceKind, SuperPromotionForm } from '@/types/game'

/** Draft BasePC table (GDD §9.1). */
export const BASE_PC: Record<PieceKind, number> = {
  pawn: 40,
  knight: 120,
  bishop: 120,
  rook: 200,
  queen: 320,
  king: 150,
}

/**
 * Super-form premium on point cost (GDD: 1.4–2.2); separate from combat apMult.
 */
export const SUPER_FORM_PC_MULT: Record<SuperPromotionForm, number> = {
  'super-knight': 1.4,
  'super-bishop': 1.6,
  'super-rook': 1.8,
  'super-queen': 2.2,
}

function apPcFactor(apLevel: number): number {
  return 1 + 0.08 * Math.max(0, apLevel - 1)
}

function hpPcFactor(hpLevel: number): number {
  return 1 + 0.06 * Math.max(0, hpLevel - 1)
}

function defPcFactor(defLevel: number): number {
  return 1 + 0.05 * Math.max(0, defLevel - 1)
}

function iniPcFactor(iniLevel: number): number {
  return 1 + 0.1 * Math.max(0, iniLevel)
}

function resolveSuperFormPcMult(piece: ChessPiece): number {
  const form = piece.superPromotion?.form
  if (!form) return 1
  return SUPER_FORM_PC_MULT[form]
}

/**
 * PiecePC =
 *   BasePC[kind]
 *   × (1 + 0.08 × (AP_Lvl - 1))
 *   × (1 + 0.06 × (HP_Lvl - 1))
 *   × (1 + 0.05 × (DEF_Lvl - 1))
 *   × (1 + 0.10 × INI_Lvl)
 *   × SuperFormMult[form]
 */
export function calculatePvPValue(piece: ChessPiece): number {
  const levels = piece.upgradeLevels
  const raw =
    BASE_PC[piece.kind] *
    apPcFactor(levels.ap) *
    hpPcFactor(levels.hp) *
    defPcFactor(levels.def) *
    iniPcFactor(levels.initiative) *
    resolveSuperFormPcMult(piece)

  return Math.max(1, Math.round(raw))
}

/** Sum of piece point costs for a deployed army. */
export function calculateArmyPvPValue(pieces: ChessPiece[]): number {
  return pieces.reduce((sum, piece) => sum + calculatePvPValue(piece), 0)
}
