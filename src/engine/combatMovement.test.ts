import { describe, expect, it } from 'vitest'
import { resolveCombatMove } from '@/engine/combat'
import {
  getLineSlamLandingSquare,
  resolveAttackLanding,
  resolveSafeAttackLanding,
} from '@/engine/combatMovement'
import type { BoardMove } from '@/engine/moves'
import { createPiece } from '@/types/game'

describe('combatMovement', () => {
  it('computes line slam landing one square before the target', () => {
    expect(getLineSlamLandingSquare({ file: 0, rank: 0 }, { file: 0, rank: 5 })).toEqual({
      file: 0,
      rank: 4,
    })
    expect(getLineSlamLandingSquare({ file: 7, rank: 7 }, { file: 3, rank: 3 })).toEqual({
      file: 4,
      rank: 4,
    })
  })

  it('rook at range chips then stands adjacent', () => {
    const rook = createPiece('r', 'rook', 'player', { file: 0, rank: 0 })
    const enemy = createPiece('e', 'pawn', 'enemy', { file: 0, rank: 5 })
    enemy.stats.hp = 100
    enemy.stats.def = 0

    const move: BoardMove = {
      pieceId: rook.id,
      side: 'player',
      from: rook.position,
      to: enemy.position,
      kind: 'rook',
      isCapture: true,
      capturedPieceId: enemy.id,
      isExtendedStep: false,
    }

    const result = resolveCombatMove(move, [rook], [enemy], {
      stage: 1,
      activeMult: 1,
      royalDecreeActive: false,
    })

    expect(result.damageDealt).toBeGreaterThan(0)
    expect(result.captured).toBe(false)
    const afterRook = result.playerPieces.find((p) => p.id === rook.id)!
    const afterEnemy = result.enemyPieces.find((p) => p.id === enemy.id)!
    expect(afterRook.position).toEqual({ file: 0, rank: 4 })
    expect(afterEnemy.position).toEqual({ file: 0, rank: 5 })
    expect(afterEnemy.stats.hp).toBeLessThan(100)
  })

  it('rook at range kills then occupies square beside the target', () => {
    const rook = createPiece('r', 'rook', 'player', { file: 0, rank: 0 })
    const enemy = createPiece('e', 'pawn', 'enemy', { file: 0, rank: 5 })
    enemy.stats.hp = 1
    enemy.stats.def = 0

    const move: BoardMove = {
      pieceId: rook.id,
      side: 'player',
      from: rook.position,
      to: enemy.position,
      kind: 'rook',
      isCapture: true,
      capturedPieceId: enemy.id,
      isExtendedStep: false,
    }

    const result = resolveCombatMove(move, [rook], [enemy], {
      stage: 1,
      activeMult: 1,
      royalDecreeActive: false,
    })

    expect(result.captured).toBe(true)
    expect(result.enemyPieces.find((p) => p.id === enemy.id)).toBeUndefined()
    expect(result.playerPieces.find((p) => p.id === rook.id)?.position).toEqual({
      file: 0,
      rank: 4,
    })
  })

  it('queen diagonal line attack advances beside target', () => {
    const queen = createPiece('q', 'queen', 'player', { file: 0, rank: 0 })
    const enemy = createPiece('e', 'pawn', 'enemy', { file: 4, rank: 4 })
    enemy.stats.hp = 50

    const move: BoardMove = {
      pieceId: queen.id,
      side: 'player',
      from: queen.position,
      to: enemy.position,
      kind: 'queen',
      isCapture: true,
      capturedPieceId: enemy.id,
      isExtendedStep: false,
    }

    const landing = resolveAttackLanding(move, queen, enemy, false)
    expect(landing).toEqual({ file: 3, rank: 3 })
  })

  it('knight lethal capture moves onto the target square', () => {
    const knight = createPiece('n', 'knight', 'player', { file: 2, rank: 2 })
    const enemy = createPiece('e', 'pawn', 'enemy', { file: 4, rank: 3 })
    enemy.stats.hp = 1
    enemy.stats.def = 0

    const move: BoardMove = {
      pieceId: knight.id,
      side: 'player',
      from: knight.position,
      to: enemy.position,
      kind: 'knight',
      isCapture: true,
      capturedPieceId: enemy.id,
      isExtendedStep: false,
    }

    const result = resolveCombatMove(move, [knight], [enemy], {
      stage: 1,
      activeMult: 1,
      royalDecreeActive: false,
    })

    expect(result.captured).toBe(true)
    expect(result.playerPieces.find((p) => p.id === knight.id)?.position).toEqual(enemy.position)
  })

  it('knight chip stays on origin square', () => {
    const knight = createPiece('n', 'knight', 'player', { file: 2, rank: 2 })
    const enemy = createPiece('e', 'pawn', 'enemy', { file: 4, rank: 3 })
    enemy.stats.hp = 100

    const move: BoardMove = {
      pieceId: knight.id,
      side: 'player',
      from: knight.position,
      to: enemy.position,
      kind: 'knight',
      isCapture: true,
      capturedPieceId: enemy.id,
      isExtendedStep: false,
    }

    const result = resolveCombatMove(move, [knight], [enemy], {
      stage: 1,
      activeMult: 1,
      royalDecreeActive: false,
    })

    expect(result.playerPieces.find((p) => p.id === knight.id)?.position).toEqual(knight.position)
  })

  it('line slam stays at origin when the landing square is occupied', () => {
    const rook = createPiece('r', 'rook', 'player', { file: 0, rank: 0 })
    const blocker = createPiece('b', 'pawn', 'player', { file: 0, rank: 4 })
    const enemy = createPiece('e', 'pawn', 'enemy', { file: 0, rank: 5 })
    enemy.stats.hp = 100

    const move: BoardMove = {
      pieceId: rook.id,
      side: 'player',
      from: rook.position,
      to: enemy.position,
      kind: 'rook',
      isCapture: true,
      capturedPieceId: enemy.id,
      isExtendedStep: false,
    }

    const landing = resolveSafeAttackLanding(
      move,
      rook,
      enemy,
      false,
      [rook, blocker],
      [enemy],
      false,
    )
    expect(landing).toEqual(rook.position)
  })

  it('does not teleport attacker when capture target is missing', () => {
    const rook = createPiece('r', 'rook', 'player', { file: 0, rank: 0 })
    const enemy = createPiece('e', 'pawn', 'enemy', { file: 0, rank: 5 })

    const move: BoardMove = {
      pieceId: rook.id,
      side: 'player',
      from: rook.position,
      to: enemy.position,
      kind: 'rook',
      isCapture: true,
      capturedPieceId: 'stale-id',
      isExtendedStep: false,
    }

    const result = resolveCombatMove(move, [rook], [enemy], {
      stage: 1,
      activeMult: 1,
      royalDecreeActive: false,
    })

    expect(result.damageDealt).toBe(0)
    expect(result.playerPieces.find((p) => p.id === rook.id)?.position).toEqual(rook.position)
    expect(result.enemyPieces).toHaveLength(1)
  })

  it('adjacent rook lethal capture takes the enemy square', () => {
    const rook = createPiece('r', 'rook', 'player', { file: 0, rank: 4 })
    const enemy = createPiece('e', 'pawn', 'enemy', { file: 0, rank: 5 })
    enemy.stats.hp = 1

    const landing = resolveAttackLanding(
      {
        pieceId: rook.id,
        side: 'player',
        from: rook.position,
        to: enemy.position,
        kind: 'rook',
        isCapture: true,
        capturedPieceId: enemy.id,
        isExtendedStep: false,
      },
      rook,
      enemy,
      true,
    )
    expect(landing).toEqual(enemy.position)
  })
})
