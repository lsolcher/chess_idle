/**
 * En Passant Economy meta — carries a fraction of super-promotion stat bonus into the next stage (GDD §2.5).
 * Carry is keyed by pawn instance id and clears on death or prestige reset.
 */
import { applySuperPromotion } from '@/engine/promotion'
import {
  buildPieceStats,
  type ChessPiece,
  type SuperPromotionForm,
} from '@/types/game'

/** Persisted bonus applied on the next super-promotion for this pawn. */
export interface EnPassantCarryBonus {
  apBonus: number
  hpBonus: number
  fromForm?: SuperPromotionForm
}

export type EnPassantCarryMap = Record<string, EnPassantCarryBonus>

/**
 * Carry percent from meta rank: 25% per rank, max 125% at rank 5 (GDD §2.5).
 */
export function getEnPassantCarryPercent(enPassantEconomyRank: number): number {
  return Math.min(1.25, Math.max(0, enPassantEconomyRank) * 0.25)
}

/**
 * Computes the marginal super-promotion bonus above baseline pawn stats.
 */
export function computeSuperPromotionMarginalBonus(piece: ChessPiece): {
  apBonus: number
  hpBonus: number
  form?: SuperPromotionForm
} | null {
  if (piece.kind !== 'pawn' || !piece.superPromotion) return null

  const baseline = buildPieceStats('pawn', piece.upgradeLevels)
  const apBonus = Math.max(0, piece.stats.ap - baseline.ap)
  const hpBonus = Math.max(0, piece.stats.maxHp - baseline.maxHp)
  return {
    apBonus,
    hpBonus,
    form: piece.superPromotion.form,
  }
}

/**
 * Snapshots carry for each promoted pawn at stage end before super overlay is stripped.
 */
export function snapshotEnPassantCarry(
  playerPieces: ChessPiece[],
  carryPercent: number,
  existing: EnPassantCarryMap,
): EnPassantCarryMap {
  if (carryPercent <= 0) return { ...existing }

  const next: EnPassantCarryMap = { ...existing }
  for (const piece of playerPieces) {
    if (piece.side !== 'player' || piece.kind !== 'pawn') continue
    const marginal = computeSuperPromotionMarginalBonus(piece)
    if (!marginal || (marginal.apBonus <= 0 && marginal.hpBonus <= 0)) continue

    next[piece.id] = {
      apBonus: Math.floor(marginal.apBonus * carryPercent),
      hpBonus: Math.floor(marginal.hpBonus * carryPercent),
      fromForm: marginal.form,
    }
  }
  return next
}

/** Removes carry entries for pieces no longer on the roster. */
export function pruneEnPassantCarry(
  carryMap: EnPassantCarryMap,
  playerPieces: ChessPiece[],
): EnPassantCarryMap {
  const liveIds = new Set(playerPieces.filter((p) => p.kind === 'pawn').map((p) => p.id))
  const next: EnPassantCarryMap = {}
  for (const [id, bonus] of Object.entries(carryMap)) {
    if (liveIds.has(id)) next[id] = bonus
  }
  return next
}

/** Retains preferred promotion form hints after numeric carry is applied between stages. */
export function retainPromotionFormHints(
  carryIncrement: EnPassantCarryMap,
): EnPassantCarryMap {
  const next: EnPassantCarryMap = {}
  for (const [id, bonus] of Object.entries(carryIncrement)) {
    if (bonus.fromForm) {
      next[id] = { apBonus: 0, hpBonus: 0, fromForm: bonus.fromForm }
    }
  }
  return next
}

/**
 * Strips super-promotion overlays (prestige reset) while keeping pawn upgrade levels.
 */
export function stripStageScopedPromotions(pieces: ChessPiece[]): ChessPiece[] {
  return pieces.map((piece) => {
    if (!piece.superPromotion) return { ...piece, promotionHold: false }
    const base = buildPieceStats(piece.kind, piece.upgradeLevels)
    return {
      ...piece,
      superPromotion: undefined,
      promotionHold: false,
      stats: {
        ...base,
        hp: Math.min(base.maxHp, piece.stats.hp),
      },
    }
  })
}

/**
 * Applies super-promotion plus any En Passant carry for this pawn instance.
 */
export function applySuperPromotionWithCarry(
  piece: ChessPiece,
  form: SuperPromotionForm,
  masteryLevel: number,
  carry?: EnPassantCarryBonus,
): ChessPiece {
  let promoted = applySuperPromotion(piece, form, masteryLevel)
  if (!carry || (carry.apBonus <= 0 && carry.hpBonus <= 0)) return promoted

  const ap = promoted.stats.ap + carry.apBonus
  const maxHp = promoted.stats.maxHp + carry.hpBonus
  return {
    ...promoted,
    stats: {
      ...promoted.stats,
      ap,
      maxHp,
      hp: Math.min(maxHp, promoted.stats.hp + carry.hpBonus),
    },
    superPromotion: promoted.superPromotion
      ? {
          ...promoted.superPromotion,
          apMult: promoted.superPromotion.apMult + carry.apBonus / Math.max(1, piece.stats.ap),
          hpMult: promoted.superPromotion.hpMult + carry.hpBonus / Math.max(1, piece.stats.maxHp),
        }
      : promoted.superPromotion,
  }
}

/** Headless sanity: carry scales with rank. */
export function runEnPassantEconomySanityCheck(): { passed: boolean; messages: string[] } {
  const messages: string[] = []
  let passed = true
  const assert = (label: string, ok: boolean) => {
    messages.push(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
    if (!ok) passed = false
  }

  assert('rank 0 is 0%', getEnPassantCarryPercent(0) === 0)
  assert('rank 1 is 25%', getEnPassantCarryPercent(1) === 0.25)
  assert('rank 5 caps 125%', getEnPassantCarryPercent(5) === 1.25)

  return { passed, messages }
}
