/**
 * Procedural Web Audio synthesis — no external assets (Phase 7 / 8.6 layered music).
 * Uses oscillators + envelopes for SFX and additive music layers (outside combat tick).
 */
import type { MusicLayerId } from '@/engine/musicLayers'

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

export type MusicMode = 'off' | 'ambient' | 'boss'

/** Pentatonic roots for ambient vs boss intensity (Hz). */
const AMBIENT_NOTES = [220, 261.63, 329.63, 392, 493.88]
const BOSS_NOTES = [146.83, 174.61, 220, 261.63, 329.63, 392]

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
}

/**
 * Plays a one-shot procedural blip through the shared master bus.
 */
export function playProceduralSfx(
  ctx: AudioContext,
  destination: AudioNode,
  id: SfxId,
  volume: number,
): void {
  const preset = SFX_PRESETS[id]
  const now = ctx.currentTime
  const peak = preset.gainPeak * Math.max(0, Math.min(1, volume))

  const osc = ctx.createOscillator()
  osc.type = preset.type
  osc.frequency.setValueAtTime(preset.frequency, now)
  if (preset.frequencyEnd) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, preset.frequencyEnd),
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
 * Additive music stack — one interval tick plays short notes per unlocked layer.
 * Not invoked from combat initiative; runs on a slow timer only.
 */
export class ProceduralMusicLoop {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private mode: MusicMode = 'off'
  private step = 0
  private volume = 0.35
  private activeLayers: MusicLayerId[] = ['base']

  attach(ctx: AudioContext, destination: GainNode): void {
    this.ctx = ctx
    this.master = destination
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.master) {
      this.master.gain.setTargetAtTime(this.volume * 0.35, this.ctx!.currentTime, 0.05)
    }
  }

  getMode(): MusicMode {
    return this.mode
  }

  getActiveLayers(): readonly MusicLayerId[] {
    return this.activeLayers
  }

  /**
   * @param layers Unlocked layer ids from `getUnlockedMusicLayers` (must include `base`).
   */
  start(
    mode: Exclude<MusicMode, 'off'>,
    layers: readonly MusicLayerId[] = ['base'],
  ): void {
    if (!this.ctx || !this.master) return
    const nextLayers: MusicLayerId[] = layers.length > 0 ? [...layers] : ['base']
    const sameMode =
      this.mode === mode &&
      this.timer &&
      nextLayers.length === this.activeLayers.length &&
      nextLayers.every((id, i) => id === this.activeLayers[i])
    if (sameMode) return

    this.stop()
    this.mode = mode
    this.activeLayers = nextLayers
    const intervalMs = mode === 'boss' ? 280 : 520
    this.timer = setInterval(() => this.playStep(), intervalMs)
    this.playStep()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.mode = 'off'
  }

  private playStep(): void {
    if (!this.ctx || !this.master || this.mode === 'off') return
    const notes = this.mode === 'boss' ? BOSS_NOTES : AMBIENT_NOTES
    const now = this.ctx.currentTime

    for (const layerId of this.activeLayers) {
      const config = LAYER_STEP_CONFIG[layerId]
      if (layerId === 'percussion' && this.step % 4 !== 0) continue
      if (layerId === 'pulse' && this.step % 2 !== 0) continue
      if (layerId === 'god' && this.step % 8 !== 0) continue

      const freq = notes[(this.step + config.noteOffset) % notes.length]!
      const osc = this.ctx.createOscillator()
      osc.type = this.mode === 'boss' && layerId === 'arpeggio' ? 'square' : config.type
      osc.frequency.setValueAtTime(freq, now)

      const gain = this.ctx.createGain()
      const peak =
        this.volume *
        config.gainScale *
        (this.mode === 'boss' ? 1.15 : 1)
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + config.durationSec)

      osc.connect(gain)
      gain.connect(this.master)
      osc.start(now)
      osc.stop(now + config.durationSec + 0.02)
    }

    this.step += 1
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
export function sfxFromFeedbackKind(
  kind: string,
): SfxId | null {
  switch (kind) {
    case 'capture':
      return 'capture'
    case 'chip':
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
