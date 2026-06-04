/**

 * Discrete wave lifecycle helpers (GDD §1.8, Phase 3.5).

 * Pure functions — Pinia store orchestrates transitions.

 */

import { buildOccupancy, coordKey, getAllPieces } from '@/engine/board'

import type { EnPassantCarryMap } from '@/engine/enPassantEconomy'

import { getPrepDestinationRanks } from '@/engine/prepMovement'

import { bootstrapPieceInitiative } from '@/engine/initiative'
import { createPiece, type ChessPiece, WavePhase } from '@/types/game'

const PLAYER_KING_DEPLOY = { file: 4, rank: 0 } as const



/** Enemy HP multiplier applied after a failed wave (anti-frustration). */

export const FAIL_ENEMY_HP_SCALE = 0.8



export function isWaveCombatFrozen(phase: WavePhase): boolean {

  return phase === 'WAVE_PREP' || phase === 'WAVE_COMPLETE'

}



/** Full heal all friendly pieces between waves (safe room). */

export function healPlayerPiecesForPrep(pieces: ChessPiece[]): ChessPiece[] {

  return pieces.map((piece) => ({

    ...piece,

    stats: {

      ...piece.stats,

      hp: piece.stats.maxHp,

    },

  }))

}



/**

 * Keeps super-promotion overlays between stages and applies this stage's En Passant carry increment.

 */

export function persistArmyPromotionsBetweenStages(

  pieces: ChessPiece[],

  carryIncrement: EnPassantCarryMap,

): ChessPiece[] {

  return pieces.map((piece) => {

    const carry = carryIncrement[piece.id]

    let next: ChessPiece = { ...piece, promotionHold: false }



    if (carry && (carry.apBonus > 0 || carry.hpBonus > 0)) {

      const maxHp = next.stats.maxHp + carry.hpBonus

      next = {

        ...next,

        stats: {

          ...next.stats,

          ap: next.stats.ap + carry.apBonus,

          maxHp,

          hp: Math.min(maxHp, next.stats.hp + carry.hpBonus),

        },

      }

    }



    return next

  })

}

/** Moves advanced pawns / super-pieces back to deploy ranks between waves so they can fight again. */

export function relocateArmyToPrepRanks(

  playerPieces: ChessPiece[],

  enemyPieces: ChessPiece[],

): ChessPiece[] {

  const all = getAllPieces(playerPieces, enemyPieces)

  const occupancy = buildOccupancy(all)

  const result = playerPieces.map((piece) => ({ ...piece }))



  for (let i = 0; i < result.length; i++) {

    const piece = result[i]!

    if (piece.side !== 'player') continue



    const mustRelocate =

      piece.superPromotion !== undefined ||

      (piece.kind === 'pawn' && piece.position.rank >= 2)



    if (!mustRelocate) continue



    const ranks = getPrepDestinationRanks(piece.kind)

    let placed = false



    for (const rank of ranks) {

      for (let file = 0; file < 8; file += 1) {

        const to = { file, rank }

        const key = coordKey(to)

        if (occupancy.get(key)?.id === piece.id) {

          placed = true

          break

        }

        if (occupancy.has(key)) continue



        occupancy.delete(coordKey(piece.position))

        result[i] = { ...piece, position: to }

        occupancy.set(key, result[i]!)

        placed = true

        break

      }

      if (placed) break

    }

  }



  return result

}



export function countLivingEnemies(enemies: ChessPiece[]): number {

  return enemies.filter((piece) => piece.side === 'enemy' && piece.stats.hp > 0).length

}



export function findPlayerKing(pieces: ChessPiece[]): ChessPiece | undefined {

  return pieces.find((piece) => piece.side === 'player' && piece.kind === 'king')

}



/**

 * Wave clear when no living enemies remain (GDD §1.8).

 */

export function isWaveCleared(enemies: ChessPiece[]): boolean {

  return countLivingEnemies(enemies) === 0

}



/**

 * Wave failure when the player King is eliminated (GDD §1.8 fail state).

 */

export function isWaveFailed(playerPieces: ChessPiece[]): boolean {
  return getKingFailReason(playerPieces) !== null
}

/** King captured off the board or reduced to 0 HP. */
export function getKingFailReason(
  playerPieces: ChessPiece[],
): 'missing' | 'defeated' | null {
  const king = findPlayerKing(playerPieces)
  if (!king) return 'missing'
  if (king.stats.hp <= 0) return 'defeated'
  return null
}

/**
 * Restores a deploy-rank King after a failed wave (captured or "killed").
 */
export function restorePlayerKingForPrep(
  pieces: ChessPiece[],
  nowMs: number,
  globalSpeedMult = 1,
): ChessPiece[] {
  const others = pieces.filter((piece) => !(piece.side === 'player' && piece.kind === 'king'))
  const existing = pieces.find((piece) => piece.side === 'player' && piece.kind === 'king')
  const king =
    existing ??
    createPiece('player-king-0', 'king', 'player', { ...PLAYER_KING_DEPLOY })

  const restored: ChessPiece = {
    ...king,
    position: { ...PLAYER_KING_DEPLOY },
    stats: {
      ...king.stats,
      hp: king.stats.maxHp,
    },
  }

  return [
    ...others,
    bootstrapPieceInitiative(restored, nowMs, globalSpeedMult),
  ]
}



/**

 * Applies cumulative fail scaling — each fail multiplies enemy HP scale.

 * (GDD: repeat stage at 80% enemy HP.)

 */

export function applyFailEnemyHpScale(currentScale: number): number {

  return currentScale * FAIL_ENEMY_HP_SCALE

}


