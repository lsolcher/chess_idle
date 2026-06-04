import { describe, expect, it } from 'vitest'
import { getCombatTimeMs, isCombatTimePaused } from './combatTime'

describe('combatTime', () => {
  it('freezes combat clock during manual player turn', () => {
    const input = {
      autoMode: false,
      manualPendingPieceId: 'player-king-0',
      lastSimulatedMs: 5000,
      nowMs: 60_000,
    }
    expect(getCombatTimeMs(input)).toBe(5000)
    expect(isCombatTimePaused(input)).toBe(true)
  })

  it('uses wall clock in auto and manual between turns', () => {
    expect(
      getCombatTimeMs({
        autoMode: true,
        manualPendingPieceId: null,
        lastSimulatedMs: 1000,
        nowMs: 9000,
      }),
    ).toBe(9000)

    expect(
      getCombatTimeMs({
        autoMode: false,
        manualPendingPieceId: null,
        lastSimulatedMs: 1000,
        nowMs: 9000,
      }),
    ).toBe(9000)
  })
})
