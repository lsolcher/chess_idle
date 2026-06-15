/**
 * Procedural Web Audio synthesis — no external assets (Phase 7 / 8.6 layered music).
 * Uses oscillators + envelopes for SFX and additive music layers (outside combat tick).
 */
import { computeDynamicLayerGain, type MusicLayerId } from '@/engine/musicLayers'
import type { PieceKind } from '@/types/game'

export type SfxId =
  | 'uiClick'
  | 'chip'
  | 'capture'
  | 'gold'
  | 'waveClear'
  | 'upgrade'
  | 'promotion'
  | 'leak'
  | 'fail'
  | 'prestige'
  | 'metaPurchase'
  | 'supporterPurchase'

export type MusicMode = 'off' | 'ambient' | 'boss'

/** Pentatonic roots for ambient vs boss intensity (Hz). */
const AMBIENT_NOTES = [220, 261.63, 329.63, 392, 493.88]
const BOSS_NOTES = [146.83, 174.61, 220, 261.63, 329.63, 392]

/** Boss vs relaxed loop crossfade duration (seconds). */
export const MUSIC_MODE_CROSSFADE_SEC = 2

/** Cap concurrent combat one-shots during dense fights (16+ units). */
export const COMBAT_SFX_VOICE_LIMIT = 14

let activeCombatVoices = 0

export interface SfxPreset {
  type: OscillatorType
  frequency: number
  frequencyEnd?: number
  durationSec: number
  gainPeak: number
}

/**
 * Preset table — short envelopes keep combat ticks from clipping.
 */
export const SFX_PRESETS: Record<SfxId, SfxPreset> = {
  uiClick: { type: 'square', frequency: 880, durationSec: 0.04, gainPeak: 0.12 },
  chip: { type: 'triangle', frequency: 120, durationSec: 0.08, gainPeak: 0.2 },
  capture: {
    type: 'sawtooth',
    frequency: 400,
    frequencyEnd: 1200,
    durationSec: 0.18,
    gainPeak: 0.28,
  },
  gold: {
    type: 'sine',
    frequency: 600,
    frequencyEnd: 1400,
    durationSec: 0.12,
    gainPeak: 0.15,
  },
  waveClear: {
    type: 'sine',
    frequency: 330,
    frequencyEnd: 660,
    durationSec: 0.35,
    gainPeak: 0.22,
  },
  upgrade: { type: 'square', frequency: 520, frequencyEnd: 780, durationSec: 0.1, gainPeak: 0.14 },
  promotion: {
    type: 'triangle',
    frequency: 440,
    frequencyEnd: 880,
    durationSec: 0.25,
    gainPeak: 0.2,
  },
  leak: { type: 'sawtooth', frequency: 90, durationSec: 0.15, gainPeak: 0.25 },
  fail: { type: 'triangle', frequency: 180, frequencyEnd: 80, durationSec: 0.3, gainPeak: 0.2 },
  prestige: {
    type: 'sine',
    frequency: 262,
    frequencyEnd: 523,
    durationSec: 0.5,
    gainPeak: 0.25,
  },
  metaPurchase: {
    type: 'sine',
    frequency: 392,
    frequencyEnd: 784,
    durationSec: 0.22,
    gainPeak: 0.18,
  },
  supporterPurchase: {
    type: 'triangle',
    frequency: 523,
    frequencyEnd: 1046,
    durationSec: 0.28,
    gainPeak: 0.2,
  },
}

/** Piece-tier pitch mapping for damage feedback (Hz). */
export const COMBAT_PITCH_PROFILE = {
  light: { chip: 980, chipEnd: 1400, capture: 520, captureEnd: 1100, gainScale: 0.92 },
  mid: { chip: 420, chipEnd: 720, capture: 280, captureEnd: 560, gainScale: 1 },
  heavy: { chip: 72, chipEnd: 110, capture: 58, captureEnd: 95, gainScale: 1.08 },
} as const

export type CombatPitchTier = keyof typeof COMBAT_PITCH_PROFILE

export function pieceKindToPitchTier(kind: PieceKind): CombatPitchTier {
  if (kind === 'pawn') return 'light'
  if (kind === 'knight' || kind === 'bishop') return 'mid'
  return 'heavy'
}

export interface SfxPlayOptions {
  frequency?: number
  frequencyEnd?: number
  gainScale?: number
  /** Counts toward combat voice limit when true. */
  combatVoice?: boolean
}

/**
 * Plays a one-shot procedural blip through the shared master bus.
 */
export function playProceduralSfx(
  ctx: AudioContext,
  destination: AudioNode,
  id: SfxId,
  volume: number,
  options: SfxPlayOptions = {},
): void {
  if (options.combatVoice && activeCombatVoices >= COMBAT_SFX_VOICE_LIMIT) {
    return
  }

  const preset = SFX_PRESETS[id]
  const now = ctx.currentTime
  const gainScale = options.gainScale ?? 1
  const peak = preset.gainPeak * gainScale * Math.max(0, Math.min(1, volume))
  const startFreq = options.frequency ?? preset.frequency
  const endFreq = options.frequencyEnd ?? preset.frequencyEnd

  const osc = ctx.createOscillator()
  osc.type = preset.type
  osc.frequency.setValueAtTime(startFreq, now)
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, endFreq),
      now + preset.durationSec,
    )
  }

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, now + preset.durationSec)

  osc.connect(gain)
  gain.connect(destination)
  osc.start(now)
  osc.stop(now + preset.durationSec + 0.02)

  if (options.combatVoice) {
    activeCombatVoices += 1
    osc.onended = () => {
      activeCombatVoices = Math.max(0, activeCombatVoices - 1)
    }
  }
}

/**
 * Prestige reset — rapid ascending sweep that collapses into the main theme register.
 */
export function playPrestigeChime(
  ctx: AudioContext,
  destination: AudioNode,
  volume: number,
): void {
  const now = ctx.currentTime
  const peak = 0.28 * Math.max(0, Math.min(1, volume))
  const sweepSec = 0.38
  const settleSec = 0.45

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(196, now)
  osc.frequency.exponentialRampToValueAtTime(1568, now + sweepSec)
  osc.frequency.exponentialRampToValueAtTime(329.63, now + sweepSec + settleSec)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), now + 0.04)
  gain.gain.setValueAtTime(peak * 0.65, now + sweepSec)
  gain.gain.exponentialRampToValueAtTime(0.001, now + sweepSec + settleSec)

  osc.connect(gain)
  gain.connect(destination)
  osc.start(now)
  osc.stop(now + sweepSec + settleSec + 0.05)
}

/** Pitch-mapped combat chip / clash from attacker piece tier. */
export function playPitchMappedCombatSfx(
  ctx: AudioContext,
  destination: AudioNode,
  kind: 'chip' | 'capture' | 'clash',
  tier: CombatPitchTier,
  volume: number,
): void {
  const profile = COMBAT_PITCH_PROFILE[tier]
  const id: SfxId = kind === 'capture' ? 'capture' : 'chip'
  playProceduralSfx(ctx, destination, id, volume, {
    frequency: kind === 'capture' ? profile.capture : profile.chip,
    frequencyEnd: kind === 'capture' ? profile.captureEnd : profile.chipEnd,
    gainScale: profile.gainScale,
    combatVoice: true,
  })
}

interface LayerStepConfig {
  type: OscillatorType
  gainScale: number
  noteOffset: number
  durationSec: number
}

const LAYER_STEP_CONFIG: Record<MusicLayerId, LayerStepConfig> = {
  base: { type: 'sine', gainScale: 0.08, noteOffset: 0, durationSec: 0.38 },
  synth: { type: 'triangle', gainScale: 0.06, noteOffset: 2, durationSec: 0.32 },
  arpeggio: { type: 'square', gainScale: 0.05, noteOffset: 1, durationSec: 0.28 },
  percussion: { type: 'square', gainScale: 0.04, noteOffset: 0, durationSec: 0.06 },
  pulse: { type: 'sawtooth', gainScale: 0.045, noteOffset: 3, durationSec: 0.2 },
  harmony: { type: 'triangle', gainScale: 0.05, noteOffset: 4, durationSec: 0.4 },
  strings: { type: 'sine', gainScale: 0.055, noteOffset: 1, durationSec: 0.45 },
  choral: { type: 'sine', gainScale: 0.05, noteOffset: 5, durationSec: 0.5 },
  brass: { type: 'sawtooth', gainScale: 0.04, noteOffset: 2, durationSec: 0.22 },
  orchestral: { type: 'triangle', gainScale: 0.06, noteOffset: 3, durationSec: 0.42 },
  celestial: { type: 'sine', gainScale: 0.05, noteOffset: 6, durationSec: 0.35 },
  god: { type: 'sine', gainScale: 0.07, noteOffset: 4, durationSec: 0.55 },
}

/**
 * Grandmaster Phase III — dissonant low drone until the boss falls.
 */
export class GrandmasterTensionDrone {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private master: GainNode | null = null
  private oscA: OscillatorNode | null = null
  private oscB: OscillatorNode | null = null
  private running = false

  attach(ctx: AudioContext, destination: GainNode): void {
    this.ctx = ctx
    this.bus = ctx.createGain()
    this.bus.gain.value = 0
    this.bus.connect(destination)
  }

  isRunning(): boolean {
    return this.running
  }

  start(volume: number): void {
    if (!this.ctx || !this.bus || this.running) return
    this.stop()

    const ctx = this.ctx
    const now = ctx.currentTime
    const peak = 0.14 * Math.max(0, Math.min(1, volume))

    this.master = ctx.createGain()
    this.master.gain.setValueAtTime(0.001, now)
    this.master.gain.linearRampToValueAtTime(peak, now + 1.8)

    this.oscA = ctx.createOscillator()
    this.oscA.type = 'sawtooth'
    this.oscA.frequency.setValueAtTime(52, now)

    this.oscB = ctx.createOscillator()
    this.oscB.type = 'triangle'
    this.oscB.frequency.setValueAtTime(55.4, now)

    this.oscA.connect(this.master)
    this.oscB.connect(this.master)
    this.master.connect(this.bus)

    this.oscA.start(now)
    this.oscB.start(now)
    this.bus.gain.linearRampToValueAtTime(1, now + 0.6)
    this.running = true
  }

  stop(): void {
    if (!this.ctx || !this.bus) {
      this.running = false
      return
    }
    const now = this.ctx.currentTime
    this.bus.gain.linearRampToValueAtTime(0, now + 0.4)

    const stopAt = now + 0.45
    for (const osc of [this.oscA, this.oscB]) {
      if (osc) {
        try {
          osc.stop(stopAt)
        } catch {
          // already stopped
        }
      }
    }
    if (this.master) {
      try {
        this.master.disconnect()
      } catch {
        // noop
      }
    }
    this.oscA = null
    this.oscB = null
    this.master = null
    this.running = false
  }
}

/**
 * Additive music stack — relaxed ambient vs intense boss buses with 2s crossfade.
 */
export class ProceduralMusicLoop {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambientBus: GainNode | null = null
  private bossBus: GainNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private mode: MusicMode = 'off'
  private blendTarget: 'ambient' | 'boss' = 'ambient'
  private stepAmbient = 0
  private stepBoss = 0
  private volume = 0.35
  private activeLayers: MusicLayerId[] = ['base']
  private mixStage = 1
  private mixPrestige = 0

  attach(ctx: AudioContext, destination: GainNode): void {
    this.ctx = ctx
    this.master = destination
    this.ambientBus = ctx.createGain()
    this.bossBus = ctx.createGain()
    this.ambientBus.connect(destination)
    this.bossBus.connect(destination)
    this.ambientBus.gain.value = 1
    this.bossBus.gain.value = 0
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.master) {
      this.master.gain.setTargetAtTime(this.volume * 0.35, this.ctx!.currentTime, 0.05)
    }
  }

  setMixContext(currentStage: number, prestigeLevel: number): void {
    this.mixStage = Math.max(1, Math.floor(currentStage))
    this.mixPrestige = Math.max(0, Math.floor(prestigeLevel))
  }

  getMode(): MusicMode {
    return this.mode
  }

  getActiveLayers(): readonly MusicLayerId[] {
    return this.activeLayers
  }

  getBlendTarget(): 'ambient' | 'boss' {
    return this.blendTarget
  }

  /**
   * @param layers Unlocked layer ids from `getUnlockedMusicLayers` (must include `base`).
   */
  start(
    mode: Exclude<MusicMode, 'off'>,
    layers: readonly MusicLayerId[] = ['base'],
  ): void {
    if (!this.ctx || !this.ambientBus || !this.bossBus) return
    const nextLayers: MusicLayerId[] = layers.length > 0 ? [...layers] : ['base']
    const blendTarget = mode === 'boss' ? 'boss' : 'ambient'
    const layersChanged =
      nextLayers.length !== this.activeLayers.length ||
      nextLayers.some((id, i) => id !== this.activeLayers[i])

    if (this.mode === 'off' || !this.timer) {
      this.mode = mode
      this.activeLayers = nextLayers
      this.blendTarget = blendTarget
      this.applyModeCrossfade(blendTarget)
      const intervalMs = 400
      this.timer = setInterval(() => this.playStep(), intervalMs)
      this.playStep()
      return
    }

    if (layersChanged) {
      this.activeLayers = nextLayers
    }
    if (this.blendTarget !== blendTarget) {
      this.blendTarget = blendTarget
      this.applyModeCrossfade(blendTarget)
    }
    this.mode = mode
  }

  private applyModeCrossfade(target: 'ambient' | 'boss'): void {
    if (!this.ctx || !this.ambientBus || !this.bossBus) return
    const now = this.ctx.currentTime
    const end = now + MUSIC_MODE_CROSSFADE_SEC
    if (target === 'boss') {
      this.ambientBus.gain.cancelScheduledValues(now)
      this.bossBus.gain.cancelScheduledValues(now)
      this.ambientBus.gain.setValueAtTime(this.ambientBus.gain.value, now)
      this.bossBus.gain.setValueAtTime(this.bossBus.gain.value, now)
      this.ambientBus.gain.linearRampToValueAtTime(0, end)
      this.bossBus.gain.linearRampToValueAtTime(1, end)
    } else {
      this.ambientBus.gain.cancelScheduledValues(now)
      this.bossBus.gain.cancelScheduledValues(now)
      this.ambientBus.gain.setValueAtTime(this.ambientBus.gain.value, now)
      this.bossBus.gain.setValueAtTime(this.bossBus.gain.value, now)
      this.ambientBus.gain.linearRampToValueAtTime(1, end)
      this.bossBus.gain.linearRampToValueAtTime(0, end)
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.ctx && this.ambientBus && this.bossBus) {
      const now = this.ctx.currentTime
      this.ambientBus.gain.cancelScheduledValues(now)
      this.bossBus.gain.cancelScheduledValues(now)
      this.ambientBus.gain.setValueAtTime(0, now)
      this.bossBus.gain.setValueAtTime(0, now)
    }
    this.mode = 'off'
  }

  private playStep(): void {
    if (!this.ctx || !this.ambientBus || !this.bossBus || this.mode === 'off') return
    this.playModeStep('ambient', this.ambientBus, this.stepAmbient)
    this.playModeStep('boss', this.bossBus, this.stepBoss)
    this.stepAmbient += 1
    this.stepBoss += 1
  }

  private playModeStep(
    loopMode: 'ambient' | 'boss',
    bus: GainNode,
    step: number,
  ): void {
    if (!this.ctx) return
    const notes = loopMode === 'boss' ? BOSS_NOTES : AMBIENT_NOTES
    const now = this.ctx.currentTime
    const modeIntensity = loopMode === 'boss' ? 1.15 : 1

    for (const layerId of this.activeLayers) {
      const config = LAYER_STEP_CONFIG[layerId]
      if (layerId === 'percussion' && step % 4 !== 0) continue
      if (layerId === 'pulse' && step % 2 !== 0) continue
      if (layerId === 'god' && step % 8 !== 0) continue

      const dynamicGain = computeDynamicLayerGain(
        layerId,
        this.mixStage,
        this.mixPrestige,
      )
      const freq = notes[(step + config.noteOffset) % notes.length]!
      const osc = this.ctx.createOscillator()
      osc.type =
        loopMode === 'boss' && layerId === 'arpeggio' ? 'square' : config.type
      osc.frequency.setValueAtTime(freq, now)

      const gain = this.ctx.createGain()
      const peak =
        this.volume * config.gainScale * dynamicGain * modeIntensity
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + config.durationSec)

      osc.connect(gain)
      gain.connect(bus)
      osc.start(now)
      osc.stop(now + config.durationSec + 0.02)
    }
  }
}

/**
 * Music mode from wave phase — boss stages use faster interval during combat/clear.
 */
export function resolveMusicMode(
  wavePhase: string,
  isBossStage: boolean,
): MusicMode {
  if (wavePhase === 'WAVE_ACTIVE' || wavePhase === 'WAVE_COMPLETE') {
    return isBossStage ? 'boss' : 'ambient'
  }
  if (wavePhase === 'WAVE_PREP') return 'ambient'
  return 'off'
}

/** Maps combat feedback kinds to procedural SFX ids. */
export function sfxFromFeedbackKind(kind: string): SfxId | null {
  switch (kind) {
    case 'capture':
      return 'capture'
    case 'chip':
    case 'clash':
    case 'reflect':
      return 'chip'
    case 'gold':
      return 'gold'
    case 'leak':
      return 'leak'
    default:
      return null
  }
}

export function resetCombatVoiceCountForTests(): void {
  activeCombatVoices = 0
}
