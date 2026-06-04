/**
 * Resolves which chess movement rules apply to a piece (including super-promotions).
 */
import type { ChessPiece, PieceKind, SuperPromotionForm } from '@/types/game'

const SUPER_FORM_TO_KIND: Record<SuperPromotionForm, PieceKind> = {
  'super-knight': 'knight',
  'super-bishop': 'bishop',
  'super-rook': 'rook',
  'super-queen': 'queen',
}

/**
 * Super-pieces use their promoted form's move set until the stage ends (GDD §1.3).
 */
export function getMovementKind(piece: ChessPiece): PieceKind {
  if (piece.superPromotion) {
    return SUPER_FORM_TO_KIND[piece.superPromotion.form]
  }
  return piece.kind
}
