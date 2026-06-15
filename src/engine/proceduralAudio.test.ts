import { describe, expect, it } from 'vitest'
import {
  COMBAT_PITCH_PROFILE,
  MUSIC_MODE_CROSSFADE_SEC,
  pieceKindToPitchTier,
  resolveMusicMode,
  SFX_PRESETS,
  sfxFromFeedbackKind,
} from './proceduralAudio'
import { computeDynamicLayerGain } from './musicLayers'

describe('proceduralAudio', () => {
  it('defines positive-duration presets for every SFX id', () => {
    for (const preset of Object.values(SFX_PRESETS)) {
      expect(preset.durationSec).toBeGreaterThan(0)
      expect(preset.gainPeak).toBeGreaterThan(0)
      expect(preset.frequency).toBeGreaterThan(40)
    }
  })

  it('maps combat feedback kinds to SFX', () => {
    expect(sfxFromFeedbackKind('capture')).toBe('capture')
    expect(sfxFromFeedbackKind('chip')).toBe('chip')
    expect(sfxFromFeedbackKind('reflect')).toBe('chip')
    expect(sfxFromFeedbackKind('gold')).toBe('gold')
    expect(sfxFromFeedbackKind('leak')).toBe('leak')
    expect(sfxFromFeedbackKind('unknown')).toBeNull()
  })

  it('resolves music mode from wave phase and boss flag', () => {
    expect(resolveMusicMode('WAVE_PREP', false)).toBe('ambient')
    expect(resolveMusicMode('WAVE_ACTIVE', false)).toBe('ambient')
    expect(resolveMusicMode('WAVE_ACTIVE', true)).toBe('boss')
    expect(resolveMusicMode('WAVE_COMPLETE', true)).toBe('boss')
    expect(resolveMusicMode('UNKNOWN', true)).toBe('off')
  })

  it('uses a 2-second boss vs ambient crossfade constant', () => {
    expect(MUSIC_MODE_CROSSFADE_SEC).toBe(2)
  })

  it('maps piece tiers for pitch (pawn bright, rook/queen heavy)', () => {
    expect(pieceKindToPitchTier('pawn')).toBe('light')
    expect(pieceKindToPitchTier('rook')).toBe('heavy')
    expect(pieceKindToPitchTier('queen')).toBe('heavy')
    expect(COMBAT_PITCH_PROFILE.light.chip).toBeGreaterThan(COMBAT_PITCH_PROFILE.heavy.chip)
  })
})

describe('musicLayers dynamic mix', () => {
  it('boosts early layers at low stage and choral at high stage', () => {
    const earlyArp = computeDynamicLayerGain('arpeggio', 5, 0)
    const lateChoral = computeDynamicLayerGain('choral', 80, 2)
    expect(earlyArp).toBeGreaterThan(1)
    expect(lateChoral).toBeGreaterThan(earlyArp)
  })
})
