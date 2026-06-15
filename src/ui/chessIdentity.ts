/**
 * Chess-first visual contract — fantasy chrome is secondary to piece recognition.
 *
 * ## Render layers (priority high → low)
 * 1. **Silhouette** — must read as a standard chess piece (♔♘♖… or future sprite with chess shape).
 * 2. **Fantasy accent** — palette, pedestal, HP bar, side tint (never replaces silhouette).
 * 3. **VFX** — victory glow, clash feedback, boss ring (never obscures the glyph).
 *
 * ## Sprite engine rule (when enabled later)
 * Each `PieceKind` maps to a fixed chess silhouette asset. Elven/Dwarven skins are
 * overlays on that silhouette — never generic fantasy creatures that hide rook vs bishop.
 */
import type { ChessPiece, PieceKind, PieceSide } from '@/types/game'
import { CHESS_GLYPH_BY_KIND, chessGlyph, chessGlyphForPiece } from '@/ui/chessGlyphs'

/** Human-readable silhouette requirement per kind (art brief + QA). */
export const CHESS_SILHOUETTE_REQUIREMENT: Record<PieceKind, string> = {
  king: 'Crown + cross — unmistakable king',
  queen: 'Coronet / queen crown — not a generic mage',
  rook: 'Castle turret — not a dwarf warrior blob',
  bishop: 'Mitre / bishop hat — not a cleric staff-only icon',
  knight: 'Horse head profile — not a wolf or rider-only sprite',
  pawn: 'Classic pawn stub — smallest rank silhouette',
}

export type ChessPieceRenderMode = 'glyph' | 'sprite'

/** Active production mode — Unicode glyphs until sprite sheet ships in `public/`. */
export const CHESS_PIECE_RENDER_MODE: ChessPieceRenderMode = 'glyph'

export const CHESS_FIRST_UI_TERMS = [
  'Promotion',
  'Rank',
  'File',
  'Check',
  'Capture',
  'Castle',
  'En passant',
  'Initiative',
] as const

/** Distinct standard symbols per kind (both sides may share queen glyph). */
export function distinctChessGlyphsByKind(): Record<PieceKind, string> {
  return {
    king: CHESS_GLYPH_BY_KIND.king.player,
    queen: CHESS_GLYPH_BY_KIND.queen.player,
    rook: CHESS_GLYPH_BY_KIND.rook.player,
    bishop: CHESS_GLYPH_BY_KIND.bishop.player,
    knight: CHESS_GLYPH_BY_KIND.knight.player,
    pawn: CHESS_GLYPH_BY_KIND.pawn.player,
  }
}

export function chessPieceAriaLabel(piece: ChessPiece): string {
  const side = piece.side === 'player' ? 'friendly' : 'enemy'
  const form = piece.superPromotion ? ` promoted ${piece.superPromotion.form}` : ''
  return `${piece.kind}${form}, ${side}`
}

/** QA gate for future bitmap/SVG sprites — shape must match kind, not fantasy faction. */
export function isChessSilhouetteRecognizable(kind: PieceKind, assetId: string): boolean {
  return assetId.startsWith(`chess-silhouette-${kind}-`)
}

export function resolvePieceDisplayGlyph(piece: ChessPiece): string {
  return chessGlyphForPiece(piece)
}

/** Minimal piece for roster / turn-order glyph rendering. */
export function chessPieceStub(kind: PieceKind, side: PieceSide): ChessPiece {
  return {
    id: `stub-${kind}-${side}`,
    kind,
    side,
    position: { file: 0, rank: 0 },
    stats: { hp: 1, maxHp: 1, ap: 1, def: 0 },
    initiative: { progress: 0, baseIntervalSec: 1, iniLevel: 0, nextActionAtMs: 0 },
    upgradeLevels: { ap: 0, hp: 0, def: 0, initiative: 0 },
  }
}

export function resolvePieceDisplayGlyphForKind(
  kind: PieceKind,
  side: PieceSide,
): string {
  return chessGlyph(kind, side)
}
