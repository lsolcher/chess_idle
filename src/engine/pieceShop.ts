/**
 * Piece Shop & army deployment (GDD §2.3, §3.1 milestones, Phase 3.9).
 * Unlocks gate purchases; buying deploys onto player ranks 0–1 (chess ranks 1–2).
 */
import { buildOccupancy, coordKey, getAllPieces, type BoardCoord } from './board'
import {
  DEPLOY_SLOT_MILESTONES,
  ROSTER_BISHOP_SLOTS,
  ROSTER_KNIGHT_SLOTS,
  ROSTER_PAWN_SLOTS,
  ROSTER_QUEEN_SLOT,
  ROSTER_ROOK_SLOTS,
} from '@/engine/balanceConstants'
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
 * Milestone unlock table (GDD §3.1 / §4.2) — chess-style roster caps.
 * Pawns scale 1→2→3→4; minors unlock at boss stages; pairs arrive in endgame bands.
 */
export function resolveUnlockedSlotsFromMilestones(maxStageReached: number): UnlockedSlotsState {
  const stage = Math.max(0, maxStageReached)
  let pawn = 1
  if (stage >= ROSTER_PAWN_SLOTS.fourth) pawn = 4
  else if (stage >= ROSTER_PAWN_SLOTS.third) pawn = 3
  else if (stage >= ROSTER_PAWN_SLOTS.second) pawn = 2

  let knight = 0
  if (stage >= ROSTER_KNIGHT_SLOTS.second) knight = 2
  else if (stage >= ROSTER_KNIGHT_SLOTS.first) knight = 1

  let bishop = 0
  if (stage >= ROSTER_BISHOP_SLOTS.second) bishop = 2
  else if (stage >= ROSTER_BISHOP_SLOTS.first) bishop = 1

  let rook = 0
  if (stage >= ROSTER_ROOK_SLOTS.second) rook = 2
  else if (stage >= ROSTER_ROOK_SLOTS.first) rook = 1

  const queen = stage >= ROSTER_QUEEN_SLOT ? 1 : 0

  return { pawn, knight, bishop, rook, queen }
}

/** King + sum of milestone roster caps, capped at global deploy maximum. */
export function computeMaxDeploySlotsFromRoster(unlockedSlots: UnlockedSlotsState): number {
  const rosterPieces =
    unlockedSlots.pawn +
    unlockedSlots.knight +
    unlockedSlots.bishop +
    unlockedSlots.rook +
    unlockedSlots.queen
  return Math.min(MAX_DEPLOY_SLOTS, 1 + rosterPieces)
}

export function getRosterCapForKind(
  kind: PieceKind,
  unlockedSlots: UnlockedSlotsState,
): number {
  if (kind === 'king') return 1
  if (kind === 'pawn') return unlockedSlots.pawn
  if (kind === 'knight') return unlockedSlots.knight
  if (kind === 'bishop') return unlockedSlots.bishop
  if (kind === 'rook') return unlockedSlots.rook
  if (kind === 'queen') return unlockedSlots.queen
  return 0
}

/** Wave milestones raise free deploy slots (within roster cap). */
export function applyDeploySlotMilestones(
  maxStageReached: number,
  deploySlots: number,
  unlockedSlots?: UnlockedSlotsState,
): number {
  const unlocked = unlockedSlots ?? resolveUnlockedSlotsFromMilestones(maxStageReached)
  const rosterCap = computeMaxDeploySlotsFromRoster(unlocked)
  let slots = deploySlots
  for (const milestone of DEPLOY_SLOT_MILESTONES) {
    if (maxStageReached >= milestone.stage) {
      slots = Math.max(slots, Math.min(milestone.slots, rosterCap))
    }
  }
  return Math.min(slots, rosterCap, MAX_DEPLOY_SLOTS)
}

export function clampDeploySlotsToRoster(
  deploySlots: number,
  unlockedSlots: UnlockedSlotsState,
): number {
  return Math.min(Math.max(1, deploySlots), computeMaxDeploySlotsFromRoster(unlockedSlots))
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

  return getRosterCapForKind(kind, unlockedSlots) > 0
}

/** True when roster cap for this piece type is not yet filled. */
export function hasRosterSlotForKind(
  kind: PieceKind,
  playerPieces: ChessPiece[],
  unlockedSlots: UnlockedSlotsState,
): boolean {
  const cap = getRosterCapForKind(kind, unlockedSlots)
  return cap > 0 && countPiecesOfKind(playerPieces, kind) < cap
}

/** True when the army has empty deploy capacity but can still recruit a pawn. */
export function shouldPrioritizePawnRecruit(
  playerPieces: ChessPiece[],
  unlockedSlots: UnlockedSlotsState,
  deploySlots: number,
): boolean {
  if (!hasBoardSlotAvailable(playerPieces, deploySlots)) return false
  return hasRosterSlotForKind('pawn', playerPieces, unlockedSlots)
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
    const cap = getRosterCapForKind(kind, input.unlockedSlots)
    const owned = countPiecesOfKind(input.playerPieces, kind)
    lockedReason =
      kind === 'pawn'
        ? `Pawn roster full (${owned}/${cap})`
        : `${kind} roster full (${owned}/${cap})`
  } else if (!boardRoom) {
    lockedReason = 'Board full — buy a slot'
  } else if (!inPrep) {
    lockedReason = 'Prep phase only'
  } else if (!deploySquare) {
    lockedReason = 'No deploy square free'
  }

  const purchasable = unlocked && rosterRoom && boardRoom && inPrep && deploySquare !== null
  const pawnOwned = kind === 'pawn' ? countPiecesOfKind(input.playerPieces, 'pawn') : 0
  const pawnCap = kind === 'pawn' ? getRosterCapForKind('pawn', input.unlockedSlots) : 0
  const pawnHint =
    kind === 'pawn' && pawnCap > 0
      ? ` · pawns ${pawnOwned}/${pawnCap} (chess-style)`
      : ''

  return {
    id: `shop:piece:${kind}`,
    kind,
    label: `Recruit ${kind}`,
    cost,
    affordable,
    purchasable: purchasable && affordable,
    roiScore: calculateRecruitRoi(kind, cost, input.globalSpeedMult ?? 1),
    lockedReason,
    preview: `Tier ${def.tier} · ${def.baseAp} AP · deploys rank ${kind === 'pawn' ? 2 : '1–2'}${pawnHint}`,
  }
}

function buildBoardSlotOffer(
  input: PieceShopCatalogInput,
  pieceOffers: PieceShopOffer[],
): PieceShopOffer | null {
  const rosterCap = computeMaxDeploySlotsFromRoster(input.unlockedSlots)
  if (input.deploySlots >= rosterCap || input.deploySlots >= MAX_DEPLOY_SLOTS) return null

  const nextSlot = input.deploySlots + 1
  const purchaseIndex = nextSlot - BASE_DEPLOY_SLOTS
  if (purchaseIndex < 1) return null

  const cost = Math.round(
    calculateUpgradeCost(BOARD_SLOT_UPGRADE_BASE, BOARD_SLOT_UPGRADE_GROWTH, purchaseIndex),
  )
  const affordable = input.gold >= cost
  const speed = input.globalSpeedMult ?? 1
  const inPrep = input.wavePhase === 'WAVE_PREP'
  const prioritizePawns = shouldPrioritizePawnRecruit(
    input.playerPieces,
    input.unlockedSlots,
    input.deploySlots,
  )

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

  let lockedReason: string | undefined
  if (!inPrep) {
    lockedReason = 'Prep phase only'
  } else if (prioritizePawns) {
    const pawnOwned = countPiecesOfKind(input.playerPieces, 'pawn')
    const pawnCap = input.unlockedSlots.pawn
    lockedReason = `Recruit pawns first (${pawnOwned}/${pawnCap})`
  }

  const purchasable = affordable && inPrep && !prioritizePawns

  return {
    id: 'shop:boardSlot',
    kind: 'boardSlot',
    label: 'Board Slot',
    cost,
    affordable,
    purchasable,
    roiScore,
    lockedReason,
    preview: `Army size ${input.deploySlots} → ${nextSlot} (roster cap ${rosterCap})`,
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

  return offers.sort((a, b) => {
    if (a.kind === 'pawn' && b.kind !== 'pawn') return -1
    if (b.kind === 'pawn' && a.kind !== 'pawn') return 1
    if (a.kind === 'boardSlot' && b.kind !== 'boardSlot') return 1
    if (b.kind === 'boardSlot' && a.kind !== 'boardSlot') return -1
    return 0
  })
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
  assert('stage 4 grants 2 pawn slots', resolveUnlockedSlotsFromMilestones(4).pawn === 2)
  assert('stage 17 grants 3 pawn slots', resolveUnlockedSlotsFromMilestones(17).pawn === 3)
  assert('stage 8 unlocks knight', resolveUnlockedSlotsFromMilestones(8).knight === 1)
  assert(
    'roster cap clamps deploy at stage 3',
    computeMaxDeploySlotsFromRoster(resolveUnlockedSlotsFromMilestones(3)) === 2,
  )
  assert(
    'stage 4 milestone grants 3 deploy slots',
    applyDeploySlotMilestones(4, 2, resolveUnlockedSlotsFromMilestones(4)) === 3,
  )

  const king = createPiece('k', 'king', 'player', { file: 4, rank: 0 })
  const square = findDeploySquare([king], [], 'pawn')
  assert('finds deploy square for pawn', square?.rank === 1)

  return { passed, messages }
}
