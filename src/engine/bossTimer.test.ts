import { describe, expect, it } from 'vitest'
import {
  BASE_BOSS_WAVE_MS,
  BOSS_TIMER_EXTENSION_MS,
  getBossTimerExtensionMs,
  getBossTimeRemainingMs,
  getBossWaveLimitMs,
  isBossWaveTimedOut,
} from '@/engine/bossTimer'

describe('bossTimer', () => {
  it('returns zero limit on non-boss stages', () => {
    expect(getBossWaveLimitMs(9, {})).toBe(0)
  })

  it('adds 180s base on boss stages', () => {
    expect(getBossWaveLimitMs(10, {})).toBe(BASE_BOSS_WAVE_MS)
  })

  it('extends boss timer per Deep Clock rank', () => {
    expect(getBossTimerExtensionMs({ deepClock: 1 })).toBe(BOSS_TIMER_EXTENSION_MS)
    expect(getBossWaveLimitMs(50, { deepClock: 1 })).toBe(
      BASE_BOSS_WAVE_MS + BOSS_TIMER_EXTENSION_MS,
    )
  })

  it('tracks remaining time and timeout', () => {
    const deadline = 10_000
    expect(getBossTimeRemainingMs(deadline, 4_000)).toBe(6_000)
    expect(isBossWaveTimedOut(deadline, 10_000)).toBe(true)
    expect(isBossWaveTimedOut(null, 99_999)).toBe(false)
  })
})
