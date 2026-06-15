import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  scoreAllMoves,
  selectBestMove,
  shouldApplyStalemateBreak,
} from './aiHeuristic'

describe('auto AI strategies & stalemate guard', () => {
  it('aggressive prefers capture over passive advance', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('pp', 'pawn', 'player', { file: 3, rank: 1 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 2 })

    const best = selectBestMove(pawn, {
      allPieces: [king, pawn, enemy],
      decreeStepEnabled: false,
      personality: 'aggressive',
      movingPiece: pawn,
    })

    expect(best?.isCapture).toBe(true)
  })

  it('protectKing keeps king closer to friendly pieces than aggressive', () => {
    const king = createPiece('pk', 'king', 'player', { file: 0, rank: 0 })
    const pawn = createPiece('pp', 'pawn', 'player', { file: 4, rank: 1 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 7, rank: 6 })

    const protect = selectBestMove(king, {
      allPieces: [king, pawn, enemy],
      decreeStepEnabled: false,
      personality: 'protectKing',
      movingPiece: king,
    })
    const aggressive = selectBestMove(king, {
      allPieces: [king, pawn, enemy],
      decreeStepEnabled: false,
      personality: 'aggressive',
      movingPiece: king,
    })

    expect(protect).not.toBeNull()
    expect(aggressive).not.toBeNull()
    const protectDist = Math.abs((protect?.to.file ?? 0) - pawn.position.file)
    const aggDist = Math.abs((aggressive?.to.file ?? 0) - pawn.position.file)
    expect(protectDist).toBeLessThanOrEqual(aggDist)
  })

  it('pressures a lone knight with pawns and king', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
    const pawnA = createPiece('pa', 'pawn', 'player', { file: 3, rank: 1 })
    const pawnB = createPiece('pb', 'pawn', 'player', { file: 5, rank: 1 })
    const knight = createPiece('nk', 'knight', 'enemy', { file: 4, rank: 4 })

    const allPieces = [king, pawnA, pawnB, knight]
    const pawnMove = selectBestMove(pawnA, {
      allPieces,
      decreeStepEnabled: false,
      personality: 'aggressive',
      movingPiece: pawnA,
    })
    expect(pawnMove?.to.rank).toBeGreaterThan(pawnA.position.rank)

    const kingMove = selectBestMove(king, {
      allPieces,
      decreeStepEnabled: false,
      personality: 'aggressive',
      movingPiece: king,
    })
    expect(kingMove).not.toBeNull()
    const kingDist = Math.abs(kingMove!.to.file - knight.position.file) +
      Math.abs(kingMove!.to.rank - knight.position.rank)
    const startDist = Math.abs(king.position.file - knight.position.file) +
      Math.abs(king.position.rank - knight.position.rank)
    expect(kingDist).toBeLessThanOrEqual(startDist)
  })

  it('breaks pawn stare-down by head-on capture or king flank', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('pp', 'pawn', 'player', { file: 4, rank: 3 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 4 })

    const pawnMove = selectBestMove(pawn, {
      allPieces: [king, pawn, enemy],
      decreeStepEnabled: false,
      personality: 'defensive',
      movingPiece: pawn,
    })
    expect(pawnMove?.isCapture).toBe(true)
    expect(pawnMove?.to.rank).toBe(4)

    const kingMove = selectBestMove(king, {
      allPieces: [king, pawn, enemy],
      decreeStepEnabled: false,
      personality: 'protectKing',
      movingPiece: king,
    })
    expect(kingMove).not.toBeNull()
    const kingDist =
      Math.abs(kingMove!.to.file - enemy.position.file) +
      Math.abs(kingMove!.to.rank - enemy.position.rank)
    const startDist =
      Math.abs(king.position.file - enemy.position.file) +
      Math.abs(king.position.rank - enemy.position.rank)
    expect(kingDist).toBeLessThanOrEqual(startDist)
  })

  it('breaks distant pawn stare-down by advancing or engaging king', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('pp', 'pawn', 'player', { file: 4, rank: 1 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 5 })

    const ranked = scoreAllMoves(pawn, {
      allPieces: [king, pawn, enemy],
      decreeStepEnabled: false,
      personality: 'defensive',
      movingPiece: pawn,
    })
    expect(shouldApplyStalemateBreak(ranked)).toBe(true)

    const pawnMove = selectBestMove(pawn, {
      allPieces: [king, pawn, enemy],
      decreeStepEnabled: false,
      personality: 'defensive',
      movingPiece: pawn,
    })
    expect(pawnMove?.to.rank).toBeGreaterThan(pawn.position.rank)

    const kingMove = selectBestMove(king, {
      allPieces: [king, pawn, enemy],
      decreeStepEnabled: false,
      personality: 'aggressive',
      movingPiece: king,
    })
    expect(kingMove).not.toBeNull()
    expect(kingMove?.to.rank).toBeGreaterThanOrEqual(king.position.rank)
    expect(
      kingMove!.to.rank > king.position.rank || kingMove!.to.file !== king.position.file,
    ).toBe(true)
  })
})
