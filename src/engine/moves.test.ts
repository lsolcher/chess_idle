import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import { generateLegalMoves, isSquareAttacked } from './moves'

describe('move generation', () => {
  it('generates standard king moves (8 directions)', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 4 })
    const moves = generateLegalMoves(king, {
      allPieces: [king],
      decreeStepEnabled: false,
    })
    expect(moves.length).toBe(8)
  })

  it('grants decree 2-step king moves when enabled', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const without = generateLegalMoves(king, { allPieces: [king], decreeStepEnabled: false })
    const withDecree = generateLegalMoves(king, { allPieces: [king], decreeStepEnabled: true })

    expect(withDecree.length).toBeGreaterThan(without.length)
    expect(withDecree.some((m) => m.isExtendedStep)).toBe(true)
  })

  it('generates pawn forward and capture moves', () => {
    const pawn = createPiece('p', 'pawn', 'player', { file: 4, rank: 1 })
    const enemy = createPiece('e', 'pawn', 'enemy', { file: 5, rank: 2 })
    const moves = generateLegalMoves(pawn, { allPieces: [pawn, enemy], decreeStepEnabled: false })

    expect(moves.some((m) => m.to.rank === 2 && !m.isCapture)).toBe(true)
    expect(moves.some((m) => m.isCapture)).toBe(true)
  })

  it('detects pawn diagonal attacks', () => {
    const enemy = createPiece('e', 'pawn', 'enemy', { file: 4, rank: 3 })
    const square = { file: 3, rank: 2 }
    expect(isSquareAttacked(square, [enemy], 'player')).toBe(true)
  })

  it('decree 2-step cannot slide through a blocking piece', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const blocker = createPiece('b', 'pawn', 'player', { file: 4, rank: 2 })
    const moves = generateLegalMoves(king, {
      allPieces: [king, blocker],
      decreeStepEnabled: true,
    })

    expect(moves.some((m) => m.to.file === 4 && m.to.rank === 2)).toBe(false)
    expect(moves.some((m) => m.to.file === 4 && m.to.rank === 1 && !m.isExtendedStep)).toBe(true)
  })

  it('generates knight L-shaped moves', () => {
    const knight = createPiece('n', 'knight', 'player', { file: 4, rank: 4 })
    const moves = generateLegalMoves(knight, { allPieces: [knight], decreeStepEnabled: false })
    expect(moves).toHaveLength(8)
    expect(moves.some((m) => m.to.file === 6 && m.to.rank === 5)).toBe(true)
  })

  it('generates rook orthogonal slides until blocked', () => {
    const rook = createPiece('r', 'rook', 'player', { file: 4, rank: 4 })
    const blocker = createPiece('b', 'pawn', 'player', { file: 4, rank: 6 })
    const moves = generateLegalMoves(rook, {
      allPieces: [rook, blocker],
      decreeStepEnabled: false,
    })
    expect(moves.some((m) => m.to.rank === 5 && !m.isCapture)).toBe(true)
    expect(moves.some((m) => m.to.rank === 6)).toBe(false)
  })

  it('generates bishop diagonal slides', () => {
    const bishop = createPiece('b', 'bishop', 'player', { file: 4, rank: 4 })
    const moves = generateLegalMoves(bishop, { allPieces: [bishop], decreeStepEnabled: false })
    expect(moves.some((m) => m.to.file === 7 && m.to.rank === 7)).toBe(true)
    expect(moves.every((m) => Math.abs(m.to.file - m.from.file) === Math.abs(m.to.rank - m.from.rank))).toBe(
      true,
    )
  })

  it('generates queen combined slides', () => {
    const queen = createPiece('q', 'queen', 'player', { file: 3, rank: 3 })
    const moves = generateLegalMoves(queen, { allPieces: [queen], decreeStepEnabled: false })
    expect(moves.some((m) => m.to.file === 3 && m.to.rank === 7)).toBe(true)
    expect(moves.some((m) => m.to.file === 7 && m.to.rank === 7)).toBe(true)
  })

  it('super-rook promoted pawn uses rook movement', () => {
    const pawn = createPiece('p', 'pawn', 'player', { file: 2, rank: 2 })
    pawn.superPromotion = {
      form: 'super-rook',
      sourcePawnId: pawn.id,
      apMult: 2.8,
      hpMult: 3,
      traits: { lineSlam: true },
    }
    const moves = generateLegalMoves(pawn, { allPieces: [pawn], decreeStepEnabled: false })
    expect(moves.some((m) => m.to.file === 2 && m.to.rank === 7)).toBe(true)
  })

  it('detects rook and knight attacks on king square', () => {
    const rook = createPiece('r', 'rook', 'enemy', { file: 0, rank: 4 })
    const square = { file: 0, rank: 0 }
    expect(isSquareAttacked(square, [rook], 'player')).toBe(true)

    const knight = createPiece('n', 'knight', 'enemy', { file: 2, rank: 2 })
    expect(isSquareAttacked({ file: 4, rank: 3 }, [knight], 'player')).toBe(true)
  })

  it('decree captures adjacent enemy on 1-step without 2-step teleport', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 2 })
    const enemy = createPiece('e', 'pawn', 'enemy', { file: 4, rank: 3 })
    const moves = generateLegalMoves(king, {
      allPieces: [king, enemy],
      decreeStepEnabled: true,
    })

    expect(moves.some((m) => m.to.rank === 3 && m.isCapture)).toBe(true)
    expect(moves.filter((m) => m.isExtendedStep && m.isCapture)).toHaveLength(0)
  })
})
