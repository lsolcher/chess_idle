/**
 * Dev mode UI state and cheat dispatch (persisted separately from campaign save).
 */
import { defineStore } from 'pinia'
import { isViteDevBuild } from '@/config/devMode'
import { applyDevSetStage, devSetStageTarget, runDevCheat, type DevCheatId } from '@/engine/devCheats'
import { isDevGodModeActive } from '@/engine/devGodMode'
import { setDevModeRuntimeEnabled } from '@/engine/devModeRuntime'
import { resolvePersistStorage } from '@/store/persistStorage'
import { useGameStore } from '@/store/gameStore'
import { DEV_STORE_PERSIST_KEY } from '@/version'
import type { PersistenceOptions } from 'pinia-plugin-persistedstate'

export interface DevStoreState {
  enabled: boolean
  panelOpen: boolean
  godMode: boolean
  stageInput: number
}

export const useDevStore = defineStore('dev', {
  state: (): DevStoreState => ({
    enabled: isViteDevBuild(),
    panelOpen: false,
    godMode: false,
    stageInput: 10,
  }),

  getters: {
    isGodModeActive(): boolean {
      return this.enabled && this.godMode && isDevGodModeActive()
    },
  },

  actions: {
    enableDevMode(): void {
      this.enabled = true
      this.panelOpen = true
      this.syncGodModeToEngine()
    },

    disableDevMode(): void {
      this.enabled = false
      this.panelOpen = false
      this.godMode = false
      this.syncGodModeToEngine()
    },

    togglePanel(): void {
      if (!this.enabled) {
        this.enableDevMode()
        return
      }
      this.panelOpen = !this.panelOpen
    },

    toggleGodMode(): void {
      if (!this.enabled) return
      this.godMode = !this.godMode
      this.syncGodModeToEngine()
    },

    syncGodModeToEngine(): void {
      setDevModeRuntimeEnabled(this.enabled, this.godMode)
    },

    runCheat(cheatId: DevCheatId): void {
      if (!this.enabled) return
      const game = useGameStore()
      runDevCheat(game, cheatId)
    },

    jumpToStageInput(): void {
      if (!this.enabled) return
      const game = useGameStore()
      applyDevSetStage(game, devSetStageTarget(this.stageInput))
    },

    setStageInput(value: number): void {
      this.stageInput = devSetStageTarget(value)
    },
  },

  persist: {
    key: DEV_STORE_PERSIST_KEY,
    storage: resolvePersistStorage(),
    pick: ['enabled', 'godMode', 'stageInput'],
  } as PersistenceOptions,
})
