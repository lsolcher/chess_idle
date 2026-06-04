/**
 * Arena tactical loadout helpers — deploy ranks, point cap, roster sync (Phase 9).
 */
import { buildOccupancy, coordKey } from '@/engine/board'
import { calculateArmyPvPValue } from '@/engine/pvpMath'
import { PLAYER_DEPLOY_RANKS } from '@/engine/pieceShop'
import type { BoardCoord, ChessPiece } from '@/types/game'

/** GDD §9.1 draft ranked point cap. */
export const ARENA_POINT_CAP = 1000

export function isArenaDeployRank(rank: number): boolean {
  return (PLAYER_DEPLOY_RANKS as readonly number[]).includes(rank)
}

export function deployedHasKing(pieces: readonly ChessPiece[]): boolean {
  return pieces.some((piece) => piece.side === 'player' && piece.kind === 'king')
}

export function calculateLoadoutPointTotal(pieces: readonly ChessPiece[]): number {
  return calculateArmyPvPValue([...pieces])
}

export function isLoadoutOverCap(pieces: readonly ChessPiece[], cap = ARENA_POINT_CAP): boolean {
  return calculateLoadoutPointTotal(pieces) > cap
}

export function canSaveArenaLoadout(
  deployed: readonly ChessPiece[],
  cap = ARENA_POINT_CAP,
): boolean {
  if (deployed.length === 0) return false
  if (!deployedHasKing(deployed)) return false
  return !isLoadoutOverCap(deployed, cap)
}

/** Deep-clone a piece for isolated arena board editing. */
export function clonePieceForArena(piece: ChessPiece): ChessPiece {
  return {
    ...piece,
    position: { ...piece.position },
    stats: { ...piece.stats },
    upgradeLevels: { ...piece.upgradeLevels },
    initiative: { ...piece.initiative },
    superPromotion: piece.superPromotion
      ? {
          ...piece.superPromotion,
          traits: { ...piece.superPromotion.traits },
        }
      : undefined,
  }
}

/**
 * Re-applies live roster stats/levels while keeping arena positions.
 * Drops pieces removed from the campaign roster.
 */
export function mergeDeployedWithRoster(
  deployed: readonly ChessPiece[],
  roster: readonly ChessPiece[],
): ChessPiece[] {
  const rosterById = new Map(roster.map((piece) => [piece.id, piece]))
  const merged: ChessPiece[] = []

  for (const placed of deployed) {
    const live = rosterById.get(placed.id)
    if (!live) continue
    merged.push({
      ...clonePieceForArena(live),
      position: { ...placed.position },
    })
  }

  return merged
}

/** Initializes arena board from campaign pieces already on deploy ranks. */
export function initialArenaDeployedFromRoster(roster: readonly ChessPiece[]): ChessPiece[] {
  return roster
    .filter(
      (piece) =>
        piece.side === 'player' && isArenaDeployRank(piece.position.rank) && piece.stats.hp > 0,
    )
    .map(clonePieceForArena)
}

export function isSquareEmpty(
  file: number,
  rank: number,
  deployed: readonly ChessPiece[],
): boolean {
  return !deployed.some(
    (piece) => piece.position.file === file && piece.position.rank === rank,
  )
}

export function findArenaDeploySquare(
  deployed: readonly ChessPiece[],
  kind: ChessPiece['kind'],
): BoardCoord | null {
  const occupancy = buildOccupancy([...deployed])
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

export function deployPieceAt(
  deployed: readonly ChessPiece[],
  rosterPiece: ChessPiece,
  coord: BoardCoord,
): ChessPiece[] | null {
  if (!isArenaDeployRank(coord.rank)) return null
  if (!isSquareEmpty(coord.file, coord.rank, deployed)) return null
  if (deployed.some((piece) => piece.id === rosterPiece.id)) return null

  return [...deployed.map(clonePieceForArena), clonePieceForArena({ ...rosterPiece, position: coord })]
}

export function removeDeployedPiece(
  deployed: readonly ChessPiece[],
  pieceId: string,
): ChessPiece[] {
  return deployed.filter((piece) => piece.id !== pieceId).map(clonePieceForArena)
}

/** Empty deploy-rank squares highlighted during placement. */
export function listArenaDeployTargetKeys(
  deployed: readonly ChessPiece[],
): string[] {
  const keys: string[] = []
  for (const rank of PLAYER_DEPLOY_RANKS) {
    for (let file = 0; file < 8; file += 1) {
      if (isSquareEmpty(file, rank, deployed)) {
        keys.push(coordKey({ file, rank }))
      }
    }
  }
  return keys
}
