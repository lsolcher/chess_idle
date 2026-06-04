import { describe, expect, it } from 'vitest'

import {
  getExhibitionBoardConfigs,
  calculateTotalExhibitionGoldPerSec,
  EXHIBITION_INITIATIVE_RATE_MULT,
} from '@/engine/exhibitions'
import { createInitialGameState } from '@/types/game'

describe('exhibitions', () => {
  it('unlocks board B then C by rank', () => {
    expect(getExhibitionBoardConfigs(0, 30)).toEqual([])
    const one = getExhibitionBoardConfigs(1, 30)
    expect(one).toHaveLength(1)
    expect(one[0]?.id).toBe('B')
    expect(one[0]?.stage).toBe(25)
    expect(one[0]?.goldMult).toBe(0.5)

    const three = getExhibitionBoardConfigs(3, 30)
    expect(three).toHaveLength(2)
    expect(three[1]?.id).toBe('C')
    expect(three[1]?.goldMult).toBe(0.4)
  })

  it('rank 2 raises board B gold to 65%', () => {
    const boards = getExhibitionBoardConfigs(2, 20)
    expect(boards[0]?.goldMult).toBe(0.65)
  })

  it('earns positive gold per sec with solo king roster', () => {
    const state = createInitialGameState(0)
    state.metaUpgrades.simultaneousExhibitions = 1
    const gps = calculateTotalExhibitionGoldPerSec(
      1,
      state.currentStage,
      state.playerPieces,
      1,
      1,
    )
    expect(gps).toBeGreaterThan(0)
    expect(EXHIBITION_INITIATIVE_RATE_MULT).toBe(0.5)
  })
})
