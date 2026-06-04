/**
 * Immortal Game meta — once per stage, first friendly death revives at 30% HP (GDD §2.5).
 * Revival Flash grants +50% AP for the next 3 actions on that piece.
 */
import type { ChessPiece } from '@/types/game'

const REVIVE_HP_RATIO = 0.3
const INVULNERABILITY_MS = 1_000

/** GDD Revival Flash: +50% AP for this many player actions. */
export const REVIVAL_FLASH_ACTIONS = 3

export const REVIVAL_FLASH_AP_MULT = 1.5

export interface RevivalFlashState {
  actionsRemaining: number
}

/**
 * If a player piece was removed by lethal capture, restore it at 30% max HP on its prior square.
 */
export function tryImmortalRevive(
  playerPiecesBefore: ChessPiece[],
  playerPiecesAfter: ChessPiece[],
  capturedPlayerId: string | undefined,
  hasImmortalMeta: boolean,
  immortalUsedThisStage: boolean,
  nowMs: number,
): { pieces: ChessPiece[]; used: boolean } {
  if (!hasImmortalMeta || immortalUsedThisStage || !capturedPlayerId) {
    return { pieces: playerPiecesAfter, used: false }
  }

  const lost = playerPiecesBefore.find((p) => p.id === capturedPlayerId)
  if (!lost || playerPiecesAfter.some((p) => p.id === capturedPlayerId)) {
    return { pieces: playerPiecesAfter, used: false }
  }

  const reviveHp = Math.max(1, Math.floor(lost.stats.maxHp * REVIVE_HP_RATIO))
  const revived: ChessPiece = {
    ...lost,
    stats: { ...lost.stats, hp: reviveHp, maxHp: lost.stats.maxHp },
    revivalFlash: { actionsRemaining: REVIVAL_FLASH_ACTIONS },
    invulnerableUntilMs: nowMs + INVULNERABILITY_MS,
  }

  return {
    pieces: [...playerPiecesAfter, revived],
    used: true,
  }
}

/** Applies Revival Flash AP bonus when the piece still has charges. */
export function getRevivalFlashApMult(piece: ChessPiece | undefined): number {
  if (!piece?.revivalFlash || piece.revivalFlash.actionsRemaining <= 0) return 1
  return REVIVAL_FLASH_AP_MULT
}

/** Consumes one Revival Flash action after the piece acts. */
export function consumeRevivalFlashAction(piece: ChessPiece): ChessPiece {
  if (!piece.revivalFlash || piece.revivalFlash.actionsRemaining <= 0) return piece
  const remaining = piece.revivalFlash.actionsRemaining - 1
  if (remaining <= 0) {
    const { revivalFlash: _removed, ...rest } = piece
    return rest as ChessPiece
  }
  return {
    ...piece,
    revivalFlash: { actionsRemaining: remaining },
  }
}

/** Blocks lethal removal while invulnerability window is active (GDD §2.5). */
export function isPieceInvulnerable(piece: ChessPiece, nowMs: number): boolean {
  return typeof piece.invulnerableUntilMs === 'number' && nowMs < piece.invulnerableUntilMs
}
