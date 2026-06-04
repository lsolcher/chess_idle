/**
 * Upgrade catalog and ROI scoring for the Upgrade Panel (GDD §2.3, §5.1).
 * ROI = relative stat gain per gold spent — used to highlight best purchase.
 */
import {
  AUTO_ADVANCE_UNLOCK_STAGE,
  AUTO_ADVANCE_WAVE_COST,
} from '@/engine/waveAutomation'
import {
  calculateActionIntervalSec,
  calculateStatAtLevel,
  calculateUpgradeCost,
  createInitialGameState,
  getInitiativeUpgradeBaseCost,
  getStatUpgradeBaseCost,
  INITIATIVE_UPGRADE_CONFIG,
  PIECE_DEFINITIONS,
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

const TRACK_LABEL: Record<UpgradeTrackId, string> = {
  ap: 'Attack',
  hp: 'Durability',
  def: 'Defense',
  initiative: 'Initiative',
  clickPower: 'Click Power',
  promotionMastery: 'Promotion Mastery',
  autoAdvanceWaves: 'Auto-Advance Waves',
}

/**
 * ROI proxy: marginal combat value gained divided by gold cost.
 * Initiative uses seconds saved per gold; globals use level value / cost.
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

  switch (track) {
    case 'ap': {
      const cur = calculateStatAtLevel(def.baseAp, levels.ap)
      const next = calculateStatAtLevel(def.baseAp, levels.ap + 1)
      return (next - cur) / cost
    }
    case 'hp': {
      const cur = calculateStatAtLevel(def.baseHp, levels.hp)
      const next = calculateStatAtLevel(def.baseHp, levels.hp + 1)
      return (next - cur) / cost / 2
    }
    case 'def': {
      const cur = calculateStatAtLevel(def.baseDef, levels.def)
      const next = calculateStatAtLevel(def.baseDef, levels.def + 1)
      return (next - cur) / cost / 2
    }
    case 'initiative': {
      if (levels.initiative >= INITIATIVE_UPGRADE_CONFIG.maxLevel) return 0
      const before = calculateActionIntervalSec(def.baseIntervalSec, levels.initiative, globalSpeedMult)
      const after = calculateActionIntervalSec(
        def.baseIntervalSec,
        levels.initiative + 1,
        globalSpeedMult,
      )
      return (before - after) / cost
    }
    default:
      return 0
  }
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
      roiScore: 1 / clickCost,
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
      roiScore: 1.2 / promoCost,
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
      roiScore: 2 / AUTO_ADVANCE_WAVE_COST,
      affordable: input.gold >= AUTO_ADVANCE_WAVE_COST,
      preview: 'Auto Next Wave + auto-start after clear',
    })
  }

  return offers.sort((a, b) => b.roiScore - a.roiScore)
}

/** Marks the highest ROI affordable offer for UI highlight (GDD §5.3). */
export function markBestRoiOffers(offers: UpgradeOffer[]): UpgradeOffer[] {
  const bestAffordable = offers.filter((o) => o.affordable).sort((a, b) => b.roiScore - a.roiScore)[0]
  if (!bestAffordable) return offers
  return offers.map((offer) => ({
    ...offer,
    isBestRoi: offer.id === bestAffordable.id,
  }))
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

  return { passed, messages }
}
