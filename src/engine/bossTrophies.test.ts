import { describe, expect, it } from 'vitest'

import { evaluateBossTrophyAward } from '@/engine/bossTrophies'

describe('bossTrophies', () => {
  it('awards once per boss stage', () => {
    const first = evaluateBossTrophyAward(10, [])
    expect(first?.trophyName).toBe('Phantom Trophy')
    const repeat = evaluateBossTrophyAward(10, [10])
    expect(repeat).toBeNull()
  })
})
