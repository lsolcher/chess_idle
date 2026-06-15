import type { ChessPiece, PieceKind, PieceSide, SuperPromotionForm } from '@/types/game'

/**
 * Canonical chess piece symbols — primary silhouette layer (see `chessIdentity.ts`).
 * Fantasy skins must not replace these glyphs without passing silhouette QA.
 */

/** Standard chessboard Unicode symbols (white / black sets). */
export const CHESS_GLYPH_BY_KIND: Record<
  PieceKind,
  { player: string; enemy: string }
> = {
  king: { player: '♔', enemy: '♚' },
  pawn: { player: '♙', enemy: '♟' },
  knight: { player: '♘', enemy: '♞' },
  bishop: { player: '♗', enemy: '♝' },
  rook: { player: '♖', enemy: '♜' },
  queen: { player: '♛', enemy: '♛' },
}

const SUPER_PROMOTION_GLYPH: Record<SuperPromotionForm, string> = {
  'super-knight': '♘',
  'super-bishop': '♗',
  'super-rook': '♖',
  'super-queen': '♛',
}

export function chessGlyph(kind: PieceKind, side: PieceSide): string {
  return CHESS_GLYPH_BY_KIND[kind][side]
}

/** Glyph shown on board, roster, and turn order — always regular chess piece symbols. */
export function chessGlyphForPiece(piece: ChessPiece): string {
  if (piece.superPromotion) {
    return SUPER_PROMOTION_GLYPH[piece.superPromotion.form]
  }
  return chessGlyph(piece.kind, piece.side)
}
