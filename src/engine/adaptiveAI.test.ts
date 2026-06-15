import { describe, expect, it } from 'vitest'
import { resolveAdaptiveHeuristicPersonality, resolveEffectiveAutoAiPersonality } from '@/engine/adaptiveAI'

describe('adaptiveAI', () => {
  it('starts defensive for early runs', () => {
    expect(resolveAdaptiveHeuristicPersonality(0, 5)).toBe('defensive')
  })

  it('maps adaptive personality through elo and stage', () => {
    expect(resolveEffectiveAutoAiPersonality('adaptive', 30, 40)).toBe('protectKing')
  })
})
