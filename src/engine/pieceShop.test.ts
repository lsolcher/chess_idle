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

  it('unlocks pawn slot 2 at stage 4 and knight at 8', () => {
    expect(resolveUnlockedSlotsFromMilestones(3).pawn).toBe(1)
    expect(resolveUnlockedSlotsFromMilestones(4).pawn).toBe(2)
    expect(resolveUnlockedSlotsFromMilestones(17).pawn).toBe(3)
    expect(resolveUnlockedSlotsFromMilestones(23).pawn).toBe(4)
    expect(resolveUnlockedSlotsFromMilestones(8).knight).toBe(1)
  })

  it('applies deploy slot milestones within roster cap', () => {
    const unlocked38 = resolveUnlockedSlotsFromMilestones(38)
    expect(applyDeploySlotMilestones(38, 2, unlocked38)).toBe(6)
    const unlocked8 = resolveUnlockedSlotsFromMilestones(8)
    expect(applyDeploySlotMilestones(8, 2, unlocked8)).toBe(4)
  })

  it('hides board slot offer at roster deploy cap', () => {
    const state = createInitialGameState(0)
    const unlocked = resolveUnlockedSlotsFromMilestones(5)
    const offers = buildPieceShopCatalog({
      gold: 10_000,
      maxStageReached: 5,
      currentStage: 5,
      wavePhase: 'WAVE_PREP',
      playerPieces: state.playerPieces,
      enemyPieces: [],
      unlockedSlots: unlocked,
      deploySlots: 3,
    })
    expect(offers.find((o) => o.kind === 'boardSlot')).toBeUndefined()
  })

  it('prompts pawn recruits before extra board slots', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const unlocked = resolveUnlockedSlotsFromMilestones(4)
    const offers = buildPieceShopCatalog({
      gold: 10_000,
      maxStageReached: 4,
      currentStage: 4,
      wavePhase: 'WAVE_PREP',
      playerPieces: [king],
      enemyPieces: [],
      unlockedSlots: unlocked,
      deploySlots: 2,
    })
    const slot = offers.find((o) => o.kind === 'boardSlot')
    expect(slot?.purchasable).toBe(false)
    expect(slot?.lockedReason).toContain('Recruit pawns first')
  })

  it('finds pawn deploy square on rank 1', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const sq = findDeploySquare([king], [], 'pawn')
    expect(sq).toEqual({ file: 0, rank: 1 })
  })

  it('catalog marks knight locked before stage 8', () => {
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
    expect(knight?.lockedReason).toContain('Stage 8')
  })

  it('enforces board slot cap', () => {
    const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('p', 'pawn', 'player', { file: 3, rank: 1 })
    expect(countBoardSlotsUsed([king, pawn])).toBe(2)
    expect(hasBoardSlotAvailable([king, pawn], 2)).toBe(false)
  })
})
