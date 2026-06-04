/**
 * Upgrade catalog and ROI scoring for the Upgrade Panel (GDD §2.3, §5.1).
 * ROI = marginal combat DPS (or click DPS) gained per gold spent.
 */
import {
  AUTO_ADVANCE_UNLOCK_STAGE,
  AUTO_ADVANCE_WAVE_COST,
} from '@/engine/waveAutomation'
import { CLICK_COOLDOWN_SEC, CLICK_POWER_BASE } from '@/engine/clickCombat'
import type { PieceShopOffer } from '@/engine/pieceShop'
import {
  calculateActionIntervalSec,
  calculateStatAtLevel,
  calculateUpgradeCost,
  createInitialGameState,
  getInitiativeUpgradeBaseCost,
  getStatUpgradeBaseCost,
  INITIATIVE_UPGRADE_CONFIG,
  PIECE_DEFINITIONS,
  PROMOTION_MASTERY_STAT_BONUS,
  STAT_UPGRADE_CONFIG,
  type ChessPiece,
  type PieceKind,
  type StatUpgradeTrack,
} from '@/types/game'

export type UpgradeTrackId =
  | StatUpgradeTrack
  | 'initiative'
  | 'clickPower'
  | 'promotionMastery'
  | 'autoAdvanceWaves'

export interface UpgradeOffer {
  id: string
  pieceId?: string
  pieceKind?: PieceKind
  track: UpgradeTrackId
  label: string
  cost: number
  currentLevel: number
  nextLevel: number
  maxLevel: number
  roiScore: number
  affordable: boolean
  preview: string
  isBestRoi?: boolean
}

export interface UpgradeCatalogInput {
  gold: number
  playerPieces: ChessPiece[]
  clickPowerLevel: number
  promotionMasteryLevel: number
  globalSpeedMult: number
  currentStage: number
  autoAdvanceWavesPurchased: boolean
}

export interface BestPurchasePick {
  id: string
  roiScore: number
  source: 'upgrade' | 'shop'
}

const TRACK_LABEL: Record<UpgradeTrackId, string> = {
  ap: 'Attack',
  hp: 'Durability',
  def: 'Defense',
  initiative: 'Initiative',
  clickPower: 'Click Power',
  promotionMastery: 'Promotion Mastery',
  autoAdvanceWaves: 'Auto-Advance Waves',
}

/** HP/DEF upgrades extend uptime — weighted fraction of current piece DPS. */
const HP_DPS_WEIGHT = 0.5
const DEF_DPS_WEIGHT = 0.4

/** Typical click context for ROI when combo/active state is unknown. */
const CLICK_ASSUMED_ACTIVE_MULT = 2
const CLICK_ASSUMED_PIECE_MULT = 3

const COMBAT_UPGRADE_TRACKS = new Set<UpgradeTrackId>([
  'ap',
  'hp',
  'def',
  'initiative',
  'clickPower',
  'promotionMastery',
])

/** Marginal action DPS for a piece at its current stats and INI level. */
export function estimatePieceActionDps(
  piece: ChessPiece,
  globalSpeedMult: number,
): number {
  const def = PIECE_DEFINITIONS[piece.kind]
  const interval = calculateActionIntervalSec(
    piece.initiative.baseIntervalSec ?? def.baseIntervalSec,
    piece.upgradeLevels.initiative,
    globalSpeedMult,
  )
  if (interval <= 0) return 0
  return piece.stats.ap / interval
}

/**
 * ROI proxy: marginal combat DPS gained divided by gold cost.
 * All tracks normalize to the same DPS/gold unit before comparison.
 */
export function calculateTrackRoi(
  piece: ChessPiece,
  track: StatUpgradeTrack | 'initiative',
  cost: number,
  globalSpeedMult: number,
): number {
  if (cost <= 0) return 0
  const def = PIECE_DEFINITIONS[piece.kind]
  const levels = piece.upgradeLevels
  const interval = calculateActionIntervalSec(
    def.baseIntervalSec,
    levels.initiative,
    globalSpeedMult,
  )
  if (interval <= 0) return 0

  const currentAp = piece.stats.ap

  switch (track) {
    case 'ap': {
      const cur = calculateStatAtLevel(def.baseAp, levels.ap)
      const next = calculateStatAtLevel(def.baseAp, levels.ap + 1)
      return (next - cur) / interval / cost
    }
    case 'hp': {
      const curMax = calculateStatAtLevel(def.baseHp, levels.hp)
      const nextMax = calculateStatAtLevel(def.baseHp, levels.hp + 1)
      const currentDps = currentAp / interval
      const marginalDps = currentDps * ((nextMax - curMax) / Math.max(curMax, 1)) * HP_DPS_WEIGHT
      return marginalDps / cost
    }
    case 'def': {
      const curDef = calculateStatAtLevel(def.baseDef, levels.def)
      const nextDef = calculateStatAtLevel(def.baseDef, levels.def + 1)
      const currentDps = currentAp / interval
      const marginalDps =
        currentDps * ((nextDef - curDef) / (curDef + 10)) * DEF_DPS_WEIGHT
      return marginalDps / cost
    }
    case 'initiative': {
      if (levels.initiative >= INITIATIVE_UPGRADE_CONFIG.maxLevel) return 0
      const after = calculateActionIntervalSec(
        def.baseIntervalSec,
        levels.initiative + 1,
        globalSpeedMult,
      )
      const marginalDps = currentAp * (1 / after - 1 / interval)
      return marginalDps / cost
    }
    default:
      return 0
  }
}

export function calculateClickPowerRoi(clickPowerLevel: number, cost: number): number {
  if (cost <= 0 || clickPowerLevel >= 30) return 0
  const cur = calculateStatAtLevel(CLICK_POWER_BASE, clickPowerLevel)
  const next = calculateStatAtLevel(CLICK_POWER_BASE, clickPowerLevel + 1)
  const deltaClickDps =
    (next - cur) *
    CLICK_ASSUMED_PIECE_MULT *
    CLICK_ASSUMED_ACTIVE_MULT /
    CLICK_COOLDOWN_SEC
  return deltaClickDps / cost
}

export function calculatePromotionMasteryRoi(
  playerPieces: ChessPiece[],
  cost: number,
  globalSpeedMult: number,
): number {
  if (cost <= 0) return 0

  let affectedDps = 0
  for (const piece of playerPieces.filter((p) => p.side === 'player')) {
    const dps = estimatePieceActionDps(piece, globalSpeedMult)
    if (piece.superPromotion) {
      affectedDps += dps
    } else if (piece.kind === 'pawn') {
      affectedDps += dps * 2.5 * 0.3
    }
  }

  return (affectedDps * PROMOTION_MASTERY_STAT_BONUS) / cost
}

/** New piece combat throughput at recruit (level-1 stats, INI 0). */
export function calculateRecruitRoi(
  kind: PieceKind,
  cost: number,
  globalSpeedMult: number,
): number {
  if (cost <= 0 || kind === 'king') return 0
  const def = PIECE_DEFINITIONS[kind]
  const ap = calculateStatAtLevel(def.baseAp, 1)
  const interval = calculateActionIntervalSec(def.baseIntervalSec, 0, globalSpeedMult)
  if (interval <= 0) return 0
  return ap / interval / cost
}

function pieceTrackOffer(
  piece: ChessPiece,
  track: StatUpgradeTrack | 'initiative',
  input: UpgradeCatalogInput,
): UpgradeOffer | null {
  const levels = piece.upgradeLevels
  const currentLevel = track === 'initiative' ? levels.initiative : levels[track]
  const maxLevel =
    track === 'initiative' ? INITIATIVE_UPGRADE_CONFIG.maxLevel : STAT_UPGRADE_CONFIG.maxLevel

  if (currentLevel >= maxLevel) return null

  const nextLevel = currentLevel + 1
  const baseCost =
    track === 'initiative'
      ? getInitiativeUpgradeBaseCost(piece.kind)
      : getStatUpgradeBaseCost(piece.kind)
  const growth =
    track === 'initiative' ? INITIATIVE_UPGRADE_CONFIG.growth : STAT_UPGRADE_CONFIG.growth
  const cost = calculateUpgradeCost(baseCost, growth, nextLevel)
  const roiScore = calculateTrackRoi(piece, track, cost, input.globalSpeedMult)

  const def = PIECE_DEFINITIONS[piece.kind]
  let preview = ''
  if (track === 'ap') {
    preview = `AP ${calculateStatAtLevel(def.baseAp, currentLevel).toFixed(1)} → ${calculateStatAtLevel(def.baseAp, nextLevel).toFixed(1)}`
  } else if (track === 'hp') {
    preview = `HP ${calculateStatAtLevel(def.baseHp, currentLevel).toFixed(0)} → ${calculateStatAtLevel(def.baseHp, nextLevel).toFixed(0)}`
  } else if (track === 'def') {
    preview = `DEF ${calculateStatAtLevel(def.baseDef, currentLevel).toFixed(1)} → ${calculateStatAtLevel(def.baseDef, nextLevel).toFixed(1)}`
  } else {
    const before = calculateActionIntervalSec(def.baseIntervalSec, currentLevel, input.globalSpeedMult)
    const after = calculateActionIntervalSec(def.baseIntervalSec, nextLevel, input.globalSpeedMult)
    preview = `${before.toFixed(2)}s → ${after.toFixed(2)}s`
  }

  return {
    id: `${piece.id}:${track}`,
    pieceId: piece.id,
    pieceKind: piece.kind,
    track,
    label: `${piece.kind} ${TRACK_LABEL[track]}`,
    cost,
    currentLevel,
    nextLevel,
    maxLevel,
    roiScore,
    affordable: input.gold >= cost,
    preview,
  }
}

/** Builds all purchasable offers for owned player pieces plus global tracks. */
export function buildUpgradeCatalog(input: UpgradeCatalogInput): UpgradeOffer[] {
  const offers: UpgradeOffer[] = []

  for (const piece of input.playerPieces.filter((p) => p.side === 'player')) {
    for (const track of ['ap', 'hp', 'def', 'initiative'] as const) {
      const offer = pieceTrackOffer(piece, track, input)
      if (offer) offers.push(offer)
    }
  }

  const clickNext = input.clickPowerLevel + 1
  const clickCost = calculateUpgradeCost(200, 1.18, clickNext)
  if (input.clickPowerLevel < 30) {
    offers.push({
      id: 'global:clickPower',
      track: 'clickPower',
      label: TRACK_LABEL.clickPower,
      cost: clickCost,
      currentLevel: input.clickPowerLevel,
      nextLevel: clickNext,
      maxLevel: 30,
      roiScore: calculateClickPowerRoi(input.clickPowerLevel, clickCost),
      affordable: input.gold >= clickCost,
      preview: `Lv ${input.clickPowerLevel} → ${clickNext}`,
    })
  }

  const promoNext = input.promotionMasteryLevel + 1
  const promoCost = calculateUpgradeCost(250, 1.18, promoNext)
  if (input.promotionMasteryLevel < 15) {
    offers.push({
      id: 'global:promotionMastery',
      track: 'promotionMastery',
      label: TRACK_LABEL.promotionMastery,
      cost: promoCost,
      currentLevel: input.promotionMasteryLevel,
      nextLevel: promoNext,
      maxLevel: 15,
      roiScore: calculatePromotionMasteryRoi(
        input.playerPieces,
        promoCost,
        input.globalSpeedMult,
      ),
      affordable: input.gold >= promoCost,
      preview: `+10% super stats · Lv ${promoNext}`,
    })
  }

  if (
    !input.autoAdvanceWavesPurchased &&
    input.currentStage >= AUTO_ADVANCE_UNLOCK_STAGE
  ) {
    offers.push({
      id: 'global:autoAdvanceWaves',
      track: 'autoAdvanceWaves',
      label: TRACK_LABEL.autoAdvanceWaves,
      cost: AUTO_ADVANCE_WAVE_COST,
      currentLevel: 0,
      nextLevel: 1,
      maxLevel: 1,
      roiScore: 0,
      affordable: input.gold >= AUTO_ADVANCE_WAVE_COST,
      preview: 'Auto Next Wave + auto-start after clear',
    })
  }

  return offers.sort((a, b) => b.roiScore - a.roiScore)
}

/** Highest combat ROI among affordable upgrade offers (excludes QoL auto-advance). */
export function pickBestAffordableUpgrade(offers: UpgradeOffer[]): UpgradeOffer | null {
  return (
    offers
      .filter(
        (o) =>
          o.affordable &&
          o.roiScore > 0 &&
          COMBAT_UPGRADE_TRACKS.has(o.track),
      )
      .sort((a, b) => b.roiScore - a.roiScore)[0] ?? null
  )
}

/** Marks the highest ROI affordable combat offer for UI highlight (GDD §5.3). */
export function markBestRoiOffers(offers: UpgradeOffer[]): UpgradeOffer[] {
  const bestAffordable = pickBestAffordableUpgrade(offers)
  if (!bestAffordable) return offers
  return offers.map((offer) => ({
    ...offer,
    isBestRoi: offer.id === bestAffordable.id,
  }))
}

/** Highest-ROI affordable prep purchase across upgrades and the piece shop. */
export function pickBestAffordablePurchase(
  upgrades: UpgradeOffer[],
  shopOffers: PieceShopOffer[],
): BestPurchasePick | null {
  const bestUpgrade = pickBestAffordableUpgrade(upgrades)
  const bestShop = shopOffers
    .filter((o) => o.purchasable && o.affordable && o.roiScore > 0)
    .sort((a, b) => b.roiScore - a.roiScore)[0]

  if (!bestUpgrade && !bestShop) return null
  if (!bestShop || (bestUpgrade && bestUpgrade.roiScore >= bestShop.roiScore)) {
    return {
      id: bestUpgrade!.id,
      roiScore: bestUpgrade!.roiScore,
      source: 'upgrade',
    }
  }

  return {
    id: bestShop.id,
    roiScore: bestShop.roiScore,
    source: 'shop',
  }
}

export function getHighlightedUpgradeCatalog(input: UpgradeCatalogInput): UpgradeOffer[] {
  return markBestRoiOffers(buildUpgradeCatalog(input))
}

export function runUpgradeCatalogSanityCheck(): { passed: boolean; messages: string[] } {
  const messages: string[] = []
  let passed = true
  const assert = (label: string, ok: boolean) => {
    messages.push(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
    if (!ok) passed = false
  }

  const state = createInitialGameState(0)
  const catalog = buildUpgradeCatalog({
    gold: 10_000,
    playerPieces: state.playerPieces,
    clickPowerLevel: state.clickPowerLevel,
    promotionMasteryLevel: state.promotion.masteryLevel,
    globalSpeedMult: state.globalSpeedMult,
    currentStage: state.currentStage,
    autoAdvanceWavesPurchased: false,
  })

  assert('catalog non-empty', catalog.length > 0)
  assert('costs positive', catalog.every((o) => o.cost > 0))

  const highlighted = markBestRoiOffers(catalog)
  assert('exactly one best ROI when affordable', highlighted.filter((o) => o.isBestRoi).length === 1)

  const best = pickBestAffordableUpgrade(catalog)
  assert('best pick matches highlighted offer', best?.id === highlighted.find((o) => o.isBestRoi)?.id)

  const iniRoi = calculateTrackRoi(state.playerPieces[0]!, 'initiative', 80, 1)
  const apRoi = calculateTrackRoi(state.playerPieces[0]!, 'ap', 100, 1)
  assert('AP and INI ROI share DPS/gold units', iniRoi > 0 && apRoi > 0)

  return { passed, messages }
}
