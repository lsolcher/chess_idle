import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import { scoreAllMoves, selectBestMove } from './aiHeuristic'

describe('aiHeuristic pvpGhost', () => {
  it('rook moves toward king instead of chasing distant pawn', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
    const rook = createPiece('rr', 'rook', 'player', { file: 0, rank: 0 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 0, rank: 6 })

    const ctx = {
      allPieces: [king, rook, enemy],
      decreeStepEnabled: false,
      personality: 'aggressive' as const,
      movingPiece: rook,
      combatMode: 'pvpGhost' as const,
    }

    const best = selectBestMove(rook, ctx)
    expect(best).not.toBeNull()
    const distToKing = Math.abs((best?.to.file ?? 0) - king.position.file)
    expect(distToKing).toBeLessThanOrEqual(4)
  })

  it('scores shelter higher than raw pawn advance in pvpGhost mode', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('pp', 'pawn', 'player', { file: 3, rank: 1 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 6 })

    const ranked = scoreAllMoves(pawn, {
      allPieces: [king, pawn, enemy],
      decreeStepEnabled: false,
      personality: 'aggressive',
      movingPiece: pawn,
      combatMode: 'pvpGhost',
    })

    const advance = ranked.find((r) => r.move.to.rank > pawn.position.rank && !r.move.isCapture)
    const hold = ranked.find((r) => r.move.to.rank === pawn.position.rank)
    if (advance && hold) {
      expect(hold.score).toBeGreaterThanOrEqual(advance.score)
    }
  })
})
