import { describe, expect, it } from 'vitest'

import { resolveCombatMove } from '@/engine/combat'
import { createPiece } from '@/types/game'
import type { BoardMove } from '@/engine/moves'

describe('combat invulnerability', () => {
  it('waives lethal capture when defender is invulnerable', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 1 })
    enemy.stats.ap = 999
    king.stats.hp = 5

    const move: BoardMove = {
      pieceId: enemy.id,
      kind: enemy.kind,
      side: 'enemy',
      from: enemy.position,
      to: king.position,
      isCapture: true,
      capturedPieceId: king.id,
      isExtendedStep: false,
    }

    const result = resolveCombatMove(move, [king], [enemy], {
      stage: 1,
      activeMult: 1,
      royalDecreeActive: false,
      defenderInvulnerable: true,
    })

    expect(result.captured).toBe(false)
    expect(result.playerPieces.find((p) => p.id === king.id)?.stats.hp).toBeGreaterThan(0)
  })

  it('repositions the attacker on an invulnerable chip', () => {
    const rook = createPiece('er', 'rook', 'enemy', { file: 0, rank: 5 })
    const king = createPiece('pk', 'king', 'player', { file: 0, rank: 0 })
    king.stats.hp = 5
    rook.stats.ap = 999

    const move: BoardMove = {
      pieceId: rook.id,
      kind: 'rook',
      side: 'enemy',
      from: rook.position,
      to: king.position,
      isCapture: true,
      capturedPieceId: king.id,
      isExtendedStep: false,
    }

    const result = resolveCombatMove(move, [king], [rook], {
      stage: 1,
      activeMult: 1,
      royalDecreeActive: false,
      defenderInvulnerable: true,
    })

    expect(result.captured).toBe(false)
    expect(result.enemyPieces.find((p) => p.id === rook.id)?.position).toEqual({
      file: 0,
      rank: 1,
    })
  })
})
