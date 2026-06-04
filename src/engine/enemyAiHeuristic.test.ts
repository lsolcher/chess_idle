import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import { getEnemyMoveHeuristic, scoreAllEnemyMoves } from './enemyAiHeuristic'

describe('enemy AI heuristic', () => {
  it('prioritizes capturing the player king over advancing', () => {
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 2 })
    const king = createPiece('pk', 'king', 'player', { file: 5, rank: 1 })

    const best = getEnemyMoveHeuristic(enemy, {
      allPieces: [enemy, king],
      decreeStepEnabled: false,
      movingPiece: enemy,
    })

    expect(best?.isCapture).toBe(true)
    expect(best?.to).toEqual({ file: 5, rank: 1 })
  })

  it('marches toward player back rank when no capture', () => {
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 6 })
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })

    const best = getEnemyMoveHeuristic(enemy, {
      allPieces: [enemy, king],
      decreeStepEnabled: false,
      movingPiece: enemy,
    })

    expect(best).not.toBeNull()
    expect(best!.to.rank).toBeLessThan(enemy.position.rank)
  })

  it('knight selects capture when player piece is in range', () => {
    const knight = createPiece('nk', 'knight', 'enemy', { file: 4, rank: 4 })
    const pawn = createPiece('pp', 'pawn', 'player', { file: 6, rank: 5 })

    const best = getEnemyMoveHeuristic(knight, {
      allPieces: [knight, pawn],
      decreeStepEnabled: false,
      movingPiece: knight,
    })

    expect(best?.isCapture).toBe(true)
    expect(best?.to).toEqual({ file: 6, rank: 5 })
  })

  it('capture moves outscore idle forward march', () => {
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 3, rank: 2 })
    const pawn = createPiece('pp', 'pawn', 'player', { file: 4, rank: 1 })
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })

    const scored = scoreAllEnemyMoves(enemy, {
      allPieces: [enemy, pawn, king],
      decreeStepEnabled: false,
      movingPiece: enemy,
    })

    const capture = scored.find((s) => s.move.isCapture)
    const advance = scored.find((s) => !s.move.isCapture && s.move.to.rank < enemy.position.rank)
    expect(capture!.score).toBeGreaterThan(advance!.score)
  })
})
