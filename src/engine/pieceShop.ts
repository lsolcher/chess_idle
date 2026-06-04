/**
 * Piece Shop & army deployment (GDD §2.3, §3.1 milestones, Phase 3.9).
 * Unlocks gate purchases; buying deploys onto player ranks 0–1 (chess ranks 1–2).
 */
import { buildOccupancy, coordKey, getAllPieces, type BoardCoord } from './board'
import { calculateRecruitRoi } from '@/engine/upgrades'
import {
  calculateUpgradeCost,
  countPlayerPieces,
  createPiece,
  PIECE_DEFINITIONS,
  type ChessPiece,
  type PieceKind,
  type UnlockedSlotsState,
} from '@/types/game'

/** Player starting ranks for deployment (0-indexed: rank 0 = back rank). */
export const PLAYER_DEPLOY_RANKS = [0, 1] as const

export const MAX_DEPLOY_SLOTS = 8
export const BASE_DEPLOY_SLOTS = 2
export const BOARD_SLOT_UPGRADE_BASE = 500
export const BOARD_SLOT_UPGRADE_GROWTH = 1.25

/** Gold cost to recruit a piece: `100 × tier²` (GDD §2.3 piece tier scaling). */
export function calculatePieceRecruitCost(kind: PieceKind, pawnIndex = 0): number {
  const def = PIECE_DEFINITIONS[kind]
  if (kind === 'king') return 0
  const tier = Math.max(1, def.tier)
  const base = 100 * tier ** 2
  if (kind === 'pawn' && pawnIndex > 0) {
    return Math.round(calculateUpgradeCost(base, 1.15, pawnIndex + 1))
  }
  return base
}

/**
 * Milestone unlock table (GDD §3.1 / §4.2).
 * Pawn slot count rises at stage 6; piece types unlock at 10/15/30/45.
 */
export function resolveUnlockedSlotsFromMilestones(maxStageReached: number): UnlockedSlotsState {
  return {
    pawn: maxStageReached >= 6 ? 2 : 1,
    knight: maxStageReached >= 10,
    bishop: maxStageReached >= 15,
    rook: maxStageReached >= 30,
    queen: maxStageReached >= 45,
  }
}

/** Stage 40 milestone grants at least 6 deploy slots (GDD §4.2). */
export function applyDeploySlotMilestones(maxStageReached: number, deploySlots: number): number {
  let slots = deploySlots
  if (maxStageReached >= 40) {
    slots = Math.max(slots, 6)
  }
  return Math.min(slots, MAX_DEPLOY_SLOTS)
}

export function countPiecesOfKind(pieces: ChessPiece[], kind: PieceKind): number {
  return pieces.filter((piece) => piece.side === 'player' && piece.kind === kind).length
}

/** Total friendly pieces on board (King included) vs deploy slot cap. */
export function countBoardSlotsUsed(playerPieces: ChessPiece[]): number {
  return countPlayerPieces(playerPieces)
}

export function hasBoardSlotAvailable(playerPieces: ChessPiece[], deploySlots: number): boolean {
  return countBoardSlotsUsed(playerPieces) < deploySlots
}

export function isPieceTypeUnlocked(
  kind: PieceKind,
  unlockedSlots: UnlockedSlotsState,
  maxStageReached: number,
): boolean {
  if (kind === 'king') return false
  const def = PIECE_DEFINITIONS[kind]
  if (maxStageReached < def.unlockStage) return false

  if (kind === 'pawn') return unlockedSlots.pawn > 0
  if (kind === 'knight') return unlockedSlots.knight
  if (kind === 'bishop') return unlockedSlots.bishop
  if (kind === 'rook') return unlockedSlots.rook
  if (kind === 'queen') return unlockedSlots.queen
  return false
}

/** True when roster cap for this piece type is not yet filled. */
export function hasRosterSlotForKind(
  kind: PieceKind,
  playerPieces: ChessPiece[],
  unlockedSlots: UnlockedSlotsState,
): boolean {
  if (kind === 'pawn') {
    return countPiecesOfKind(playerPieces, 'pawn') < unlockedSlots.pawn
  }
  return countPiecesOfKind(playerPieces, kind) < 1
}

/**
 * Finds left-to-right empty square on player deploy ranks (prefers rank 1 for pawns).
 */
export function findDeploySquare(
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
  kind: PieceKind,
): BoardCoord | null {
  const occupancy = buildOccupancy(getAllPieces(playerPieces, enemyPieces))
  const ranks =
    kind === 'pawn'
      ? ([1, 0] as const)
      : ([...PLAYER_DEPLOY_RANKS] as readonly number[])

  for (const rank of ranks) {
    for (let file = 0; file < 8; file += 1) {
      const coord = { file, rank }
      if (!occupancy.has(coordKey(coord))) {
        return coord
      }
    }
  }
  return null
}

export interface PieceShopOffer {
  id: string
  kind: PieceKind | 'boardSlot'
  label: string
  cost: number
  affordable: boolean
  /** Milestone reached but other blocker (full board, roster cap, wrong phase). */
  purchasable: boolean
  /** Marginal combat DPS per gold — comparable to upgrade ROI. */
  roiScore: number
  lockedReason?: string
  preview: string
}

export interface PieceShopCatalogInput {
  gold: number
  maxStageReached: number
  currentStage: number
  wavePhase: string
  playerPieces: ChessPiece[]
  enemyPieces: ChessPiece[]
  unlockedSlots: UnlockedSlotsState
  deploySlots: number
  globalSpeedMult?: number
}

function buildPieceOffer(
  kind: PieceKind,
  input: PieceShopCatalogInput,
): PieceShopOffer | null {
  if (kind === 'king') return null

  const unlocked = isPieceTypeUnlocked(kind, input.unlockedSlots, input.maxStageReached)
  const def = PIECE_DEFINITIONS[kind]
  const pawnIndex = kind === 'pawn' ? countPiecesOfKind(input.playerPieces, 'pawn') : 0
  const cost = calculatePieceRecruitCost(kind, pawnIndex)
  const affordable = input.gold >= cost
  const rosterRoom = hasRosterSlotForKind(kind, input.playerPieces, input.unlockedSlots)
  const boardRoom = hasBoardSlotAvailable(input.playerPieces, input.deploySlots)
  const inPrep = input.wavePhase === 'WAVE_PREP'
  const deploySquare = findDeploySquare(input.playerPieces, input.enemyPieces, kind)

  let lockedReason: string | undefined
  if (!unlocked) {
    lockedReason = `Unlocks at Stage ${def.unlockStage}`
  } else if (!rosterRoom) {
    lockedReason = kind === 'pawn' ? 'Pawn slots full' : `${kind} already deployed`
  } else if (!boardRoom) {
    lockedReason = 'Board full — buy a slot'
  } else if (!inPrep) {
    lockedReason = 'Prep phase only'
  } else if (!deploySquare) {
    lockedReason = 'No deploy square free'
  }

  const purchasable = unlocked && rosterRoom && boardRoom && inPrep && deploySquare !== null

  return {
    id: `shop:piece:${kind}`,
    kind,
    label: `Recruit ${kind}`,
    cost,
    affordable,
    purchasable: purchasable && affordable,
    roiScore: calculateRecruitRoi(kind, cost, input.globalSpeedMult ?? 1),
    lockedReason,
    preview: `Tier ${def.tier} · ${def.baseAp} AP · deploys rank ${kind === 'pawn' ? 2 : '1–2'}`,
  }
}

function buildBoardSlotOffer(
  input: PieceShopCatalogInput,
  pieceOffers: PieceShopOffer[],
): PieceShopOffer | null {
  if (input.deploySlots >= MAX_DEPLOY_SLOTS) return null

  const nextSlot = input.deploySlots + 1
  const purchaseIndex = nextSlot - BASE_DEPLOY_SLOTS
  if (purchaseIndex < 1) return null

  const cost = Math.round(
    calculateUpgradeCost(BOARD_SLOT_UPGRADE_BASE, BOARD_SLOT_UPGRADE_GROWTH, purchaseIndex),
  )
  const affordable = input.gold >= cost
  const speed = input.globalSpeedMult ?? 1

  const blockedRecruit = pieceOffers
    .filter(
      (o) =>
        o.kind !== 'boardSlot' &&
        o.affordable &&
        !o.purchasable &&
        o.lockedReason === 'Board full — buy a slot',
    )
    .sort((a, b) => b.roiScore - a.roiScore)[0]

  const roiScore = blockedRecruit
    ? blockedRecruit.roiScore * 0.95
    : calculateRecruitRoi('pawn', cost, speed) * 0.5

  return {
    id: 'shop:boardSlot',
    kind: 'boardSlot',
    label: 'Board Slot',
    cost,
    affordable,
    purchasable: affordable && input.wavePhase === 'WAVE_PREP',
    roiScore,
    lockedReason: input.wavePhase !== 'WAVE_PREP' ? 'Prep phase only' : undefined,
    preview: `Army size ${input.deploySlots} → ${nextSlot} (max ${MAX_DEPLOY_SLOTS})`,
  }
}

/** Builds recruit + board-slot offers for the Piece Shop UI. */
export function buildPieceShopCatalog(input: PieceShopCatalogInput): PieceShopOffer[] {
  const offers: PieceShopOffer[] = []

  for (const kind of ['pawn', 'knight', 'bishop', 'rook', 'queen'] as const) {
    const offer = buildPieceOffer(kind, input)
    if (offer) offers.push(offer)
  }

  const slotOffer = buildBoardSlotOffer(input, offers)
  if (slotOffer) offers.push(slotOffer)

  return offers
}

export function createShopPieceId(kind: PieceKind, playerPieces: ChessPiece[]): string {
  const count = countPiecesOfKind(playerPieces, kind)
  return `player-${kind}-${count}`
}

/** Headless sanity check for shop math and deployment grid. */
export function runPieceShopSanityCheck(): { passed: boolean; messages: string[] } {
  const messages: string[] = []
  let passed = true
  const assert = (label: string, ok: boolean) => {
    messages.push(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
    if (!ok) passed = false
  }

  assert('pawn cost tier 1', calculatePieceRecruitCost('pawn') === 100)
  assert('knight cost tier 2', calculatePieceRecruitCost('knight') === 400)
  assert('stage 6 grants 2 pawn slots', resolveUnlockedSlotsFromMilestones(6).pawn === 2)
  assert('stage 10 unlocks knight', resolveUnlockedSlotsFromMilestones(10).knight === true)

  const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
  const square = findDeploySquare([king], [], 'pawn')
  assert('finds deploy square for pawn', square?.rank === 1)

  return { passed, messages }
}
