/**
 * Dynamic back-rank pawn promotion (GDD §1.3).
 * Super-piece stats persist across waves until death or prestige (GDD §1.3 army buildup).
 */
import {
  coordsEqual,
  PLAYER_PROMOTION_RANK,
  type BoardCoord,
} from './board'
import {
  calculateGoldCapture,
  createPiece,
  PROMOTION_FANFARE_CAPTURE_MULT,
  PROMOTION_MASTERY_STAT_BONUS,
  PROMOTION_MULTIPLIERS,
  PROMOTION_STREAK_CAP,
  PROMOTION_STREAK_GOLD_BONUS,
  PROMOTION_BLOCK_MIN_STAGE,
  QUEEN_PROMOTION_UNLOCK_STAGE,
  type ChessPiece,
  type SuperPromotionForm,
} from '@/types/game'

export interface PromotionContext {
  stage: number
  masteryLevel: number
  activeMult: number
  royalDecreeActive: boolean
  autoMode: boolean
}

export interface PromotionResolution {
  piece: ChessPiece
  fanfareGold: number
  streak: number
  promoted: boolean
  deferred: boolean
}

/** Player pawns promote on enemy back rank (rank 7). */
export function isPromotionTriggerSquare(coord: BoardCoord, side: ChessPiece['side']): boolean {
  return side === 'player' && coord.rank === PLAYER_PROMOTION_RANK
}

/** Block squares on back rank — stage 11+ (GDD §1.3 counterplay). */
export function getPromotionBlockSquares(stage: number): BoardCoord[] {
  if (stage < PROMOTION_BLOCK_MIN_STAGE) return []
  return [
    { file: 3, rank: PLAYER_PROMOTION_RANK },
    { file: 4, rank: PLAYER_PROMOTION_RANK },
    { file: 5, rank: PLAYER_PROMOTION_RANK },
  ]
}

export function isPromotionBlockSquare(coord: BoardCoord, stage: number): boolean {
  return getPromotionBlockSquares(stage).some((square) => coordsEqual(square, coord))
}

/**
 * Promotion Mastery bypasses block delay (GDD §1.3 upgrade vector).
 */
export function shouldDelayPromotionOnBlock(
  coord: BoardCoord,
  stage: number,
  masteryLevel: number,
): boolean {
  if (masteryLevel >= 1) return false
  return isPromotionBlockSquare(coord, stage)
}

/** Forms available this stage — Super-Queen locked until queen roster milestone. */
export function getAvailablePromotionForms(stage: number): SuperPromotionForm[] {
  const forms: SuperPromotionForm[] = ['super-knight', 'super-bishop', 'super-rook']
  if (stage >= QUEEN_PROMOTION_UNLOCK_STAGE) {
    forms.push('super-queen')
  }
  return forms
}

/** Tie-break when scores are close — prefer mobile burst forms over rook walls. */
const AUTO_PROMOTION_PRIORITY: SuperPromotionForm[] = [
  'super-queen',
  'super-bishop',
  'super-knight',
  'super-rook',
]

function autoPromotionPriority(form: SuperPromotionForm): number {
  const index = AUTO_PROMOTION_PRIORITY.indexOf(form)
  return index === -1 ? 0 : AUTO_PROMOTION_PRIORITY.length - index
}

function countEnemyKinds(
  enemyPieces: ChessPiece[],
  kinds: ChessPiece['kind'][],
): number {
  return enemyPieces.filter((enemy) => kinds.includes(enemy.kind)).length
}

/**
 * Auto-promotion form selection (GDD §1.3 / §4.1):
 * `Score = AP×1.2 + HP×0.5 + counterTagBonus`, queen-favored, wave-aware.
 */
export function selectAutoPromotionForm(
  pawn: ChessPiece,
  forms: SuperPromotionForm[],
  enemyPieces: ChessPiece[],
  masteryLevel: number,
  preferredForm?: SuperPromotionForm,
): SuperPromotionForm {
  if (preferredForm && forms.includes(preferredForm)) {
    return preferredForm
  }

  const enemiesOnBackRank = enemyPieces.filter(
    (enemy) => enemy.position.rank === PLAYER_PROMOTION_RANK,
  ).length
  const heavyPieces = countEnemyKinds(enemyPieces, ['rook', 'queen'])
  const swarm = enemyPieces.length

  let bestForm = forms[0] ?? 'super-knight'
  let bestScore = -Infinity
  let bestPriority = -1

  for (const form of forms) {
    const projected = projectSuperStats(pawn, form, masteryLevel)
    // Rook has the highest HP mult — down-weight raw stats so it is not the default.
    let score =
      form === 'super-rook'
        ? projected.ap * 1.1 + projected.maxHp * 0.38
        : projected.ap * 1.2 + projected.maxHp * 0.5

    switch (form) {
      case 'super-queen':
        // Default carry when unlocked (stage 45+); scales with board pressure.
        score += 14 + swarm * 1.5 + enemiesOnBackRank * 2
        break
      case 'super-bishop':
        score += swarm >= 3 ? 6 : 4
        break
      case 'super-knight':
        score += enemiesOnBackRank > 0 ? 7 : 3
        if (heavyPieces >= 2) score += 2
        break
      case 'super-rook':
        // Only favor rook vs queen when the enemy line is heavy and crowded.
        if (heavyPieces >= 2 && swarm >= 4) score += 10
        else score -= 12
        break
      default:
        break
    }

    const priority = autoPromotionPriority(form)
    if (
      score > bestScore + 0.01 ||
      (Math.abs(score - bestScore) <= 0.01 && priority > bestPriority)
    ) {
      bestScore = score
      bestForm = form
      bestPriority = priority
    }
  }

  return bestForm
}

/** Computes super-piece combat stats from pawn baseline × form mult × mastery. */
export function projectSuperStats(
  pawn: ChessPiece,
  form: SuperPromotionForm,
  masteryLevel: number,
): { ap: number; maxHp: number; hp: number } {
  const mult = PROMOTION_MULTIPLIERS[form]
  const masteryBonus = 1 + PROMOTION_MASTERY_STAT_BONUS * masteryLevel
  const ap = pawn.stats.ap * mult.apMult * masteryBonus
  const maxHp = pawn.stats.maxHp * mult.hpMult * masteryBonus
  return { ap, maxHp, hp: maxHp }
}

/** Applies transient super-piece overlay onto a promoted pawn. */
export function applySuperPromotion(
  piece: ChessPiece,
  form: SuperPromotionForm,
  masteryLevel: number,
): ChessPiece {
  const mult = PROMOTION_MULTIPLIERS[form]
  const masteryBonus = 1 + PROMOTION_MASTERY_STAT_BONUS * masteryLevel
  const stats = projectSuperStats(piece, form, masteryLevel)

  return {
    ...piece,
    promotionHold: false,
    stats: {
      ...piece.stats,
      ap: stats.ap,
      hp: stats.hp,
      maxHp: stats.maxHp,
    },
    superPromotion: {
      form,
      sourcePawnId: piece.id,
      apMult: mult.apMult * masteryBonus,
      hpMult: mult.hpMult * masteryBonus,
      traits: { ...mult.traits },
    },
  }
}

/** Fanfare burst: 3× pawn capture value (GDD §1.3). */
export function calculatePromotionFanfareGold(ctx: PromotionContext): number {
  return (
    calculateGoldCapture('pawn', ctx.stage, ctx.activeMult, ctx.royalDecreeActive) *
    PROMOTION_FANFARE_CAPTURE_MULT
  )
}

/** Stage gold multiplier from promotion streak stacks (cap 5). */
export function getPromotionStreakGoldMult(streak: number): number {
  const clamped = Math.max(0, Math.min(streak, PROMOTION_STREAK_CAP))
  return 1 + clamped * PROMOTION_STREAK_GOLD_BONUS
}

export function incrementPromotionStreak(currentStreak: number): number {
  return Math.min(currentStreak + 1, PROMOTION_STREAK_CAP)
}

/**
 * Resolves promotion after a pawn reaches (or holds on) the back rank.
 * Returns `deferred: true` when block square requires one-tick hold.
 */
export function resolvePromotionForPiece(
  piece: ChessPiece,
  ctx: PromotionContext,
  enemyPieces: ChessPiece[],
  chosenForm?: SuperPromotionForm,
): PromotionResolution {
  if (piece.kind !== 'pawn' || piece.side !== 'player') {
    return { piece, fanfareGold: 0, streak: 0, promoted: false, deferred: false }
  }

  if (piece.superPromotion) {
    return { piece, fanfareGold: 0, streak: 0, promoted: false, deferred: false }
  }

  if (!isPromotionTriggerSquare(piece.position, piece.side)) {
    return { piece, fanfareGold: 0, streak: 0, promoted: false, deferred: false }
  }

  if (piece.promotionHold) {
    const form =
      chosenForm ??
      (ctx.autoMode
        ? selectAutoPromotionForm(
            piece,
            getAvailablePromotionForms(ctx.stage),
            enemyPieces,
            ctx.masteryLevel,
          )
        : undefined)

    if (!form) {
      return { piece, fanfareGold: 0, streak: 0, promoted: false, deferred: false }
    }

    const promoted = applySuperPromotion(piece, form, ctx.masteryLevel)
    return {
      piece: promoted,
      fanfareGold: calculatePromotionFanfareGold(ctx),
      streak: incrementPromotionStreak(0),
      promoted: true,
      deferred: false,
    }
  }

  if (shouldDelayPromotionOnBlock(piece.position, ctx.stage, ctx.masteryLevel)) {
    return {
      piece: { ...piece, promotionHold: true },
      fanfareGold: 0,
      streak: 0,
      promoted: false,
      deferred: true,
    }
  }

  if (!ctx.autoMode && !chosenForm) {
    return { piece, fanfareGold: 0, streak: 0, promoted: false, deferred: false }
  }

  const form =
    chosenForm ??
    selectAutoPromotionForm(
      piece,
      getAvailablePromotionForms(ctx.stage),
      enemyPieces,
      ctx.masteryLevel,
    )

  const promoted = applySuperPromotion(piece, form, ctx.masteryLevel)
  return {
    piece: promoted,
    fanfareGold: calculatePromotionFanfareGold(ctx),
    streak: incrementPromotionStreak(0),
    promoted: true,
    deferred: false,
  }
}

/** Headless promotion pipeline check for CI. */
export function runPromotionEngineSanityCheck(): { passed: boolean; messages: string[] } {
  const messages: string[] = []
  let passed = true
  const assert = (label: string, ok: boolean) => {
    messages.push(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
    if (!ok) passed = false
  }

  const pawn = createPiece('p', 'pawn', 'player', { file: 4, rank: 7 })
  const ctx: PromotionContext = {
    stage: 1,
    masteryLevel: 0,
    activeMult: 1.5,
    royalDecreeActive: false,
    autoMode: true,
  }

  const result = resolvePromotionForPiece(pawn, ctx, [])
  assert('promotes on back rank', result.promoted)
  assert('fanfare gold granted', result.fanfareGold > 0)
  assert('super overlay attached', result.piece.superPromotion?.form !== undefined)
  assert('AP boosted above baseline', result.piece.stats.ap > pawn.stats.ap)

  const blockPawn = createPiece('bp', 'pawn', 'player', { file: 4, rank: 7 })
  const deferred = resolvePromotionForPiece(blockPawn, { ...ctx, stage: 15 }, [])
  assert(
    'block square defers at stage 15',
    deferred.deferred && Boolean(deferred.piece.promotionHold),
  )

  const held = { ...deferred.piece, promotionHold: true }
  const afterHold = resolvePromotionForPiece(held, { ...ctx, stage: 15 }, [])
  assert('promotes after hold tick', afterHold.promoted)

  assert('queen locked before stage 38', !getAvailablePromotionForms(10).includes('super-queen'))
  assert('queen unlocked at stage 38', getAvailablePromotionForms(38).includes('super-queen'))

  return { passed, messages }
}
