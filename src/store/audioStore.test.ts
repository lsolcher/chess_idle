import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { resolveMusicMode } from '@/engine/proceduralAudio'
import { useAudioStore } from './audioStore'

describe('useAudioStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('defaults volumes and mute state', () => {
    const audio = useAudioStore()
    expect(audio.muted).toBe(false)
    expect(audio.sfxVolume).toBeCloseTo(0.75)
    expect(audio.musicVolume).toBeCloseTo(0.4)
    expect(audio.unlocked).toBe(false)
    expect(audio.effectiveSfxVolume).toBe(0)
  })

  it('zeros effective volume when muted', () => {
    const audio = useAudioStore()
    audio.unlocked = true
    audio.setMuted(true)
    expect(audio.effectiveSfxVolume).toBe(0)
    expect(audio.effectiveMusicVolume).toBe(0)
  })

  it('syncMusicMode uses boss arpeggio on boss combat', () => {
    const audio = useAudioStore()
    audio.unlocked = true
    audio.syncMusicMode({ wavePhase: 'WAVE_ACTIVE', isBossStage: true })
    expect(resolveMusicMode('WAVE_ACTIVE', true)).toBe('boss')
  })
})
