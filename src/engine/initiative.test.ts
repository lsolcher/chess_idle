import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  bootstrapPieceInitiative,
  computeInitiativeProgress,
  getPieceIntervalMs,
  processReadyInitiativeActions,
  runInitiativeEngineSanityCheck,
  simulateInitiativeWindow,
} from './initiative'

describe('initiative engine', () => {
  it('computes king base interval near 3000ms', () => {
    const king = createPiece('k1', 'king', 'player', { file: 4, rank: 0 })
    expect(getPieceIntervalMs(king, 1)).toBeCloseTo(3000, -1)
  })

  it('fires action when clock reaches nextActionAtMs', () => {
    const t0 = 1000
    const king = bootstrapPieceInitiative(
      createPiece('k1', 'king', 'player', { file: 4, rank: 0 }),
      t0,
      1,
    )
    const interval = getPieceIntervalMs(king, 1)

    const before = processReadyInitiativeActions([king], t0 + interval - 1, 1)
    expect(before.actedPieceIds).toHaveLength(0)

    const after = processReadyInitiativeActions([king], t0 + interval, 1)
    expect(after.actedPieceIds).toHaveLength(1)
  })

  it('pawn acts faster than king at ini level 0', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('p', 'pawn', 'player', { file: 4, rank: 1 })
    expect(getPieceIntervalMs(pawn, 1)).toBeLessThan(getPieceIntervalMs(king, 1))
  })

  it('simulates multiple actions over a time window', () => {
    const t0 = 0
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const { totalActions } = simulateInitiativeWindow([king], t0, t0 + 15_000, 1)
    expect(totalActions).toBeGreaterThanOrEqual(4)
    expect(totalActions).toBeLessThanOrEqual(6)
  })

  it('progress stays within 0–1', () => {
    const king = bootstrapPieceInitiative(
      createPiece('k', 'king', 'player', { file: 4, rank: 0 }),
      0,
      1,
    )
    const progress = computeInitiativeProgress(king, 5000, 1)
    expect(progress).toBeGreaterThanOrEqual(0)
    expect(progress).toBeLessThanOrEqual(1)
  })

  it('passes headless sanity check', () => {
    expect(runInitiativeEngineSanityCheck(0).passed).toBe(true)
  })
})

describe('initiative interval matrix (base pieces, ini L0)', () => {
  it('documents GDD base intervals', () => {
    const samples = (
      [
        ['king', 3.0],
        ['pawn', 2.4],
        ['knight', 2.0],
        ['bishop', 2.1],
        ['rook', 2.8],
        ['queen', 1.8],
      ] as const
    ).map(([kind, expectedSec]) => {
      const piece = createPiece(`${kind}-x`, kind, 'player', { file: 0, rank: 0 })
      return {
        kind,
        expectedSec,
        actualSec: getPieceIntervalMs(piece, 1) / 1000,
      }
    })

    for (const row of samples) {
      expect(row.actualSec).toBeCloseTo(row.expectedSec, 1)
    }
  })
})
