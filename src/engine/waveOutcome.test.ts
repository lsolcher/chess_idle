import { describe, expect, it } from 'vitest'
import {
  buildDefeatReport,
  buildVictoryReport,
  createEmptyWaveCombatStats,
  totalWaveGold,
} from '@/engine/waveOutcome'

describe('waveOutcome', () => {
  it('sums gold breakdown into total', () => {
    const stats = {
      ...createEmptyWaveCombatStats(),
      goldFromClear: 100,
      goldFromCaptures: 50,
      goldFromActions: 25,
    }
    expect(totalWaveGold(stats)).toBe(175)
  })

  it('builds victory report with next stage', () => {
    const report = buildVictoryReport({
      foughtStage: 9,
      nextStage: 10,
      stats: createEmptyWaveCombatStats(),
      trophyName: 'Iron Trophy',
      checkpointStage: 6,
    })
    expect(report.kind).toBe('victory')
    expect(report.nextStage).toBe(10)
    expect(report.trophyName).toBe('Iron Trophy')
  })

  it('builds defeat report with rewind metadata', () => {
    const report = buildDefeatReport({
      foughtStage: 12,
      nextStage: 10,
      stats: { ...createEmptyWaveCombatStats(), damageTaken: 40 },
      failRewindToStage: 10,
      checkpointStage: 10,
      failCountThisStage: 0,
      enemyHpScale: 1,
      kingFallMessage: 'King fell.',
      kingFallTelegraph: 'Cause: leak.',
    })
    expect(report.kind).toBe('defeat')
    expect(report.failRewindToStage).toBe(10)
    expect(report.stats.damageTaken).toBe(40)
  })
})
