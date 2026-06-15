/**
 * Meta-upgrade aggregation and purchase rules (GDD §2.5).
 * Modifiers stack additively per rank on their stated bases.
 */
import {
  BASE_DEPLOY_SLOTS,
  clampDeploySlotsToRoster,
  computeMaxDeploySlotsFromRoster,
} from '@/engine/pieceShop'
import { PREP_MISSING_HP_RECOVERY_BASE } from '@/engine/waveState'
import {
  mergeTownBonuses,
  NEUTRAL_TOWN_BONUSES,
  type TownBonuses,
} from '@/engine/townBuildings'
import {
  createDefaultMetaUpgrades,
  META_UPGRADE_DEFINITIONS,
  type AchievementFlags,
  type GameState,
  type MetaUpgradeId,
  type MetaUpgradeState,
} from '@/types/game'

/** Aggregated passive modifiers from allocated Elo ranks. */
export interface MetaModifiers {
  /** Opening Theory: +5% gold per rank. */
  goldMult: number
  /** Endgame Technique: +3% piece AP per rank. */
  apMult: number
  /** Time Control: +5% global speed per rank (shorter intervals). */
  globalSpeedMult: number
  /** Tablebase Memory: +10% AI score weight per rank. */
  aiScoreMult: number
  bonusPawnsOnReset: number
  bonusDeploySlots: number
  exhibitionRank: number
  hasImmortalGame: boolean
  enPassantCarryPct: number
  /** Deep Clock — extra boss-wave time (ms total). */
  bossTimerExtensionMs: number
  /** Share of missing HP restored when entering prep between waves (0–1). */
  prepMissingHpRecoveryFraction: number
}

/**
 * Derives runtime modifiers from meta ranks (GDD §2.5 table).
 */
export function calculateMetaModifiers(meta: MetaUpgradeState): MetaModifiers {
  const opening = meta.openingTheory ?? 0
  const endgame = meta.endgameTechnique ?? 0
  const time = meta.timeControl ?? 0
  const tablebase = meta.tablebaseMemory ?? 0
  const instinct = meta.grandmasterInstinct ?? 0
  const expansion = meta.boardExpansion ?? 0
  const immortal = meta.immortalGame ?? 0
  const enPassant = meta.enPassantEconomy ?? 0

  return {
    goldMult: 1 + 0.05 * opening,
    apMult: 1 + 0.03 * endgame,
    globalSpeedMult: 1 + 0.05 * time,
    aiScoreMult: 1 + 0.1 * tablebase,
    bonusPawnsOnReset: instinct,
    bonusDeploySlots: expansion,
    exhibitionRank: 0,
    hasImmortalGame: immortal >= 1,
    enPassantCarryPct: 0.25 * enPassant,
    bossTimerExtensionMs: (meta.deepClock ?? 0) > 0 ? 30_000 : 0,
    prepMissingHpRecoveryFraction: PREP_MISSING_HP_RECOVERY_BASE,
  }
}

/** Tempo Tyrant achievement grants +5% Elo on prestige (GDD §4.2 stage 50 title). */
export function getPrestigeEloMultBonus(achievements: AchievementFlags): number {
  return achievements.tempoTyrant ? 1.05 : 1
}

export interface MetaUpgradeOffer {
  id: MetaUpgradeId
  label: string
  rank: number
  maxRank: number
  nextCost: number
  affordable: boolean
  effectPreview: string
  locked: boolean
  lockReason?: string
}

/**
 * Meta tree is available after the first prestige reset (GDD §2.5 / UI §5).
 */
export function isMetaTreeUnlocked(hasPrestigedOnce: boolean, eloShards: number): boolean {
  return hasPrestigedOnce || eloShards > 0
}

export function getMetaUpgradeCost(id: MetaUpgradeId, currentRank: number): number {
  const def = META_UPGRADE_DEFINITIONS.find((d) => d.id === id)
  if (!def || currentRank >= def.maxRank) return 0
  return def.eloCostPerRank
}

export function canPurchaseMetaUpgrade(
  id: MetaUpgradeId,
  meta: MetaUpgradeState,
  eloShards: number,
  metaUnlocked: boolean,
): boolean {
  if (!metaUnlocked) return false
  const def = META_UPGRADE_DEFINITIONS.find((d) => d.id === id)
  if (!def) return false
  const rank = meta[id] ?? 0
  if (rank >= def.maxRank) return false
  return eloShards >= def.eloCostPerRank
}

export function buildMetaUpgradeOffers(
  meta: MetaUpgradeState,
  eloShards: number,
  metaUnlocked: boolean,
): MetaUpgradeOffer[] {
  const mods = calculateMetaModifiers(meta)
  return META_UPGRADE_DEFINITIONS.map((def) => {
    const rank = meta[def.id] ?? 0
    const nextCost = getMetaUpgradeCost(def.id, rank)
    const locked = !metaUnlocked
    return {
      id: def.id,
      label: def.label,
      rank,
      maxRank: def.maxRank,
      nextCost,
      affordable: !locked && rank < def.maxRank && eloShards >= nextCost,
      effectPreview: describeMetaEffect(def.id, rank + 1, mods),
      locked,
      lockReason: locked ? 'Prestige once to unlock the meta tree' : undefined,
    }
  })
}

function describeMetaEffect(id: MetaUpgradeId, nextRank: number, _mods: MetaModifiers): string {
  switch (id) {
    case 'openingTheory':
      return `+${(5 * nextRank).toFixed(0)}% gold (next rank → ${(5 * nextRank).toFixed(0)}% total)`
    case 'endgameTechnique':
      return `+${(3 * nextRank).toFixed(0)}% piece AP`
    case 'timeControl':
      return `+${(5 * nextRank).toFixed(0)}% initiative speed`
    case 'tablebaseMemory':
      return `+${(10 * nextRank).toFixed(0)}% AI scoring`
    case 'grandmasterInstinct':
      return `+${nextRank} starting pawn(s) on prestige reset`
    case 'boardExpansion':
      return `+${nextRank} deploy slot(s)`
    case 'immortalGame':
      return 'Once per stage: revive at 30% HP'
    case 'enPassantEconomy':
      return `${25 * nextRank}% super-promotion carry`
    case 'deepClock':
      return '+30s boss wave timer'
    default:
      return ''
  }
}

/**
 * Applies meta + town modifiers onto run-scoped GameState fields after prestige or purchase.
 */
export function applyMetaModifiersToState(
  state: GameState,
  town: TownBonuses = NEUTRAL_TOWN_BONUSES,
): void {
  const mods = mergeTownBonuses(calculateMetaModifiers(state.metaUpgrades), town)
  state.prestigeGoldMult = mods.goldMult
  state.globalSpeedMult = mods.globalSpeedMult
  state.enPassantEconomyRank = state.metaUpgrades.enPassantEconomy ?? 0

  const rosterCap = computeMaxDeploySlotsFromRoster(state.unlockedSlots)
  const metaFloor = Math.min(BASE_DEPLOY_SLOTS + mods.bonusDeploySlots, rosterCap)
  state.deploySlots = clampDeploySlotsToRoster(
    Math.max(state.deploySlots, metaFloor),
    state.unlockedSlots,
  )
}

/** Ensures meta object has every node key (save migration). */
export function normalizeMetaUpgrades(meta: Partial<MetaUpgradeState>): MetaUpgradeState {
  const defaults = createDefaultMetaUpgrades()
  return { ...defaults, ...meta }
}
