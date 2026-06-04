import { describe, expect, it } from 'vitest'
import {
  resolveMusicMode,
  SFX_PRESETS,
  sfxFromFeedbackKind,
} from './proceduralAudio'

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
})
