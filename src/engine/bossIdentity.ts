/**
 * Boss identity catalog and milestone wave composition (GDD §3.2).
 * Endless boss stages (60, 70, …) reuse scaled identities with phase shifts.
 */
import { isBossStage } from '@/engine/stageManager'
import type { PieceKind } from '@/types/game'

/** Signature boss identifiers — attached to `ChessPiece.bossId`. */
export type BossIdentityId =
  | 'enPassantPhantom'
  | 'bishopPair'
  | 'theCastle'
  | 'ironRook'
  | 'theRegent'
  | 'grandmaster'
  | 'endlessOverlord'

export interface BossDefinition {
  id: BossIdentityId
  label: string
  /** Trophy granted on first clear of this boss stage. */
  trophyName: string
  /** Milestone stage; endless bosses use stage % interval. */
  milestoneStage: number | null
}

export const BOSS_DEFINITIONS: Record<BossIdentityId, BossDefinition> = {
  enPassantPhantom: {
    id: 'enPassantPhantom',
    label: 'En Passant Phantom',
    trophyName: 'Phantom Trophy',
    milestoneStage: 10,
  },
  bishopPair: {
    id: 'bishopPair',
    label: 'Bishop Pair',
    trophyName: 'Linked Bishops Trophy',
    milestoneStage: 15,
  },
  theCastle: {
    id: 'theCastle',
    label: 'The Castle',
    trophyName: 'Castle Trophy',
    milestoneStage: 20,
  },
  ironRook: {
    id: 'ironRook',
    label: 'Iron Rook',
    trophyName: 'Iron Rook Trophy',
    milestoneStage: 30,
  },
  theRegent: {
    id: 'theRegent',
    label: 'The Regent',
    trophyName: 'Regent Trophy',
    milestoneStage: 45,
  },
  grandmaster: {
    id: 'grandmaster',
    label: 'The Grandmaster',
    trophyName: 'Grandmaster Trophy',
    milestoneStage: 50,
  },
  endlessOverlord: {
    id: 'endlessOverlord',
    label: 'Endless Overlord',
    trophyName: 'Overlord Trophy',
    milestoneStage: null,
  },
}

const MILESTONE_BOSS_BY_STAGE: Partial<Record<number, BossIdentityId>> = {
  10: 'enPassantPhantom',
  15: 'bishopPair',
  20: 'theCastle',
  30: 'ironRook',
  45: 'theRegent',
  50: 'grandmaster',
}

/**
 * Resolves which signature boss rules apply on a boss stage.
 */
export function resolveBossIdentity(stage: number): BossIdentityId | null {
  if (!isBossStage(stage)) return null
  return MILESTONE_BOSS_BY_STAGE[stage] ?? 'endlessOverlord'
}

export function getBossDefinition(id: BossIdentityId): BossDefinition {
  return BOSS_DEFINITIONS[id]
}

/**
 * Overrides procedural composition for milestone boss waves (GDD §3.1 table).
 */
export function generateBossWaveKinds(stage: number, waveSize: number): PieceKind[] | null {
  const identity = resolveBossIdentity(stage)
  if (!identity) return null

  switch (identity) {
    case 'enPassantPhantom': {
      const pawns = Math.min(4, Math.max(0, waveSize - 1))
      return ['knight', ...Array(pawns).fill('pawn') as PieceKind[]]
    }
    case 'bishopPair':
      return ['bishop', 'bishop', ...fillMinions('pawn', waveSize - 2)]
    case 'theCastle':
      return ['rook', ...fillMinions('pawn', waveSize - 1)]
    case 'ironRook':
      return ['rook', ...fillMinions('pawn', waveSize - 1)]
    case 'theRegent':
      return ['queen', 'rook', 'rook', ...fillMinions('pawn', waveSize - 3)]
    case 'grandmaster':
      return [
        'king',
        'rook',
        'rook',
        'bishop',
        'bishop',
        'knight',
        'knight',
        ...fillMinions('pawn', waveSize - 7),
      ]
    case 'endlessOverlord':
    default:
      return ['king', ...fillMinions('pawn', waveSize - 1)]
  }
}

function fillMinions(kind: PieceKind, count: number): PieceKind[] {
  return Array(Math.max(0, count)).fill(kind) as PieceKind[]
}

/** Which piece kinds receive `isBoss` + `bossId` on spawn. */
export function isBossPieceKind(identity: BossIdentityId, kind: PieceKind, index: number): boolean {
  switch (identity) {
    case 'enPassantPhantom':
      return kind === 'knight' && index === 0
    case 'bishopPair':
      return kind === 'bishop'
    case 'theCastle':
      return kind === 'rook' && index === 0
    case 'ironRook':
      return kind === 'rook' && index === 0
    case 'theRegent':
      return kind === 'queen' && index === 0
    case 'grandmaster':
    case 'endlessOverlord':
      return kind === 'king' && index === 0
    default:
      return false
  }
}
