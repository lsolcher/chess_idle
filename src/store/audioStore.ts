/**
 * Procedural audio Pinia store (Phase 7) — Web Audio API, no external files.
 * Context unlocks on first user gesture per browser autoplay policy.
 */
import { defineStore } from 'pinia'
import { getUnlockedMusicLayers, type MusicLayerId } from '@/engine/musicLayers'
import type { CombatFeedbackEvent } from '@/engine/combatFeedback'
import {
  GrandmasterTensionDrone,
  pieceKindToPitchTier,
  playPitchMappedCombatSfx,
  playProceduralSfx,
  playPrestigeChime,
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
const grandmasterDrone = new GrandmasterTensionDrone()
let visibilityHooksInstalled = false

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
    grandmasterDrone.attach(sharedContext, sfxBus)
  }
  return sharedContext
}

function installVisibilityHooks(store: { suspendForBackground: () => void; resumeFromBackground: () => Promise<void> }): void {
  if (visibilityHooksInstalled || typeof document === 'undefined') return
  visibilityHooksInstalled = true
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      store.suspendForBackground()
    } else {
      void store.resumeFromBackground()
    }
  })
  window.addEventListener('blur', () => {
    if (document.hidden) store.suspendForBackground()
  })
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
      installVisibilityHooks(this)
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
        grandmasterDrone.stop()
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

    playMetaPurchaseChime(): void {
      this.playSfx('metaPurchase')
    },

    playSupporterPurchaseChime(): void {
      this.playSfx('supporterPurchase')
    },

    playPrestigeChime(): void {
      if (!this.unlocked || this.muted) return
      const ctx = ensureGraph()
      if (!ctx || !sfxBus) return
      playPrestigeChime(ctx, sfxBus, this.sfxVolume)
    },

    playFeedback(kind: string): void {
      const id = sfxFromFeedbackKind(kind)
      if (id) this.playSfx(id)
    },

    /**
     * Pitch-mapped combat feedback — tier from attacker piece kind when present.
     */
    playCombatFeedbackEvents(events: CombatFeedbackEvent[]): void {
      if (!this.unlocked || this.muted || events.length === 0) return
      const ctx = ensureGraph()
      if (!ctx || !sfxBus) return

      for (const event of events) {
        const mapped = sfxFromFeedbackKind(event.kind)
        if (!mapped) continue

        if (
          event.attackerKind &&
          (event.kind === 'chip' || event.kind === 'clash' || event.kind === 'capture')
        ) {
          const tier = pieceKindToPitchTier(event.attackerKind)
          const pitchKind =
            event.kind === 'capture' ? 'capture' : event.kind === 'clash' ? 'clash' : 'chip'
          playPitchMappedCombatSfx(ctx, sfxBus, pitchKind, tier, this.sfxVolume)
          continue
        }

        playProceduralSfx(ctx, sfxBus, mapped, this.sfxVolume, {
          combatVoice: mapped === 'chip' || mapped === 'capture',
        })
      }
    },

    /**
     * Grandmaster Phase III tension layer — subtle dissonant drone until boss defeat.
     */
    syncGrandmasterTension(active: boolean): void {
      if (!this.unlocked || this.muted || !active) {
        grandmasterDrone.stop()
        return
      }
      ensureGraph()
      if (!grandmasterDrone.isRunning()) {
        grandmasterDrone.start(this.sfxVolume * 0.85)
      }
    },

    /** Suspends Web Audio and procedural timers when the tab is backgrounded. */
    suspendForBackground(): void {
      musicLoop.stop()
      grandmasterDrone.stop()
      if (sharedContext && sharedContext.state === 'running') {
        void sharedContext.suspend()
      }
    },

    /** Resumes context after focus return; music re-syncs via `useGameAudio` watch. */
    async resumeFromBackground(): Promise<void> {
      if (!this.unlocked || this.muted) return
      const ctx = ensureGraph()
      if (!ctx) return
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
      this.applyBusLevels()
    },

    /**
     * Cross-fades between ambient prep/combat and boss arpeggio (GDD §7 boss stages).
     */
    syncMusicMode(options: {
      wavePhase: string
      isBossStage: boolean
      currentStage?: number
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
      const mixStage = options.currentStage ?? options.maxStageEver ?? 1

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
        musicLoop.setMixContext(mixStage, options.totalPrestiges ?? 0)
        musicLoop.start(mode, layers)
      }
    },

    teardown(): void {
      musicLoop.stop()
      grandmasterDrone.stop()
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
