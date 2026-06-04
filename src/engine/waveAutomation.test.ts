import { describe, expect, it } from 'vitest'

import { AUTO_ADVANCE_DELAY_MS, evaluateAutoAdvanceTick } from '@/engine/waveAutomation'

describe('waveAutomation', () => {
  it('waits delay in prep before auto-starting', () => {
    const early = evaluateAutoAdvanceTick({
      wavePhase: 'WAVE_PREP',
      purchased: true,
      enabled: true,
      waveCompleteAtMs: 1000,
      nowMs: 1000 + AUTO_ADVANCE_DELAY_MS - 1,
      autoStartNextWave: true,
    })
    expect(early.shouldStartWave).toBe(false)

    const ready = evaluateAutoAdvanceTick({
      wavePhase: 'WAVE_PREP',
      purchased: true,
      enabled: true,
      waveCompleteAtMs: 1000,
      nowMs: 1000 + AUTO_ADVANCE_DELAY_MS,
      autoStartNextWave: true,
    })
    expect(ready.shouldStartWave).toBe(true)
  })

  it('does nothing when disabled', () => {
    const result = evaluateAutoAdvanceTick({
      wavePhase: 'WAVE_PREP',
      purchased: true,
      enabled: false,
      waveCompleteAtMs: 1000,
      nowMs: 5000,
      autoStartNextWave: true,
    })
    expect(result.shouldStartWave).toBe(false)
  })

  it('does not auto-start while the outcome modal is open', () => {
    const result = evaluateAutoAdvanceTick({
      wavePhase: 'WAVE_PREP',
      purchased: true,
      enabled: true,
      waveCompleteAtMs: 1000,
      nowMs: 1000 + AUTO_ADVANCE_DELAY_MS,
      autoStartNextWave: true,
      prepUiBlocked: true,
    })
    expect(result.shouldStartWave).toBe(false)
    expect(result.waveCompleteAtMs).toBe(1000)
  })
})
