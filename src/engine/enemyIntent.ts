/**
 * Enemy Intent Ribbon — telegraphs upcoming initiative actors (Ludological Unification).
 */
import {
  buildTurnOrderQueue,
  type CombatTurnOrderEntry,
  type TurnOrderSpeedMults,
} from '@/engine/initiative'
import type { ChessPiece, PieceKind, PieceSide } from '@/types/game'

export const INTENT_TIMELINE_SIZE = 3

export type EnemyIntentKind = 'strike' | 'advance' | 'capture_setup' | 'boss'

export interface IntentTimelineEntry {
  pieceId: string
  side: PieceSide
  kind: PieceKind
  order: number
  etaMs: number
  isReady: boolean
  isBoss: boolean
  intentKind: EnemyIntentKind
}

function resolveEnemyIntentKind(kind: PieceKind, isBoss: boolean): EnemyIntentKind {
  if (isBoss) return 'boss'
  if (kind === 'knight' || kind === 'queen') return 'strike'
  if (kind === 'pawn') return 'advance'
  return 'capture_setup'
}

function toTimelineEntry(
  row: CombatTurnOrderEntry,
  nowMs: number,
): IntentTimelineEntry {
  return {
    pieceId: row.id,
    side: row.side,
    kind: row.kind,
    order: row.order,
    etaMs: Math.max(0, row.nextActionAtMs - nowMs),
    isReady: row.isReady,
    isBoss: row.isBoss,
    intentKind:
      row.side === 'enemy' ? resolveEnemyIntentKind(row.kind, row.isBoss) : 'advance',
  }
}

/**
 * Next N actors in the global initiative queue (GDD turn order).
 */
export function buildIntentTimeline(
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
  nowMs: number,
  globalSpeedMult = 1,
  speedMults?: TurnOrderSpeedMults,
  maxEntries = INTENT_TIMELINE_SIZE,
): IntentTimelineEntry[] {
  const queue = buildTurnOrderQueue(
    playerPieces,
    enemyPieces,
    nowMs,
    globalSpeedMult,
    speedMults,
  )
  return queue.slice(0, maxEntries).map((row) => toTimelineEntry(row, nowMs))
}

/** Enemy piece ids scheduled in the next N initiative slots (for tempo telegraph). */
export function getTelegraphedEnemyIds(
  timeline: readonly IntentTimelineEntry[],
): string[] {
  return timeline.filter((entry) => entry.side === 'enemy').map((entry) => entry.pieceId)
}

/** Primary telegraphed threat — first enemy in the timeline. */
export function getPrimaryTelegraphedEnemyId(
  timeline: readonly IntentTimelineEntry[],
): string | null {
  return timeline.find((entry) => entry.side === 'enemy')?.pieceId ?? null
}
