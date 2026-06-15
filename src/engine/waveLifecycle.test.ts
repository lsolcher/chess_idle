import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '@/types/game'
import {
  computeAdvanceStageAfterClear,
  computeFailWaveResolution,
  evaluateWaveOutcomeState,
} from './waveLifecycle'

describe('waveLifecycle', () => {
  it('detects wave clear and fail', () => {
    const state = createInitialGameState(0)
    expect(evaluateWaveOutcomeState('WAVE_PREP', state.playerPieces, [])).toEqual({
      shouldFail: false,
      shouldComplete: false,
    })
    state.wavePhase = 'WAVE_ACTIVE'
    expect(evaluateWaveOutcomeState(state.wavePhase, state.playerPieces, [])).toEqual({
      shouldFail: false,
      shouldComplete: true,
    })
  })

  it('advances stage after clear', () => {
    const state = createInitialGameState(0)
    const next = computeAdvanceStageAfterClear({
      playerPieces: state.playerPieces,
      enPassantCarryByPieceId: state.enPassantCarryByPieceId,
      enPassantEconomyRank: 0,
      currentStage: 5,
      maxStageReached: 5,
      lifetime: state.lifetime,
    })
    expect(next.currentStage).toBe(6)
    expect(next.maxStageReached).toBe(6)
  })

  it('softens fail HP scale when not rewinding', () => {
    const fail = computeFailWaveResolution(10, 20, 0, 1)
    expect(fail.failCountThisStage).toBe(1)
    expect(fail.enemyHpScale).toBeLessThan(1)
  })
})
