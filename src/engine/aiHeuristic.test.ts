import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  AI_WEIGHTS,
  DECREE_SOLO_KING_WEIGHTS,
  isPawnApproachSquare,
  isSoloDecreeKing,
  runAiHeuristicSanityCheck,
  scoreAllMoves,
  scoreMove,
  selectBestMove,
} from './aiHeuristic'

describe('ai heuristic', () => {
  it('prefers capture over idle advance when enemy is hanging', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('pp', 'pawn', 'player', { file: 4, rank: 1 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 5, rank: 2 })

    const best = selectBestMove(pawn, {
      allPieces: [king, pawn, enemy],
      decreeStepEnabled: false,
      personality: 'defensive',
      movingPiece: pawn,
    })

    expect(best?.isCapture).toBe(true)
    expect(best?.to.file).toBe(5)
    expect(best?.to.rank).toBe(2)
  })

  it('scores capture term at GDD weight baseline', () => {
    const pawn = createPiece('pp', 'pawn', 'player', { file: 4, rank: 1 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 5, rank: 2 })
    const scored = scoreAllMoves(pawn, {
      allPieces: [pawn, enemy],
      decreeStepEnabled: false,
      personality: 'defensive',
      movingPiece: pawn,
    })
    const capture = scored.find((s) => s.move.isCapture)
    expect(capture?.score).toBeGreaterThan(AI_WEIGHTS.capture)
  })

  it('passes headless sanity check', () => {
    expect(runAiHeuristicSanityCheck().passed).toBe(true)
  })

  it('identifies decree-safe pawn approach square (same file, one rank closer)', () => {
    const pawn = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 6 })
    expect(isPawnApproachSquare({ file: 4, rank: 5 }, pawn, 'player')).toBe(true)
    expect(isPawnApproachSquare({ file: 5, rank: 5 }, pawn, 'player')).toBe(false)
  })

  it('solo decree king advances toward enemy instead of pacing sideways', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 2 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 6 })

    const ctx = {
      allPieces: [king, enemy],
      decreeStepEnabled: true,
      royalDecreeActive: true,
      personality: 'defensive' as const,
      movingPiece: king,
    }

    expect(isSoloDecreeKing(ctx)).toBe(true)

    const best = selectBestMove(king, ctx)
    expect(best).not.toBeNull()
    expect(best!.to.rank).toBeGreaterThan(king.position.rank)
    expect(best!.to.file).toBe(4)
  })

  it('solo decree king steps to pawn approach square when adjacent rank', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 4 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 6 })

    const best = selectBestMove(king, {
      allPieces: [king, enemy],
      decreeStepEnabled: true,
      royalDecreeActive: true,
      personality: 'defensive',
      movingPiece: king,
    })

    expect(best?.to).toEqual({ file: 4, rank: 5 })
  })

  it('solo decree king captures pawn when on approach square', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 5 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 6 })

    const best = selectBestMove(king, {
      allPieces: [king, enemy],
      decreeStepEnabled: true,
      royalDecreeActive: true,
      personality: 'defensive',
      movingPiece: king,
    })

    expect(best?.isCapture).toBe(true)
    expect(best?.to).toEqual({ file: 4, rank: 6 })
  })

  it('pawn approach square outscores lateral scared move under decree', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 4 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 6 })

    const ctx = {
      allPieces: [king, enemy],
      decreeStepEnabled: true,
      royalDecreeActive: true,
      personality: 'defensive' as const,
      movingPiece: king,
    }

    const approach = scoreMove(
      {
        from: king.position,
        to: { file: 4, rank: 5 },
        pieceId: king.id,
        kind: 'king',
        side: 'player',
        isCapture: false,
        isExtendedStep: false,
      },
      ctx,
    )

    const sideways = scoreMove(
      {
        from: king.position,
        to: { file: 3, rank: 4 },
        pieceId: king.id,
        kind: 'king',
        side: 'player',
        isCapture: false,
        isExtendedStep: false,
      },
      ctx,
    )

    expect(approach).toBeGreaterThan(sideways)
    expect(approach).toBeGreaterThanOrEqual(DECREE_SOLO_KING_WEIGHTS.pawnApproachSquare)
  })
})
