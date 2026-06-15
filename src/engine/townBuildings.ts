/**
 * Chess Town building definitions, bonuses, and construction timing (Phase 11).
 * Persists in `townStore` — survives prestige resets.
 */
import type { MetaModifiers } from '@/engine/metaUpgrades'
import {
  mergeTownBonuses,
  NEUTRAL_TOWN_BONUSES,
  type TownBonuses,
} from '@/engine/townBuildings'

export type TownBuildingId = 'barracks' | 'academy' | 'treasury'
export type TownCurrency = 'skillPoints' | 'eloShards'

export interface TownBuildingRuntime {
  level: number
  /** Wall-clock ms when the in-flight upgrade completes (null = idle). */
  upgradeCompleteAtMs: number | null
}

export type TownBuildingLevels = Record<TownBuildingId, TownBuildingRuntime>

export interface TownBonuses {
  /** Multiplier on all friendly piece AP (Barracks). */
  apMult: number
  /** Multiplier on initiative / global speed (Academy). */
  globalSpeedMult: number
  /** Multiplier on passive gold income (Treasury). */
  goldMult: number
}

export interface TownBuildingDefinition {
  id: TownBuildingId
  currency: TownCurrency
  maxLevel: number
  baseCost: number
  costGrowth: number
  constructionBaseMs: number
  constructionPerLevelMs: number
}

export const TOWN_BUILDING_DEFINITIONS: Record<TownBuildingId, TownBuildingDefinition> = {
  barracks: {
    id: 'barracks',
    currency: 'skillPoints',
    maxLevel: 12,
    baseCost: 1,
    costGrowth: 1.25,
    constructionBaseMs: 2_000,
    constructionPerLevelMs: 1_500,
  },
  academy: {
    id: 'academy',
    currency: 'skillPoints',
    maxLevel: 12,
    baseCost: 1,
    costGrowth: 1.25,
    constructionBaseMs: 2_000,
    constructionPerLevelMs: 1_500,
  },
  treasury: {
    id: 'treasury',
    currency: 'eloShards',
    maxLevel: 10,
    baseCost: 1,
    costGrowth: 1.35,
    constructionBaseMs: 2_500,
    constructionPerLevelMs: 2_000,
  },
}

export const NEUTRAL_TOWN_BONUSES: TownBonuses = {
  apMult: 1,
  globalSpeedMult: 1,
  goldMult: 1,
}

import {
  TOWN_ACADEMY_SPEED_PER_LEVEL,
  TOWN_BARRACKS_AP_PER_LEVEL,
  TOWN_TREASURY_GOLD_PER_LEVEL,
} from '@/engine/balanceConstants'

const BARRACKS_AP_PER_LEVEL = TOWN_BARRACKS_AP_PER_LEVEL
const ACADEMY_SPEED_PER_LEVEL = TOWN_ACADEMY_SPEED_PER_LEVEL
const TREASURY_GOLD_PER_LEVEL = TOWN_TREASURY_GOLD_PER_LEVEL

export function createDefaultTownBuildings(): TownBuildingLevels {
  return {
    barracks: { level: 0, upgradeCompleteAtMs: null },
    academy: { level: 0, upgradeCompleteAtMs: null },
    treasury: { level: 0, upgradeCompleteAtMs: null },
  }
}

export function getBuildingUpgradeCost(id: TownBuildingId, currentLevel: number): number {
  const def = TOWN_BUILDING_DEFINITIONS[id]
  if (currentLevel >= def.maxLevel) return 0
  return Math.ceil(def.baseCost * def.costGrowth ** currentLevel)
}

export function getConstructionDurationMs(id: TownBuildingId, targetLevel: number): number {
  const def = TOWN_BUILDING_DEFINITIONS[id]
  return def.constructionBaseMs + def.constructionPerLevelMs * Math.max(0, targetLevel - 1)
}

export function isBuildingUpgrading(building: TownBuildingRuntime, nowMs: number): boolean {
  return building.upgradeCompleteAtMs !== null && nowMs < building.upgradeCompleteAtMs
}

export function getConstructionProgressForBuilding(
  id: TownBuildingId,
  building: TownBuildingRuntime,
  nowMs: number,
): number {
  if (building.upgradeCompleteAtMs === null) return 0
  const targetLevel = building.level + 1
  const duration = getConstructionDurationMs(id, targetLevel)
  const startedAt = building.upgradeCompleteAtMs - duration
  if (nowMs >= building.upgradeCompleteAtMs) return 1
  return Math.max(0, Math.min(1, (nowMs - startedAt) / duration))
}

/** Account-wide combat/economy modifiers from town building levels. */
export function getTownBonuses(buildings: TownBuildingLevels): TownBonuses {
  const barracks = buildings.barracks.level
  const academy = buildings.academy.level
  const treasury = buildings.treasury.level

  return {
    apMult: 1 + BARRACKS_AP_PER_LEVEL * barracks,
    globalSpeedMult: 1 + ACADEMY_SPEED_PER_LEVEL * academy,
    goldMult: 1 + TREASURY_GOLD_PER_LEVEL * treasury,
  }
}

export function mergeTownBonuses(base: MetaModifiers, town: TownBonuses): MetaModifiers {
  return {
    ...base,
    apMult: base.apMult * town.apMult,
    goldMult: base.goldMult * town.goldMult,
    globalSpeedMult: base.globalSpeedMult * town.globalSpeedMult,
  }
}

export function canUpgradeBuilding(
  id: TownBuildingId,
  buildings: TownBuildingLevels,
  nowMs: number,
): boolean {
  const building = buildings[id]
  const def = TOWN_BUILDING_DEFINITIONS[id]
  if (building.level >= def.maxLevel) return false
  if (isBuildingUpgrading(building, nowMs)) return false
  return true
}

export interface CompletedUpgrade {
  id: TownBuildingId
  newLevel: number
}

/** Applies finished construction timers; returns buildings that leveled up this tick. */
export function tickTownConstruction(
  buildings: TownBuildingLevels,
  nowMs: number,
): { buildings: TownBuildingLevels; completed: CompletedUpgrade[] } {
  const next = { ...buildings }
  const completed: CompletedUpgrade[] = []

  for (const id of Object.keys(TOWN_BUILDING_DEFINITIONS) as TownBuildingId[]) {
    const building = { ...next[id] }
    if (building.upgradeCompleteAtMs === null || nowMs < building.upgradeCompleteAtMs) {
      next[id] = building
      continue
    }
    building.level += 1
    building.upgradeCompleteAtMs = null
    next[id] = building
    completed.push({ id, newLevel: building.level })
  }

  return { buildings: next, completed }
}

export function startBuildingUpgrade(
  id: TownBuildingId,
  buildings: TownBuildingLevels,
  nowMs: number,
): TownBuildingLevels | null {
  if (!canUpgradeBuilding(id, buildings, nowMs)) return null

  const building = buildings[id]
  const targetLevel = building.level + 1
  const completeAt = nowMs + getConstructionDurationMs(id, targetLevel)

  return {
    ...buildings,
    [id]: {
      level: building.level,
      upgradeCompleteAtMs: completeAt,
    },
  }
}

export function describeTownBonusPreview(id: TownBuildingId, nextLevel: number): string {
  switch (id) {
    case 'barracks':
      return `+${(BARRACKS_AP_PER_LEVEL * 100).toFixed(0)}% piece AP (Lv ${nextLevel})`
    case 'academy':
      return `+${(ACADEMY_SPEED_PER_LEVEL * 100).toFixed(0)}% initiative speed (Lv ${nextLevel})`
    case 'treasury':
      return `+${(TREASURY_GOLD_PER_LEVEL * 100).toFixed(0)}% gold income (Lv ${nextLevel})`
    default:
      return ''
  }
}

export function runTownBuildingsSanityCheck(): { passed: boolean; messages: string[] } {
  const messages: string[] = []
  let passed = true
  const assert = (label: string, ok: boolean) => {
    messages.push(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
    if (!ok) passed = false
  }

  const defaults = createDefaultTownBuildings()
  assert('neutral bonuses at level 0', getTownBonuses(defaults).apMult === 1)

  const leveled = {
    ...defaults,
    barracks: { level: 5, upgradeCompleteAtMs: null },
    academy: { level: 3, upgradeCompleteAtMs: null },
    treasury: { level: 2, upgradeCompleteAtMs: null },
  }
  const bonuses = getTownBonuses(leveled)
  assert('barracks adds AP', bonuses.apMult > 1)
  assert('academy adds speed', bonuses.globalSpeedMult > 1)
  assert('treasury adds gold', bonuses.goldMult > 1)

  const started = startBuildingUpgrade('barracks', defaults, 0)
  assert('starts construction', started?.barracks.upgradeCompleteAtMs !== null)

  const ticked = tickTownConstruction(started!, started!.barracks.upgradeCompleteAtMs!)
  assert('completes construction', ticked.buildings.barracks.level === 1)

  return { passed, messages }
}
