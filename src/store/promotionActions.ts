/**
 * Promotion store actions — extracted helpers to keep gameStore readable.
 */
import {
  applySuperPromotionWithCarry,
  type EnPassantCarryBonus,
} from '@/engine/enPassantEconomy'
import {
  calculatePromotionFanfareGold,
  getAvailablePromotionForms,
  incrementPromotionStreak,
  isPromotionTriggerSquare,
  resolvePromotionForPiece,
  selectAutoPromotionForm,
  shouldDelayPromotionOnBlock,
  type PromotionContext,
} from '@/engine/promotion'
import { calculateActiveMult, type ChessPiece, type SuperPromotionForm } from '@/types/game'

export function buildPromotionContext(state: {
  currentStage: number
  promotion: { masteryLevel: number }
  combo: { count: number }
  royalDecree: { isActive: boolean }
  autoMode: boolean
}): PromotionContext {
  return {
    stage: state.currentStage,
    masteryLevel: state.promotion.masteryLevel,
    activeMult: calculateActiveMult(state.combo.count),
    royalDecreeActive: state.royalDecree.isActive,
    autoMode: state.autoMode,
  }
}

export function updatePlayerPiece(
  pieces: ChessPiece[],
  pieceId: string,
  next: ChessPiece,
): ChessPiece[] {
  return pieces.map((piece) => (piece.id === pieceId ? next : piece))
}

function promoteWithOptionalCarry(
  piece: ChessPiece,
  form: SuperPromotionForm,
  masteryLevel: number,
  carry?: EnPassantCarryBonus,
): ChessPiece {
  return applySuperPromotionWithCarry(piece, form, masteryLevel, carry)
}

export function runPromotionPipeline(
  piece: ChessPiece,
  ctx: PromotionContext,
  enemyPieces: ChessPiece[],
  currentStreak: number,
  chosenForm?: SuperPromotionForm,
  enPassantCarry?: EnPassantCarryBonus,
): {
  piece: ChessPiece
  fanfareGold: number
  nextStreak: number
  pendingPlayerChoice: boolean
} {
  if (piece.promotionHold && isPromotionTriggerSquare(piece.position, piece.side)) {
    const form =
      chosenForm ??
      (ctx.autoMode
        ? selectAutoPromotionForm(
            piece,
            getAvailablePromotionForms(ctx.stage),
            enemyPieces,
            ctx.masteryLevel,
            enPassantCarry?.fromForm,
          )
        : undefined)

    if (!form) {
      return { piece, fanfareGold: 0, nextStreak: currentStreak, pendingPlayerChoice: true }
    }

    const promoted = promoteWithOptionalCarry(piece, form, ctx.masteryLevel, enPassantCarry)
    return {
      piece: promoted,
      fanfareGold: calculatePromotionFanfareGold(ctx),
      nextStreak: incrementPromotionStreak(currentStreak),
      pendingPlayerChoice: false,
    }
  }

  const autoForm =
    chosenForm ??
    (ctx.autoMode
      ? selectAutoPromotionForm(
          piece,
          getAvailablePromotionForms(ctx.stage),
          enemyPieces,
          ctx.masteryLevel,
          enPassantCarry?.fromForm,
        )
      : undefined)

  const result = resolvePromotionForPiece(piece, ctx, enemyPieces, autoForm)

  if (result.deferred) {
    return { piece: result.piece, fanfareGold: 0, nextStreak: currentStreak, pendingPlayerChoice: false }
  }

  if (result.promoted) {
    let promotedPiece = result.piece
    if (enPassantCarry && (enPassantCarry.apBonus > 0 || enPassantCarry.hpBonus > 0)) {
      const maxHp = promotedPiece.stats.maxHp + enPassantCarry.hpBonus
      promotedPiece = {
        ...promotedPiece,
        stats: {
          ...promotedPiece.stats,
          ap: promotedPiece.stats.ap + enPassantCarry.apBonus,
          maxHp,
          hp: Math.min(maxHp, promotedPiece.stats.hp + enPassantCarry.hpBonus),
        },
      }
    }
    return {
      piece: promotedPiece,
      fanfareGold: result.fanfareGold,
      nextStreak: incrementPromotionStreak(currentStreak),
      pendingPlayerChoice: false,
    }
  }

  if (
    !ctx.autoMode &&
    !chosenForm &&
    isPromotionTriggerSquare(piece.position, piece.side) &&
    !shouldDelayPromotionOnBlock(piece.position, ctx.stage, ctx.masteryLevel)
  ) {
    return { piece, fanfareGold: 0, nextStreak: currentStreak, pendingPlayerChoice: true }
  }

  return { piece, fanfareGold: 0, nextStreak: currentStreak, pendingPlayerChoice: false }
}
