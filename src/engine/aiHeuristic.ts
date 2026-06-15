/**
 * Auto-AI move scoring heuristic (GDD §1.6).
 * Evaluates legal moves for a single piece when its initiative bar fills.
 */
import {
  centralControlWeight,
  findKing,
  manhattanDistance,
  promotionProgress,
} from './board'
import { generateLegalMoves, isSquareAttacked, type BoardMove, type MoveContext } from './moves'
import { getMovementKind } from './pieceMovement'
import {
  calculateDamageDealt,
  createPiece,
  PIECE_DEFINITIONS,
  type AutoAiPersonality,
  type ChessPiece,
} from '@/types/game'

/** GDD base weights — personality scales select terms. */
export const AI_WEIGHTS = {
  capture: 6.0,
  promotionPath: 4.0,
  check: 3.0,
  damageRatio: 2.0,
  threatRemoved: 1.5,
  centralControl: 1.0,
  protectKing: 0.8,
  mobility: 0.5,
  exposeKing: -2.0,
  intoAttack: -1.5,
} as const

/** Royal Decree solo-King overrides — closes on pawns without threat paralysis (GDD §1.2). */
export const DECREE_SOLO_KING_WEIGHTS = {
  advanceTowardEnemy: 5.0,
  pawnApproachSquare: 8.0,
  nextTurnCaptureSetup: 6.0,
} as const

/** Wave idle combat vs Arena ghost PvP heuristic profile (Phase 8.8). */
export type AiCombatMode = 'wave' | 'pvpGhost'

export interface AiScoreContext extends MoveContext {
  personality: AutoAiPersonality
  movingPiece: ChessPiece
  /** True when Royal Decree is active for this decision. */
  royalDecreeActive?: boolean
  /** Tablebase Memory meta multiplier on final scores (default 1). */
  aiScoreMult?: number
  /** `pvpGhost` prioritizes King shelter over pawn marching (Arena). */
  combatMode?: AiCombatMode
}

/** Arena ghost overrides — protect King over tempo (GDD §9 / Phase 8.8). */
export const PVP_GHOST_WEIGHTS = {
  protectKing: 5.0,
  kingShelter: 4.0,
  kingRetreat: 3.5,
  blockThreatLane: 2.5,
  pawnAdvance: -5.0,
  aggressiveCapture: 2.0,
  exposeKing: -5.0,
} as const

export interface ScoredMove {
  move: BoardMove
  score: number
}

function pieceMaterialValue(kind: ChessPiece['kind']): number {
  return PIECE_DEFINITIONS[kind].captureValue
}

export interface PersonalityScales {
  capture: number
  protectKing: number
  damageRatio: number
  intoAttack: number
  engagement: number
}

/** Per-strategy multipliers on GDD heuristic terms. */
export function personalityScale(personality: AutoAiPersonality): PersonalityScales {
  switch (personality) {
    case 'aggressive':
      return {
        capture: 1.35,
        protectKing: 0.55,
        damageRatio: 1.15,
        intoAttack: 0.75,
        engagement: 1.35,
      }
    case 'protectKing':
      return {
        capture: 0.9,
        protectKing: 2.2,
        damageRatio: 0.95,
        intoAttack: 1.35,
        engagement: 0.85,
      }
    case 'defensive':
      return {
        capture: 0.88,
        protectKing: 1.35,
        damageRatio: 0.92,
        intoAttack: 1.45,
        engagement: 1.05,
      }
  }
}

function livingEnemyCount(ctx: AiScoreContext): number {
  return ctx.allPieces.filter(
    (piece) => piece.side === 'enemy' && piece.stats.hp > 0,
  ).length
}

/** Low top scores — likely pacing stalemate (opposite pawns, idle king). */
export function shouldApplyStalemateBreak(
  ranked: ScoredMove[],
  livingEnemies = 1,
): boolean {
  if (ranked.length === 0) return false
  if (livingEnemies === 1) return true
  const top = ranked[0]!.score
  if (top >= 3) return false
  if (ranked[0]!.move.isCapture) return false
  const hasCapture = ranked.some((entry) => entry.move.isCapture && entry.score >= 2)
  if (hasCapture) return false
  return top < 1.85
}

/**
 * Progress toward contact when captures/checks are unavailable (breaks pawn stare-downs).
 */
export function scoreEngagementBonus(move: BoardMove, ctx: AiScoreContext): number {
  const enemies = enemyPieces(ctx)
  if (enemies.length === 0) return 0

  const scale = personalityScale(ctx.personality)
  let bonus = 0

  const minBefore = Math.min(...enemies.map((e) => manhattanDistance(move.from, e.position)))
  const minAfter = Math.min(...enemies.map((e) => manhattanDistance(move.to, e.position)))
  if (minAfter < minBefore) {
    bonus += 2.2 * scale.engagement
  }

  if (ctx.movingPiece.kind === 'pawn' && move.side === 'player' && move.to.rank > move.from.rank) {
    const blockedFile = enemies.some(
      (enemy) =>
        enemy.position.file === move.to.file && enemy.position.rank > move.from.rank,
    )
    if (blockedFile) bonus += 3.5 * scale.engagement
  }

  if (ctx.movingPiece.kind === 'pawn' && move.to.file !== move.from.file) {
    for (const enemy of enemies) {
      if (enemy.kind !== 'pawn') continue
      const onDiagonalNext =
        Math.abs(move.to.file - enemy.position.file) === 1 &&
        move.to.rank + 1 === enemy.position.rank
      if (onDiagonalNext) bonus += 2.5 * scale.engagement
    }
  }

  if (ctx.movingPiece.kind === 'king' && !move.isCapture && minAfter < minBefore) {
    bonus += 2.8 * scale.engagement
  }

  if (livingEnemyCount(ctx) === 1) {
    bonus += 3.5 * scale.engagement
    if (move.isCapture) bonus += 4
  }

  return bonus
}

function wouldGiveCheck(move: BoardMove, ctx: AiScoreContext): boolean {
  const enemyKing = findKing(ctx.allPieces, 'enemy')
  if (!enemyKing) return false
  return move.to.file === enemyKing.position.file && move.to.rank === enemyKing.position.rank
}

/** Simplified threat removal: capture on a square that attacks our king. */
function isThreatRemoved(move: BoardMove, ctx: AiScoreContext): boolean {
  if (!move.isCapture || !move.capturedPieceId) return false
  const playerKing = findKing(ctx.allPieces, 'player')
  if (!playerKing) return false
  const captured = ctx.allPieces.find((piece) => piece.id === move.capturedPieceId)
  if (!captured) return false
  return isSquareAttacked(playerKing.position, [captured], 'player')
}

function countPlayerPieces(ctx: AiScoreContext): number {
  return ctx.allPieces.filter((piece) => piece.side === 'player').length
}

/** Solo King under Royal Decree — only friendly on board is the King. */
export function isSoloDecreeKing(ctx: AiScoreContext): boolean {
  return (
    ctx.royalDecreeActive === true &&
    ctx.movingPiece.side === 'player' &&
    ctx.movingPiece.kind === 'king' &&
    countPlayerPieces(ctx) === 1
  )
}

function enemyPieces(ctx: AiScoreContext): ChessPiece[] {
  return ctx.allPieces.filter((piece) => piece.side === 'enemy')
}

function nearestEnemyDistance(from: BoardMove['from'], ctx: AiScoreContext): number {
  const enemies = enemyPieces(ctx)
  if (enemies.length === 0) return 99
  return Math.min(...enemies.map((e) => manhattanDistance(from, e.position)))
}

/** Friendly pawn with an enemy pawn directly ahead on the same file (frontline screen). */
export function findHeadOnPawnScreen(
  allPieces: ChessPiece[],
  side: ChessPiece['side'] = 'player',
): { friendly: ChessPiece; enemy: ChessPiece } | null {
  const forward = side === 'player' ? 1 : -1
  for (const friendly of allPieces) {
    if (friendly.side !== side || friendly.kind !== 'pawn' || friendly.stats.hp <= 0) continue
    const enemy = allPieces.find(
      (piece) =>
        piece.side !== side &&
        piece.kind === 'pawn' &&
        piece.stats.hp > 0 &&
        piece.position.file === friendly.position.file &&
        piece.position.rank === friendly.position.rank + forward,
    )
    if (enemy) return { friendly, enemy }
  }
  return null
}

function scoreKingPawnScreenBreak(move: BoardMove, ctx: AiScoreContext): number {
  if (ctx.movingPiece.kind !== 'king' || ctx.movingPiece.side !== 'player') return 0

  const screen = findHeadOnPawnScreen(ctx.allPieces, 'player')
  if (!screen) return 0

  const { enemy } = screen
  let bonus = 0

  if (move.isCapture && move.capturedPieceId === enemy.id) {
    return 8.0
  }

  const distBefore = manhattanDistance(move.from, enemy.position)
  const distAfter = manhattanDistance(move.to, enemy.position)
  if (distAfter < distBefore) {
    bonus += 4.5
  }

  if (isPawnApproachSquare(move.to, enemy, 'player')) {
    bonus += 5.5
  }

  if (setsUpPawnCapture(move, ctx)) {
    bonus += 5.0
  }

  if (move.to.rank > move.from.rank) {
    bonus += 2.0
  }

  return bonus
}

/**
 * Square one rank toward the player King on the same file as an enemy pawn.
 * Pawns only attack diagonally, so this file is decree-safe for approach (GDD §1.2).
 */
export function isPawnApproachSquare(
  to: BoardMove['to'],
  pawn: ChessPiece,
  kingSide: ChessPiece['side'] = 'player',
): boolean {
  if (pawn.kind !== 'pawn' || pawn.side === kingSide) return false
  if (to.file !== pawn.position.file) return false
  const approachRank = kingSide === 'player' ? pawn.position.rank - 1 : pawn.position.rank + 1
  return to.rank === approachRank
}

/** King ends adjacent to an enemy pawn (capture available next initiative). */
function setsUpPawnCapture(move: BoardMove, ctx: AiScoreContext): boolean {
  if (move.side !== 'player' || move.isCapture) return false
  for (const enemy of enemyPieces(ctx)) {
    if (enemy.kind !== 'pawn') continue
    const dist = manhattanDistance(move.to, enemy.position)
    if (dist === 1 && move.to.file !== enemy.position.file) return true
  }
  return false
}

/**
 * PvP ghost modifiers — layered on base `scoreMove` when `combatMode === 'pvpGhost'`.
 */
export function scorePvpGhostModifiers(move: BoardMove, ctx: AiScoreContext): number {
  const playerKing = findKing(ctx.allPieces, 'player')
  if (!playerKing) return 0

  let bonus = 0
  const scale = personalityScale('protectKing')

  if (move.pieceId !== playerKing.id && move.side === 'player') {
    const distBefore = manhattanDistance(move.from, playerKing.position)
    const distAfter = manhattanDistance(move.to, playerKing.position)
    if (distAfter < distBefore) {
      bonus += PVP_GHOST_WEIGHTS.protectKing * scale.protectKing
    }
    if (distAfter <= 2 && !move.isCapture) {
      bonus += PVP_GHOST_WEIGHTS.kingShelter
    }
    const nearestEnemyBefore = nearestEnemyDistance(move.from, ctx)
    const nearestEnemyAfter = nearestEnemyDistance(move.to, ctx)
    if (
      nearestEnemyAfter < nearestEnemyBefore &&
      distAfter <= 3 &&
      move.pieceId !== playerKing.id
    ) {
      bonus += PVP_GHOST_WEIGHTS.blockThreatLane
    }
  }

  if (move.pieceId === playerKing.id && !move.isCapture) {
    const nearestBefore = nearestEnemyDistance(move.from, ctx)
    const nearestAfter = nearestEnemyDistance(move.to, ctx)
    if (nearestAfter > nearestBefore) {
      bonus += PVP_GHOST_WEIGHTS.kingRetreat
    }
    const friendlyCount = ctx.allPieces.filter(
      (p) => p.side === 'player' && p.stats.hp > 0 && p.id !== playerKing.id,
    ).length
    if (friendlyCount > 0) {
      const avgDistBefore =
        ctx.allPieces
          .filter((p) => p.side === 'player' && p.id !== playerKing.id && p.stats.hp > 0)
          .reduce((sum, p) => sum + manhattanDistance(move.from, p.position), 0) /
        friendlyCount
      const avgDistAfter =
        ctx.allPieces
          .filter((p) => p.side === 'player' && p.id !== playerKing.id && p.stats.hp > 0)
          .reduce((sum, p) => sum + manhattanDistance(move.to, p.position), 0) / friendlyCount
      if (avgDistAfter < avgDistBefore) {
        bonus += PVP_GHOST_WEIGHTS.kingShelter * 0.5
      }
    }
  }

  if (
    ctx.movingPiece.kind === 'pawn' &&
    move.side === 'player' &&
    !move.isCapture &&
    move.to.rank > move.from.rank
  ) {
    bonus += PVP_GHOST_WEIGHTS.pawnAdvance
  }

  if (move.isCapture) {
    bonus += PVP_GHOST_WEIGHTS.aggressiveCapture * 0.5
  }

  if (exposesKing(move, ctx)) {
    bonus += PVP_GHOST_WEIGHTS.exposeKing
  }

  return bonus
}

function exposesKing(move: BoardMove, ctx: AiScoreContext): boolean {
  const playerKing = findKing(ctx.allPieces, 'player')
  if (!playerKing || move.pieceId === playerKing.id) return false

  const simulated = ctx.allPieces.map((piece) =>
    piece.id === move.pieceId ? { ...piece, position: { ...move.to } } : piece,
  )
  return isSquareAttacked(playerKing.position, simulated, 'player')
}

/**
 * Computes heuristic score for one candidate move.
 * @see gdd.md §1.6 for formula structure.
 */
export function scoreMove(move: BoardMove, ctx: AiScoreContext): number {
  const scale = personalityScale(ctx.personality)
  let score = 0

  if (move.isCapture) {
    score += AI_WEIGHTS.capture * scale.capture
    const target = ctx.allPieces.find((piece) => piece.id === move.capturedPieceId)
    if (target) {
      const damage = calculateDamageDealt(ctx.movingPiece.stats.ap, target.stats.def)
      score += AI_WEIGHTS.damageRatio * scale.damageRatio * (damage / target.stats.maxHp)
    }
  }

  if (!ctx.movingPiece.superPromotion) {
    if (ctx.movingPiece.kind === 'pawn' || getMovementKind(ctx.movingPiece) === 'pawn') {
      const before = promotionProgress(move.from, move.side)
      const after = promotionProgress(move.to, move.side)
      if (after > before) {
        score += AI_WEIGHTS.promotionPath * (after - before)
      }
    }
  } else {
    const form = ctx.movingPiece.superPromotion.form
    if (form === 'super-queen') {
      score += AI_WEIGHTS.capture * 0.35 * scale.capture
      score += AI_WEIGHTS.centralControl * 1.2
    }
    if (form === 'super-knight') {
      if (move.isCapture) score += 1.5
      score += AI_WEIGHTS.mobility * 0.4
    }
    if (form === 'super-bishop' && move.isCapture) {
      score += 1.2
    }
    if (form === 'super-rook') {
      if (move.isCapture) score += 2.5
      else if (move.from.file === move.to.file || move.from.rank === move.to.rank) {
        score += 0.8
      } else {
        score -= 0.6
      }
    }
  }

  if (ctx.movingPiece.superPromotion?.traits.lineSlam && move.isCapture) {
    score += 2.0
  }

  if (wouldGiveCheck(move, ctx)) {
    score += AI_WEIGHTS.check
  }

  if (isThreatRemoved(move, ctx)) {
    score += AI_WEIGHTS.threatRemoved
  }

  score += AI_WEIGHTS.centralControl * centralControlWeight(move.to)

  const playerKing = findKing(ctx.allPieces, 'player')
  if (playerKing && move.pieceId !== playerKing.id) {
    const distBefore = manhattanDistance(move.from, playerKing.position)
    const distAfter = manhattanDistance(move.to, playerKing.position)
    if (distAfter < distBefore) {
      score += AI_WEIGHTS.protectKing * scale.protectKing
    }
    if (ctx.personality === 'protectKing' && distAfter <= 2) {
      score += AI_WEIGHTS.protectKing * 0.5
    }
  }

  if (ctx.personality === 'protectKing' && playerKing && move.pieceId === playerKing.id) {
    const nearestEnemy = Math.min(
      ...enemyPieces(ctx).map((enemy) => manhattanDistance(move.to, enemy.position)),
    )
    if (nearestEnemy <= 2 && !move.isCapture) {
      score -= 1.2
    }
  }

  const mobility = generateLegalMoves(ctx.movingPiece, ctx).length
  score += AI_WEIGHTS.mobility * (mobility / 8)

  if (exposesKing(move, ctx)) {
    score += AI_WEIGHTS.exposeKing
  }

  const soloDecreeKing = isSoloDecreeKing(ctx)
  let waiveIntoAttack = move.isCapture

  const kingScreenBonus = scoreKingPawnScreenBreak(move, ctx)
  score += kingScreenBonus
  if (kingScreenBonus > 0) {
    waiveIntoAttack = true
  }

  if (soloDecreeKing) {
    const distBefore = nearestEnemyDistance(move.from, ctx)
    const distAfter = nearestEnemyDistance(move.to, ctx)
    if (distAfter < distBefore) {
      score += DECREE_SOLO_KING_WEIGHTS.advanceTowardEnemy
    }

    for (const enemy of enemyPieces(ctx)) {
      if (enemy.kind === 'pawn' && isPawnApproachSquare(move.to, enemy, 'player')) {
        score += DECREE_SOLO_KING_WEIGHTS.pawnApproachSquare
        waiveIntoAttack = true
      }
    }

    if (setsUpPawnCapture(move, ctx)) {
      score += DECREE_SOLO_KING_WEIGHTS.nextTurnCaptureSetup
    }

    if (move.isCapture) {
      waiveIntoAttack = true
    }
  }

  if (
    !waiveIntoAttack &&
    isSquareAttacked(move.to, ctx.allPieces, move.side) &&
    !(move.isCapture && scale.capture > 1)
  ) {
    score += AI_WEIGHTS.intoAttack * scale.intoAttack
  }

  if (ctx.combatMode === 'pvpGhost') {
    score += scorePvpGhostModifiers(move, ctx)
    const pawnAdvancePenalty =
      ctx.movingPiece.kind === 'pawn' &&
      move.side === 'player' &&
      !move.isCapture &&
      move.to.rank > move.from.rank
    if (pawnAdvancePenalty) {
      score += scoreEngagementBonus(move, ctx) * 0.15
    } else {
      score += scoreEngagementBonus(move, ctx) * 0.35
    }
  } else {
    score += scoreEngagementBonus(move, ctx) * 0.4
  }

  const accuracy = ctx.aiScoreMult && ctx.aiScoreMult > 0 ? ctx.aiScoreMult : 1
  return score * accuracy
}

/** Scores all legal moves for the acting piece and returns ranked list. */
export function scoreAllMoves(piece: ChessPiece, ctx: AiScoreContext): ScoredMove[] {
  const moves = generateLegalMoves(piece, ctx)
  return moves
    .map((move) => ({ move, score: scoreMove(move, { ...ctx, movingPiece: piece }) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aVal = a.move.isCapture
        ? pieceMaterialValue(
            ctx.allPieces.find((p) => p.id === a.move.capturedPieceId)?.kind ?? 'pawn',
          )
        : 0
      const bVal = b.move.isCapture
        ? pieceMaterialValue(
            ctx.allPieces.find((p) => p.id === b.move.capturedPieceId)?.kind ?? 'pawn',
          )
        : 0
      return bVal - aVal
    })
}

function rankMovesWithOptionalStalemateBreak(
  piece: ChessPiece,
  ctx: AiScoreContext,
): ScoredMove[] {
  let ranked = scoreAllMoves(piece, ctx)
  if (!shouldApplyStalemateBreak(ranked, livingEnemyCount(ctx))) return ranked

  ranked = ranked
    .map((entry) => ({
      move: entry.move,
      score: entry.score + scoreEngagementBonus(entry.move, { ...ctx, movingPiece: piece }),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return 0
    })
  return ranked
}

function resolveAiContext(ctx: AiScoreContext): AiScoreContext {
  if (ctx.combatMode !== 'pvpGhost') return ctx
  return {
    ...ctx,
    personality: 'protectKing',
    royalDecreeActive: false,
  }
}

/** Picks the highest-scoring legal move, or null if none. */
export function selectBestMove(piece: ChessPiece, ctx: AiScoreContext): BoardMove | null {
  const effective = resolveAiContext(ctx)
  const ranked = rankMovesWithOptionalStalemateBreak(piece, effective)
  return ranked[0]?.move ?? null
}

/** Headless sanity check for AI scoring pipeline. */
export function runAiHeuristicSanityCheck(): { passed: boolean; messages: string[] } {
  const messages: string[] = []
  let passed = true
  const assert = (label: string, ok: boolean) => {
    messages.push(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
    if (!ok) passed = false
  }

  const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
  const pawn = createPiece('pp', 'pawn', 'player', { file: 4, rank: 1 })
  const enemy = createPiece('ep', 'pawn', 'enemy', { file: 5, rank: 2 })

  const allPieces = [king, pawn, enemy]
  const ctx: AiScoreContext = {
    allPieces,
    decreeStepEnabled: true,
    personality: 'defensive',
    movingPiece: pawn,
  }

  const best = selectBestMove(pawn, ctx)
  assert('pawn selects a legal move', best !== null)
  assert('capture moves score above idle when adjacent', best?.isCapture === true)

  return { passed, messages }
}
