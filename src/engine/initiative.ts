/**
 * Event-driven piece initiative engine (GDD §1.5).
 * Replaces global tick polling — only pieces whose bars are full fire actions.
 */
import {
  calculateActionIntervalSec,
  createPiece,
  type ChessPiece,
  type PieceKind,
  type PieceSide,
} from '@/types/game'

/** One row in the manual/auto combat turn-order UI (GDD §1.5). */
export interface CombatTurnOrderEntry {
  id: string
  side: PieceSide
  kind: PieceKind
  progress: number
  nextActionAtMs: number
  isReady: boolean
  /** 1-based position in upcoming turn queue. */
  order: number
  isBoss: boolean
}

export interface InitiativeTickResult {
  actedPieceIds: string[]
  /** Wall-clock ms of the processed frame. */
  processedAtMs: number
}

/**
 * Returns action interval in milliseconds for a piece at current upgrade levels.
 */
export function getPieceIntervalMs(piece: ChessPiece, globalSpeedMult = 1): number {
  const sec = calculateActionIntervalSec(
    piece.initiative.baseIntervalSec,
    piece.upgradeLevels.initiative,
    globalSpeedMult,
  )
  return Math.max(100, sec * 1000)
}

/**
 * Computes 0–1 initiative bar fill based on elapsed time since last scheduled action.
 */
export function computeInitiativeProgress(
  piece: ChessPiece,
  nowMs: number,
  globalSpeedMult = 1,
): number {
  const intervalMs = getPieceIntervalMs(piece, globalSpeedMult)
  const cycleStartMs = piece.initiative.nextActionAtMs - intervalMs
  const elapsed = Math.max(0, nowMs - cycleStartMs)
  return Math.min(1, elapsed / intervalMs)
}

/** Syncs progress fields on all pieces for UI rings without executing actions. */
export function syncInitiativeProgress(
  pieces: ChessPiece[],
  nowMs: number,
  globalSpeedMult = 1,
): ChessPiece[] {
  return pieces.map((piece) => ({
    ...piece,
    initiative: {
      ...piece.initiative,
      progress: computeInitiativeProgress(piece, nowMs, globalSpeedMult),
    },
  }))
}

/**
 * Schedules the next action timestamp after a piece completes its turn.
 */
export function scheduleNextAction(
  piece: ChessPiece,
  nowMs: number,
  globalSpeedMult = 1,
): ChessPiece {
  const intervalMs = getPieceIntervalMs(piece, globalSpeedMult)
  return {
    ...piece,
    initiative: {
      ...piece.initiative,
      progress: 0,
      nextActionAtMs: nowMs + intervalMs,
    },
  }
}

/**
 * Initializes initiative timers when combat starts or pieces are deployed mid-run.
 */
export function bootstrapPieceInitiative(
  piece: ChessPiece,
  nowMs: number,
  globalSpeedMult = 1,
): ChessPiece {
  const intervalMs = getPieceIntervalMs(piece, globalSpeedMult)
  return {
    ...piece,
    initiative: {
      ...piece.initiative,
      progress: 0,
      nextActionAtMs: nowMs + intervalMs,
    },
  }
}

/**
 * Returns player piece ids whose bars are full without consuming their turn.
 * Used in manual mode to pause until the player picks a move.
 */
/** Piece ids with full initiative bars, in chronological order. */
export function getReadyPieceIds(pieces: ChessPiece[], nowMs: number): string[] {
  return pieces
    .filter((piece) => nowMs >= piece.initiative.nextActionAtMs)
    .sort((a, b) => a.initiative.nextActionAtMs - b.initiative.nextActionAtMs)
    .map((piece) => piece.id)
}

export function getReadyPlayerPieceIds(
  playerPieces: ChessPiece[],
  nowMs: number,
): string[] {
  return getReadyPieceIds(
    playerPieces.filter((piece) => piece.side === 'player'),
    nowMs,
  )
}

export function getReadyEnemyPieceIds(enemyPieces: ChessPiece[], nowMs: number): string[] {
  return getReadyPieceIds(
    enemyPieces.filter((piece) => piece.side === 'enemy'),
    nowMs,
  )
}

/**
 * Global initiative queue — player + enemy pieces sorted by next action time.
 */
export interface TurnOrderSpeedMults {
  player?: number
  enemy?: number
}

export function buildTurnOrderQueue(
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
  nowMs: number,
  globalSpeedMult = 1,
  speedMults?: TurnOrderSpeedMults,
): CombatTurnOrderEntry[] {
  const playerMult = speedMults?.player ?? globalSpeedMult
  const enemyMult = speedMults?.enemy ?? globalSpeedMult
  const synced = [
    ...syncInitiativeProgress(playerPieces, nowMs, playerMult),
    ...syncInitiativeProgress(enemyPieces, nowMs, enemyMult),
  ]
  return synced
    .sort((a, b) => a.initiative.nextActionAtMs - b.initiative.nextActionAtMs)
    .map((piece, index) => ({
      id: piece.id,
      side: piece.side,
      kind: piece.kind,
      progress: piece.initiative.progress,
      nextActionAtMs: piece.initiative.nextActionAtMs,
      isReady: nowMs >= piece.initiative.nextActionAtMs,
      order: index + 1,
      isBoss: Boolean(piece.isBoss),
    }))
}

/**
 * The single piece whose initiative bar is full and may act next (turn-based combat).
 */
export function getNextReadyActor(
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
  nowMs: number,
): ChessPiece | null {
  const ready = [...playerPieces, ...enemyPieces].filter(
    (piece) => nowMs >= piece.initiative.nextActionAtMs,
  )
  if (ready.length === 0) return null
  return ready.sort(
    (a, b) => a.initiative.nextActionAtMs - b.initiative.nextActionAtMs,
  )[0]!
}

/**
 * Processes all player pieces whose initiative bars are full, in chronological order.
 * Each action reschedules only that piece — no global turn clock.
 */
export function processReadyInitiativeActions(
  playerPieces: ChessPiece[],
  nowMs: number,
  globalSpeedMult = 1,
): InitiativeTickResult & { pieces: ChessPiece[] } {
  let pieces = [...playerPieces]
  const actedPieceIds: string[] = []

  const readyIds = getReadyPieceIds(pieces, nowMs)

  for (const id of readyIds) {
    const index = pieces.findIndex((piece) => piece.id === id)
    if (index === -1) continue
    actedPieceIds.push(id)
    pieces[index] = scheduleNextAction(pieces[index]!, nowMs, globalSpeedMult)
  }

  pieces = syncInitiativeProgress(pieces, nowMs, globalSpeedMult)

  return { pieces, actedPieceIds, processedAtMs: nowMs }
}

/**
 * Finds the soonest upcoming initiative event — used for offline catch-up stepping.
 */
export function getNextInitiativeEventMs(pieces: ChessPiece[]): number | null {
  const player = pieces.filter((piece) => piece.side === 'player')
  if (player.length === 0) return null
  return Math.min(...player.map((piece) => piece.initiative.nextActionAtMs))
}

/**
 * Headless fast-forward simulation — steps event clock without RAF.
 * Returns total actions fired and gold would-be events count.
 */
export function simulateInitiativeWindow(
  playerPieces: ChessPiece[],
  startMs: number,
  endMs: number,
  globalSpeedMult = 1,
  maxActions = 10_000,
): { pieces: ChessPiece[]; totalActions: number } {
  // Always re-bootstrap at startMs — createPiece() may use wall-clock timestamps.
  let pieces = playerPieces.map((piece) =>
    bootstrapPieceInitiative(piece, startMs, globalSpeedMult),
  )
  let cursor = startMs
  let totalActions = 0

  while (cursor <= endMs && totalActions < maxActions) {
    const nextEvent = getNextInitiativeEventMs(pieces)
    if (nextEvent === null || nextEvent > endMs) break

    cursor = nextEvent
    const result = processReadyInitiativeActions(pieces, cursor, globalSpeedMult)
    pieces = result.pieces
    totalActions += result.actedPieceIds.length
  }

  pieces = syncInitiativeProgress(pieces, endMs, globalSpeedMult)
  return { pieces, totalActions }
}

export function bootstrapPiecesForCombat(
  pieces: ChessPiece[],
  nowMs: number,
  globalSpeedMult = 1,
): ChessPiece[] {
  return pieces.map((piece) =>
    piece.initiative.nextActionAtMs <= nowMs
      ? bootstrapPieceInitiative(piece, nowMs, globalSpeedMult)
      : piece,
  )
}

/** CI sanity check for initiative timing math. */
export function runInitiativeEngineSanityCheck(nowMs = 0): {
  passed: boolean
  messages: string[]
} {
  const messages: string[] = []
  let passed = true
  const assert = (label: string, ok: boolean) => {
    messages.push(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
    if (!ok) passed = false
  }

  const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
  const bootstrapped = bootstrapPieceInitiative(king, nowMs, 1)
  const intervalMs = getPieceIntervalMs(king, 1)

  assert('king interval ~3000ms', intervalMs >= 2900 && intervalMs <= 3100)

  const atHalf = computeInitiativeProgress(bootstrapped, nowMs + intervalMs / 2, 1)
  assert('progress near 0.5 mid-cycle', atHalf > 0.45 && atHalf < 0.55)

  const result = processReadyInitiativeActions([bootstrapped], nowMs + intervalMs, 1)
  assert('king fires one action per interval', result.actedPieceIds.length === 1)

  const { totalActions } = simulateInitiativeWindow([bootstrapped], nowMs, nowMs + intervalMs * 5, 1)
  assert('five intervals ~ five actions', totalActions >= 4 && totalActions <= 6)

  return { passed, messages }
}
