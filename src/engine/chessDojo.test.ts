import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import {
  applyDojoMove,
  enumerateMovesForSide,
  evaluateDojoPosition,
  getAiMove,
  scoreDojoMove,
  type Board,
} from '@/engine/chessDojo'

function captureTacticBoard(): Board {
  const playerQueen = createPiece('pq', 'queen', 'player', { file: 4, rank: 4 })
  const enemyRook = createPiece('er', 'rook', 'enemy', { file: 4, rank: 0 })
  const playerKing = createPiece('pk', 'king', 'player', { file: 7, rank: 7 })
  const enemyKing = createPiece('ek', 'king', 'enemy', { file: 0, rank: 7 })

  return {
    pieces: [playerQueen, enemyRook, playerKing, enemyKing],
    sideToMove: 'enemy',
    aiSide: 'enemy',
    decreeStepEnabled: false,
    royalDecreeActive: false,
    personality: 'aggressive',
  }
}

function movesEqual(a: ReturnType<typeof getAiMove>, b: ReturnType<typeof getAiMove>): boolean {
  if (!a || !b) return a === b
  return (
    a.pieceId === b.pieceId &&
    a.to.file === b.to.file &&
    a.to.rank === b.to.rank &&
    a.isCapture === b.isCapture
  )
}

describe('chessDojo', () => {
  it('applies captures by removing the defender in simulation', () => {
    const board = captureTacticBoard()
    const capture = enumerateMovesForSide(board, 'enemy').find((entry) => entry.move.isCapture)
    expect(capture).toBeDefined()

    const next = applyDojoMove(board, capture!.move)
    expect(next.pieces.some((p) => p.id === 'pq')).toBe(false)
    expect(next.sideToMove).toBe('player')
  })

  it('Hard picks the top heuristic capture on a tactical board', () => {
    const board = captureTacticBoard()
    const best = enumerateMovesForSide(board, 'enemy')[0]!.move
    const hard = getAiMove(board, 'hard')

    expect(hard?.isCapture).toBe(true)
    expect(movesEqual(hard, best)).toBe(true)
  })

  it('Easy only selects from the top three scored moves', () => {
    const board = captureTacticBoard()
    const topThree = enumerateMovesForSide(board, 'enemy')
      .slice(0, 3)
      .map((entry) => entry.move)

    for (let i = 0; i < 40; i += 1) {
      const easy = getAiMove(board, 'easy')
      expect(easy).not.toBeNull()
      const inPool = topThree.some((candidate) => movesEqual(easy, candidate))
      expect(inPool).toBe(true)
    }
  })

  it('Hard chooses a materially stronger line than typical Easy picks', () => {
    const board = captureTacticBoard()
    const hard = getAiMove(board, 'hard')!
    const hardScore = scoreDojoMove(board, hard)

    const easyScores: number[] = []
    for (let i = 0; i < 30; i += 1) {
      const easy = getAiMove(board, 'easy')!
      easyScores.push(scoreDojoMove(board, easy))
    }

    const easyAvg = easyScores.reduce((sum, value) => sum + value, 0) / easyScores.length
    const easyMax = Math.max(...easyScores)

    expect(hardScore).toBeGreaterThan(easyAvg)
    expect(hardScore).toBeGreaterThanOrEqual(easyMax)
  })

  it('lookahead improves evaluation after the opponent reply', () => {
    const board = captureTacticBoard()
    const capture = enumerateMovesForSide(board, 'enemy').find((m) => m.move.isCapture)!
    const afterCapture = applyDojoMove(board, capture.move)
    const evalAfter = evaluateDojoPosition(afterCapture, 'enemy')
    expect(evalAfter).toBeGreaterThan(evaluateDojoPosition(board, 'enemy'))
  })

  it('Medium matches the best single-ply heuristic move', () => {
    const board = captureTacticBoard()
    const best = enumerateMovesForSide(board, 'enemy')[0]!.move
    const medium = getAiMove(board, 'medium')
    expect(movesEqual(medium, best)).toBe(true)
  })
})
