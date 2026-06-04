import { describe, expect, it } from 'vitest'
import { createPiece, createInitialGameState } from '@/types/game'
import {
  applyDeploySlotMilestones,
  buildPieceShopCatalog,
  calculatePieceRecruitCost,
  countBoardSlotsUsed,
  findDeploySquare,
  hasBoardSlotAvailable,
  resolveUnlockedSlotsFromMilestones,
  runPieceShopSanityCheck,
} from './pieceShop'

describe('pieceShop', () => {
  it('passes headless sanity check', () => {
    expect(runPieceShopSanityCheck().passed).toBe(true)
  })

  it('scales recruit cost by piece tier', () => {
    expect(calculatePieceRecruitCost('pawn')).toBe(100)
    expect(calculatePieceRecruitCost('knight')).toBe(400)
    expect(calculatePieceRecruitCost('rook')).toBe(900)
    expect(calculatePieceRecruitCost('queen')).toBe(1600)
  })

  it('unlocks pawn slot 2 at stage 6 and knight at 10', () => {
    expect(resolveUnlockedSlotsFromMilestones(5).pawn).toBe(1)
    expect(resolveUnlockedSlotsFromMilestones(6).pawn).toBe(2)
    expect(resolveUnlockedSlotsFromMilestones(10).knight).toBe(true)
  })

  it('applies stage 40 deploy slot milestone', () => {
    expect(applyDeploySlotMilestones(40, 2)).toBe(6)
    expect(applyDeploySlotMilestones(10, 5)).toBe(5)
  })

  it('finds pawn deploy square on rank 1', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const sq = findDeploySquare([king], [], 'pawn')
    expect(sq).toEqual({ file: 0, rank: 1 })
  })

  it('catalog marks knight locked before stage 10', () => {
    const state = createInitialGameState(0)
    const offers = buildPieceShopCatalog({
      gold: 10_000,
      maxStageReached: 5,
      currentStage: 5,
      wavePhase: 'WAVE_PREP',
      playerPieces: state.playerPieces,
      enemyPieces: [],
      unlockedSlots: resolveUnlockedSlotsFromMilestones(5),
      deploySlots: 2,
    })
    const knight = offers.find((o) => o.kind === 'knight')
    expect(knight?.purchasable).toBe(false)
    expect(knight?.lockedReason).toContain('Stage 10')
  })

  it('enforces board slot cap', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('p', 'pawn', 'player', { file: 3, rank: 1 })
    expect(countBoardSlotsUsed([king, pawn])).toBe(2)
    expect(hasBoardSlotAvailable([king, pawn], 2)).toBe(false)
  })
})
