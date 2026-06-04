/**
 * Chess Town persistent meta-base (Phase 11).
 * Building levels persist across prestige; bonuses apply in `gameStore.applyMetaModifiers`.
 */
import { defineStore, getActivePinia } from 'pinia'
import type { PersistenceOptions } from 'pinia-plugin-persistedstate'
import {
  canUpgradeBuilding,
  createDefaultTownBuildings,
  describeTownBonusPreview,
  getBuildingUpgradeCost,
  getConstructionProgressForBuilding,
  getTownBonuses,
  isBuildingUpgrading,
  startBuildingUpgrade,
  tickTownConstruction,
  TOWN_BUILDING_DEFINITIONS,
  type TownBuildingId,
  type TownBuildingLevels,
} from '@/engine/townBuildings'
import { getBuildingVisualLabel, getBuildingVisualTier } from '@/engine/aestheticProgression'
import { useGameStore } from '@/store/gameStore'
import { useMetaStore } from '@/store/metaStore'
import { TOWN_STORE_PERSIST_KEY } from '@/version'
import { resolvePersistStorage } from '@/store/persistStorage'

export interface TownStoreState {
  buildings: TownBuildingLevels
}

export function createInitialTownStoreState(): TownStoreState {
  return {
    buildings: createDefaultTownBuildings(),
  }
}

export const useTownStore = defineStore('town', {
  state: (): TownStoreState => createInitialTownStoreState(),

  getters: {
    townBonuses(state) {
      return getTownBonuses(state.buildings)
    },

    buildingCards(state) {
      return (Object.keys(TOWN_BUILDING_DEFINITIONS) as TownBuildingId[]).map((id) => {
        const def = TOWN_BUILDING_DEFINITIONS[id]
        const building = state.buildings[id]
        const nextLevel = building.level + 1
        const maxed = building.level >= def.maxLevel
        const cost = getBuildingUpgradeCost(id, building.level)
        return {
          id,
          currency: def.currency,
          level: building.level,
          maxLevel: def.maxLevel,
          nextLevel,
          maxed,
          cost,
          preview: describeTownBonusPreview(id, nextLevel),
          visualTier: getBuildingVisualTier(building.level),
          visualLabel: getBuildingVisualLabel(getBuildingVisualTier(building.level)),
        }
      })
    },
  },

  actions: {
    getTownBonuses() {
      return getTownBonuses(this.buildings)
    },

    tickTown(nowMs = Date.now()): boolean {
      const { buildings, completed } = tickTownConstruction(this.buildings, nowMs)
      this.buildings = buildings
      if (completed.length > 0) {
        const pinia = getActivePinia()
        if (pinia) {
          useGameStore(pinia).applyMetaModifiers()
        }
        return true
      }
      return false
    },

    upgradeBuilding(id: TownBuildingId, nowMs = Date.now()): boolean {
      if (!canUpgradeBuilding(id, this.buildings, nowMs)) return false

      const def = TOWN_BUILDING_DEFINITIONS[id]
      const cost = getBuildingUpgradeCost(id, this.buildings[id].level)
      const pinia = getActivePinia()
      if (!pinia) return false

      const meta = useMetaStore(pinia)
      const game = useGameStore(pinia)

      if (def.currency === 'skillPoints') {
        if (meta.skillPoints < cost) return false
        meta.skillPoints -= cost
      } else {
        if (!game.spendEloShards(cost)) return false
      }

      const next = startBuildingUpgrade(id, this.buildings, nowMs)
      if (!next) return false
      this.buildings = next
      return true
    },

    isUpgrading(id: TownBuildingId, nowMs = Date.now()): boolean {
      return isBuildingUpgrading(this.buildings[id], nowMs)
    },

    constructionProgress(id: TownBuildingId, nowMs = Date.now()): number {
      return getConstructionProgressForBuilding(id, this.buildings[id], nowMs)
    },

    canAffordUpgrade(id: TownBuildingId): boolean {
      const def = TOWN_BUILDING_DEFINITIONS[id]
      const cost = getBuildingUpgradeCost(id, this.buildings[id].level)
      const pinia = getActivePinia()
      if (!pinia) return false
      if (def.currency === 'skillPoints') {
        return useMetaStore(pinia).skillPoints >= cost
      }
      return useGameStore(pinia).eloShards >= cost
    },
  },

  persist: {
    key: TOWN_STORE_PERSIST_KEY,
    storage: resolvePersistStorage(),
  } as PersistenceOptions,
})
