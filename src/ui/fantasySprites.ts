/**
 * Fantasy sprite sheet layout — Elves (player) vs Dwarves (enemy) on a chess-first 6×2 grid.
 *
 * ## Sheet spec (default)
 * - Cell: 64×64 px
 * - Columns (left → right): King, Queen, Rook, Bishop, Knight, Pawn
 * - Row 0: Elf faction (friendly / player)
 * - Row 1: Dwarf faction (enemy)
 * - Total minimum size: 384×128 px
 *
 * ## Frame naming when exporting from Aseprite/TexturePacker
 * `chess-silhouette-{kind}-{team}-v1.png` e.g. `chess-silhouette-rook-dwarf-v1.png`
 */
import type { ChessPiece, PieceKind, PieceSide } from '@/types/game'

/** Served from `/public/fantasy-chess-sprites.png` (copy your sheet there). */
export const FANTASY_SPRITE_SHEET_URL = '/fantasy-chess-sprites.png'

export const SPRITE_CELL_WIDTH = 64
export const SPRITE_CELL_HEIGHT = 64

export const SPRITE_COLUMNS = 6
export const SPRITE_ROWS = 2

export type FantasyTeam = 'elf' | 'dwarf'

/** Column index per piece kind (chess silhouette order). */
export const SPRITE_COLUMN_BY_KIND: Record<PieceKind, number> = {
  king: 0,
  queen: 1,
  rook: 2,
  bishop: 3,
  knight: 4,
  pawn: 5,
}

export const SPRITE_ROW_BY_TEAM: Record<FantasyTeam, number> = {
  elf: 0,
  dwarf: 1,
}

const KIND_ORDER: PieceKind[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']

export function sideToFantasyTeam(side: PieceSide): FantasyTeam {
  return side === 'player' ? 'elf' : 'dwarf'
}

export function normalizeFantasyTeam(team: FantasyTeam | string | undefined): FantasyTeam {
  if (team === 'dwarf' || team === 'Dwarf') return 'dwarf'
  return 'elf'
}

export function normalizePieceKind(type: PieceKind | string | undefined): PieceKind {
  const raw = (type ?? 'pawn').toString().toLowerCase()
  const found = KIND_ORDER.find((k) => k === raw)
  return found ?? 'pawn'
}

/** Display level 1–10 from upgrade tracks (progression glow). */
export function resolvePieceDisplayLevel(piece: ChessPiece): number {
  const { ap, hp, def, initiative } = piece.upgradeLevels
  const peak = Math.max(ap, hp, def, initiative)
  return Math.min(10, Math.max(1, peak))
}

export interface SpriteBackgroundPosition {
  backgroundPosition: string
  backgroundSize: string
}

export function getSpriteBackgroundPosition(
  kind: PieceKind,
  team: FantasyTeam,
): SpriteBackgroundPosition {
  const col = SPRITE_COLUMN_BY_KIND[kind]
  const row = SPRITE_ROW_BY_TEAM[team]
  const x = col * SPRITE_CELL_WIDTH
  const y = row * SPRITE_CELL_HEIGHT
  const offsetPx = (n: number) => (n === 0 ? '0px' : `-${n}px`)
  return {
    backgroundPosition: `${offsetPx(x)} ${offsetPx(y)}`,
    backgroundSize: `${SPRITE_COLUMNS * SPRITE_CELL_WIDTH}px ${SPRITE_ROWS * SPRITE_CELL_HEIGHT}px`,
  }
}

export interface LevelGlowStyle {
  filter: string
  boxShadow: string
}

/** Level 1 = dim; level 10 = vibrant faction-colored glow. */
export function getLevelGlowStyle(level: number, team: FantasyTeam): LevelGlowStyle {
  const t = Math.min(10, Math.max(1, level)) / 10
  const blur = 2 + t * 12
  const spread = t * 3
  const alpha = 0.15 + t * 0.55

  if (team === 'elf') {
    const emerald = `rgba(52, 211, 153, ${alpha})`
    return {
      filter: `drop-shadow(0 0 ${blur}px ${emerald})`,
      boxShadow: `0 0 ${blur}px ${spread}px ${emerald}`,
    }
  }

  const gold = `rgba(250, 204, 21, ${alpha})`
  return {
    filter: `drop-shadow(0 0 ${blur}px ${gold})`,
    boxShadow: `0 0 ${blur}px ${spread}px ${gold}`,
  }
}

export function buildSpriteContainerStyle(
  kind: PieceKind,
  team: FantasyTeam,
  level: number,
): Record<string, string> {
  const pos = getSpriteBackgroundPosition(kind, team)
  const glow = getLevelGlowStyle(level, team)
  return {
    backgroundImage: `url(${FANTASY_SPRITE_SHEET_URL})`,
    backgroundPosition: pos.backgroundPosition,
    backgroundSize: pos.backgroundSize,
    backgroundRepeat: 'no-repeat',
    width: `${SPRITE_CELL_WIDTH}px`,
    height: `${SPRITE_CELL_HEIGHT}px`,
    filter: glow.filter,
    boxShadow: glow.boxShadow,
  }
}

/** Pipeline frame id for QA / asset manifests. */
export function spriteFrameId(kind: PieceKind, team: FantasyTeam): string {
  return `chess-silhouette-${kind}-${team}-v1`
}
