/**
 * King fail telegraphing — explains *why* the wave ended (Phase 7.5 / GDD UX).
 */
import type { ChessPiece, KingFailAttribution, PieceKind } from '@/types/game'

const KIND_LABELS: Record<PieceKind, string> = {
  pawn: 'Pawn',
  knight: 'Knight',
  bishop: 'Bishop',
  rook: 'Rook',
  queen: 'Queen',
  king: 'King',
}

export function pieceKindLabel(kind: PieceKind): string {
  return KIND_LABELS[kind]
}

export function formatAttackerLabel(
  side: ChessPiece['side'],
  kind: PieceKind,
): string {
  const who = side === 'enemy' ? 'Enemy' : 'Friendly'
  return `${who} ${pieceKindLabel(kind)}`
}

/**
 * Builds the secondary line shown under the King fallen banner.
 */
export function formatKingFailTelegraph(
  attribution: KingFailAttribution | null,
  detail: 'missing' | 'defeated' | null,
  leakDamage: number,
): string {
  if (attribution?.source === 'timeout') {
    return 'Cause: Boss wave timer expired (180s + meta extensions).'
  }
  if (attribution?.source === 'stall') {
    return 'Cause: Wave forfeited — enemies were not eliminated in time (avoidance / stall).'
  }
  if (attribution?.source === 'leak') {
    const dmg = attribution.leakDamage ?? leakDamage
    return `Cause: Enemy Pawn reached your back rank (leak −${dmg} King HP).`
  }
  if (attribution?.source === 'capture' && attribution.attackerKind) {
    const who = formatAttackerLabel(
      attribution.attackerSide ?? 'enemy',
      attribution.attackerKind,
    )
    return `Cause: ${who} captured your King.`
  }
  if (attribution?.source === 'damage' && attribution.attackerKind) {
    const who = formatAttackerLabel(
      attribution.attackerSide ?? 'enemy',
      attribution.attackerKind,
    )
    return `Cause: ${who} reduced your King to 0 HP.`
  }
  if (detail === 'missing') return 'Cause: Your King was removed from the board (capture).'
  if (detail === 'defeated') return 'Cause: Your King reached 0 HP.'
  return 'Cause: King eliminated this wave.'
}

/** Records who eliminated the King from a resolved enemy attack move. */
export function attributionFromEnemyMove(
  _move: { pieceId: string; capturedPieceId?: string },
  attacker: ChessPiece | undefined,
  capturedWasKing: boolean,
  kingDefeatedByDamage: boolean,
): KingFailAttribution | null {
  if (!capturedWasKing && !kingDefeatedByDamage) return null
  if (!attacker) {
    return capturedWasKing
      ? { source: 'capture' }
      : { source: 'damage' }
  }
  return {
    source: capturedWasKing ? 'capture' : 'damage',
    attackerKind: attacker.kind,
    attackerSide: attacker.side,
    attackerPieceId: attacker.id,
  }
}
