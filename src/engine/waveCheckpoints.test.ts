import { describe, expect, it } from 'vitest'
import {
  getWaveCheckpointStage,
  resolveStageAfterFail,
  isNewCheckpointUnlocked,
} from '@/engine/waveCheckpoints'

describe('waveCheckpoints', () => {
  it('starts at milestone 1', () => {
    expect(getWaveCheckpointStage(1)).toBe(1)
    expect(getWaveCheckpointStage(5)).toBe(1)
  })

  it('unlocks checkpoint 10 after clearing stage 10', () => {
    expect(getWaveCheckpointStage(11)).toBe(10)
  })

  it('rewinds from stage 12 to checkpoint 10', () => {
    const result = resolveStageAfterFail(12, 11)
    expect(result.rewound).toBe(true)
    expect(result.nextStage).toBe(10)
    expect(result.checkpoint).toBe(10)
  })

  it('retries same stage when already at checkpoint', () => {
    const result = resolveStageAfterFail(10, 11)
    expect(result.rewound).toBe(false)
    expect(result.nextStage).toBe(10)
  })

  it('includes endless boss checkpoints after 50', () => {
    expect(getWaveCheckpointStage(61)).toBe(60)
    const fail = resolveStageAfterFail(65, 61)
    expect(fail.nextStage).toBe(60)
  })

  it('detects newly secured checkpoint after boss clear', () => {
    expect(isNewCheckpointUnlocked(10, 1)).toBe(true)
    expect(isNewCheckpointUnlocked(11, 10)).toBe(false)
  })
})
