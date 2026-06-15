import { describe, expect, it } from 'vitest'
import {
  computeDynamicLayerGain,
  getUnlockedMusicLayers,
  MUSIC_LAYER_UNLOCK_TABLE,
} from '@/engine/musicLayers'

describe('musicLayers', () => {
  it('always includes base layer', () => {
    expect(getUnlockedMusicLayers(1, 0)).toContain('base')
  })

  it('unlocks early layers by stage 8', () => {
    const layers = getUnlockedMusicLayers(8, 0)
    expect(layers).toEqual(
      expect.arrayContaining(['base', 'synth', 'arpeggio', 'percussion']),
    )
  })

  it('requires prestige for god layer', () => {
    expect(getUnlockedMusicLayers(50, 2)).not.toContain('god')
    expect(getUnlockedMusicLayers(50, 3)).toContain('god')
  })

  it('documents twelve layers in unlock table', () => {
    expect(MUSIC_LAYER_UNLOCK_TABLE.length).toBe(12)
  })

  it('returns neutral gain for non-profile layers', () => {
    expect(computeDynamicLayerGain('percussion', 50, 2)).toBe(1)
  })
})
