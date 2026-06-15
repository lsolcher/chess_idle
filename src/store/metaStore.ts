/**

 * Meta progression outside combat — Dojo skill points, Supporter QoL (Phase 9.5 / 10).

 * Persists across prestige; never modifies combat stats or Arena PvP balance.

 */

import { defineStore } from 'pinia'

import type { PersistenceOptions } from 'pinia-plugin-persistedstate'

import { META_STORE_PERSIST_KEY } from '@/version'
import { resolvePersistStorage } from '@/store/persistStorage'

import { DOJO_SKILL_REWARD } from '@/engine/balanceConstants'
import {
  createDefaultDojoModules,
  type DojoModuleCompletion,
  type DojoModuleId,
} from '@/engine/wavePatterns'
import { getAiMove, HARD_LOOKAHEAD_PLIES, type Board, type DojoDifficulty } from '@/engine/chessDojo'

export { DOJO_SKILL_REWARD } from '@/engine/balanceConstants'

import type { SupporterConvenienceFlags } from '@/engine/supporterQoL'



export type DojoUpgradeId = 'deepThought' | 'openingRepertoire' | 'endgamePrecision'



export type ConvenienceUpgradeId =

  | 'offlineGoldMultiplier'

  | 'autoShopAssistant'

  | 'advancedCombatLog'



export interface DojoUpgradeDefinition {

  id: DojoUpgradeId

  label: string

  maxRank: number

  costPerRank: number

  effectPreview: string

}



export interface ConvenienceUpgradeDefinition {

  id: ConvenienceUpgradeId

  label: string

  effectPreview: string

}



export const DOJO_UPGRADE_DEFINITIONS: DojoUpgradeDefinition[] = [

  {

    id: 'deepThought',

    label: 'Deep Thought',

    maxRank: 3,

    costPerRank: 2,

    effectPreview: '+1 Hard AI search ply per rank',

  },

  {

    id: 'openingRepertoire',

    label: 'Opening Repertoire',

    maxRank: 5,

    costPerRank: 1,

    effectPreview: '+10% Skill Points from Easy wins per rank',

  },

  {

    id: 'endgamePrecision',

    label: 'Endgame Precision',

    maxRank: 5,

    costPerRank: 1,

    effectPreview: '+10% Skill Points from Medium wins per rank',

  },

]



export const CONVENIENCE_UPGRADE_DEFINITIONS: ConvenienceUpgradeDefinition[] = [

  {

    id: 'offlineGoldMultiplier',

    label: 'Offline Gold Multiplier',

    effectPreview: '1.5× offline gold drip (QoL only)',

  },

  {

    id: 'autoShopAssistant',

    label: 'Auto-Shop Assistant',

    effectPreview: 'Auto-buys best ROI upgrade when entering prep',

  },

  {

    id: 'advancedCombatLog',

    label: 'Advanced Combat Log',

    effectPreview: 'Extra wave outcome analytics (no combat power)',

  },

]






export interface MetaStoreState {

  skillPoints: number

  dojoUpgrades: Record<DojoUpgradeId, number>

  dojoModules: DojoModuleCompletion

  dojoVictories: Record<DojoDifficulty, number>

  convenienceUpgrades: Record<ConvenienceUpgradeId, boolean>

  /** Last supporter purchase id for thank-you toast (session UX). */

  lastConvenienceThankYouId: ConvenienceUpgradeId | null

}



function createDefaultDojoUpgrades(): Record<DojoUpgradeId, number> {

  return {

    deepThought: 0,

    openingRepertoire: 0,

    endgamePrecision: 0,

  }

}



function createDefaultConvenienceUpgrades(): Record<ConvenienceUpgradeId, boolean> {

  return {

    offlineGoldMultiplier: false,

    autoShopAssistant: false,

    advancedCombatLog: false,

  }

}



export function createInitialMetaStoreState(): MetaStoreState {

  return {

    skillPoints: 0,

    dojoUpgrades: createDefaultDojoUpgrades(),

    dojoModules: createDefaultDojoModules(),

    dojoVictories: { easy: 0, medium: 0, hard: 0 },

    convenienceUpgrades: createDefaultConvenienceUpgrades(),

    lastConvenienceThankYouId: null,

  }

}



export const useMetaStore = defineStore('meta', {

  state: (): MetaStoreState => createInitialMetaStoreState(),



  getters: {

    totalDojoVictories(state): number {

      return state.dojoVictories.easy + state.dojoVictories.medium + state.dojoVictories.hard

    },



    convenienceFlags(state): SupporterConvenienceFlags {

      return {

        offlineGoldMultiplier: state.convenienceUpgrades.offlineGoldMultiplier ?? false,

        autoShopAssistant: state.convenienceUpgrades.autoShopAssistant ?? false,

        advancedCombatLog: state.convenienceUpgrades.advancedCombatLog ?? false,

      }

    },



    hasOfflineGoldMultiplier(): boolean {

      return this.convenienceFlags.offlineGoldMultiplier

    },



    hasAutoShopAssistant(): boolean {

      return this.convenienceFlags.autoShopAssistant

    },



    hasAdvancedCombatLog(): boolean {

      return this.convenienceFlags.advancedCombatLog

    },



    convenienceUpgradeOffers(state) {

      return CONVENIENCE_UPGRADE_DEFINITIONS.map((def) => ({

        ...def,

        owned: state.convenienceUpgrades[def.id] ?? false,

      }))

    },



    dojoUpgradeOffers(state) {

      return DOJO_UPGRADE_DEFINITIONS.map((def) => {

        const rank = state.dojoUpgrades[def.id] ?? 0

        const nextCost = def.costPerRank

        return {

          ...def,

          rank,

          nextCost,

          maxed: rank >= def.maxRank,

          affordable: state.skillPoints >= nextCost && rank < def.maxRank,

        }

      })

    },



    dojoExtraSearchPlies(state): number {

      return state.dojoUpgrades.deepThought ?? 0

    },



    hardAiSearchPlies(): number {

      return HARD_LOOKAHEAD_PLIES + this.dojoExtraSearchPlies

    },

  },



  actions: {

    /** Awards skill points after a Dojo win; returns points granted. */

    completeDojoModule(id: DojoModuleId): void {

      this.dojoModules = { ...createDefaultDojoModules(), ...this.dojoModules, [id]: true }

    },



    hasDojoModule(id: DojoModuleId): boolean {

      const modules = { ...createDefaultDojoModules(), ...this.dojoModules }

      return Boolean(modules[id])

    },



    dojoVictory(difficulty: DojoDifficulty): number {

      let base = DOJO_SKILL_REWARD[difficulty]

      if (difficulty === 'easy') {

        base = Math.floor(base * (1 + 0.1 * (this.dojoUpgrades.openingRepertoire ?? 0)))

      }

      if (difficulty === 'medium') {

        base = Math.floor(base * (1 + 0.1 * (this.dojoUpgrades.endgamePrecision ?? 0)))

      }

      this.dojoVictories[difficulty] += 1

      this.skillPoints += base

      return base

    },



    purchaseDojoUpgrade(id: DojoUpgradeId): boolean {

      const def = DOJO_UPGRADE_DEFINITIONS.find((entry) => entry.id === id)

      if (!def) return false

      const rank = this.dojoUpgrades[id] ?? 0

      if (rank >= def.maxRank) return false

      if (this.skillPoints < def.costPerRank) return false

      this.skillPoints -= def.costPerRank

      this.dojoUpgrades[id] = rank + 1

      return true

    },



    /**

     * Unlocks a one-time Supporter convenience perk (ethical QoL — no combat stats).

     */

    purchaseConvenienceUpgrade(id: ConvenienceUpgradeId): boolean {

      if (this.convenienceUpgrades[id]) return false

      this.convenienceUpgrades[id] = true

      this.lastConvenienceThankYouId = id

      return true

    },



    dismissConvenienceThankYou(): void {

      this.lastConvenienceThankYouId = null

    },



    /** Dojo AI move using current meta depth bonuses. */

    getDojoAiMove(board: Board, difficulty: DojoDifficulty) {

      return getAiMove(board, difficulty, {

        extraSearchPlies: this.dojoExtraSearchPlies,

      })

    },

  },



  persist: {

    key: META_STORE_PERSIST_KEY,

    storage: resolvePersistStorage(),

  } as PersistenceOptions,

})


