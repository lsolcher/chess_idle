/**
 * Procedural audio Pinia store (Phase 7) — Web Audio API, no external files.
 * Context unlocks on first user gesture per browser autoplay policy.
 */
import { defineStore } from 'pinia'
import { getUnlockedMusicLayers, type MusicLayerId } from '@/engine/musicLayers'
import {
  playProceduralSfx,
  ProceduralMusicLoop,
  resolveMusicMode,
  sfxFromFeedbackKind,
  type SfxId,
} from '@/engine/proceduralAudio'
import { resolvePersistStorage } from '@/store/persistStorage'
import { AUDIO_SAVE_STORAGE_KEY } from '@/version'
import type { PersistenceOptions } from 'pinia-plugin-persistedstate'

export interface AudioState {
  muted: boolean
  sfxVolume: number
  musicVolume: number
  /** True after AudioContext.resume() from user gesture. */
  unlocked: boolean
}

let sharedContext: AudioContext | null = null
let masterGain: GainNode | null = null
let sfxBus: GainNode | null = null
let musicBus: GainNode | null = null
const musicLoop = new ProceduralMusicLoop()

function createContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  return new Ctx()
}

function ensureGraph(): AudioContext | null {
  if (!sharedContext) {
    sharedContext = createContext()
    if (!sharedContext) return null
    masterGain = sharedContext.createGain()
    sfxBus = sharedContext.createGain()
    musicBus = sharedContext.createGain()
    sfxBus.connect(masterGain)
    musicBus.connect(masterGain)
    masterGain.connect(sharedContext.destination)
    musicLoop.attach(sharedContext, musicBus)
  }
  return sharedContext
}

export const useAudioStore = defineStore('audio', {
  state: (): AudioState => ({
    muted: false,
    sfxVolume: 0.75,
    musicVolume: 0.4,
    unlocked: false,
  }),

  getters: {
    isMuted: (state): boolean => state.muted,
    effectiveSfxVolume(state): number {
      return state.muted || !state.unlocked ? 0 : state.sfxVolume
    },
    effectiveMusicVolume(state): number {
      return state.muted || !state.unlocked ? 0 : state.musicVolume
    },
  },

  actions: {
    /**
     * Must run from a click/tap handler before audio will play (browser policy).
     */
    async unlockFromGesture(): Promise<void> {
      const ctx = ensureGraph()
      if (!ctx) return
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
      this.unlocked = true
      this.applyBusLevels()
    },

    applyBusLevels(): void {
      if (!sfxBus || !musicBus || !masterGain || !sharedContext) return
      const t = sharedContext.currentTime
      sfxBus.gain.setTargetAtTime(this.effectiveSfxVolume, t, 0.02)
      musicLoop.setVolume(this.effectiveMusicVolume)
      masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.02)
    },

    setMuted(muted: boolean): void {
      this.muted = muted
      this.applyBusLevels()
      if (muted) {
        musicLoop.stop()
      }
    },

    setSfxVolume(volume: number): void {
      this.sfxVolume = Math.max(0, Math.min(1, volume))
      this.applyBusLevels()
    },

    setMusicVolume(volume: number): void {
      this.musicVolume = Math.max(0, Math.min(1, volume))
      this.applyBusLevels()
    },

    playSfx(id: SfxId): void {
      if (!this.unlocked || this.muted) return
      const ctx = ensureGraph()
      if (!ctx || !sfxBus) return
      playProceduralSfx(ctx, sfxBus, id, this.sfxVolume)
    },

    playFeedback(kind: string): void {
      const id = sfxFromFeedbackKind(kind)
      if (id) this.playSfx(id)
    },

    /**
     * Cross-fades between ambient prep/combat and boss arpeggio (GDD §7 boss stages).
     */
    syncMusicMode(options: {
      wavePhase: string
      isBossStage: boolean
      maxStageEver?: number
      totalPrestiges?: number
      musicLayersEnabled?: boolean
    }): void {
      if (!this.unlocked || this.muted) {
        musicLoop.stop()
        return
      }
      ensureGraph()
      this.applyBusLevels()

      const mode = resolveMusicMode(options.wavePhase, options.isBossStage)

      if (mode === 'off') {
        musicLoop.stop()
      } else {
        const layersEnabled = options.musicLayersEnabled !== false
        const layers: MusicLayerId[] = layersEnabled
          ? getUnlockedMusicLayers(
              options.maxStageEver ?? 1,
              options.totalPrestiges ?? 0,
            )
          : ['base']
        musicLoop.start(mode, layers)
      }
    },

    teardown(): void {
      musicLoop.stop()
      if (sharedContext) {
        void sharedContext.close()
      }
      sharedContext = null
      masterGain = null
      sfxBus = null
      musicBus = null
    },
  },

  persist: {
    key: AUDIO_SAVE_STORAGE_KEY,
    storage: resolvePersistStorage(),
    omit: ['unlocked'],
  } as PersistenceOptions,
})
