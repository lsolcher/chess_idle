/**
 * Prestige reset and post-reset run bootstrap (GDD §2.4).
 */
import { BASE_DEPLOY_SLOTS } from '@/engine/pieceShop'
import { findDeploySquare } from '@/engine/pieceShop'
import { applyMetaModifiersToState, calculateMetaModifiers, getPrestigeEloMultBonus } from '@/engine/metaUpgrades'
import {
  calculateEloShardsEarned,
  createInitialGameState,
  createPiece,
  type AchievementFlags,
  type ChessPiece,
  type GameState,
  type LifetimeStats,
  type MetaUpgradeState,
} from '@/types/game'
import type { EquippedCosmetics } from '@/engine/cosmetics'
import type { AestheticPreferences } from '@/types/game'

export interface PrestigeRetainBundle {
  eloShards: number
  trophies: number
  metaUpgrades: MetaUpgradeState
  achievements: AchievementFlags
  hasPrestigedOnce: boolean
  lifetime: LifetimeStats
  equippedCosmetics: EquippedCosmetics
  aestheticPreferences: AestheticPreferences
}

/**
 * Elo earned on the upcoming prestige using current run totals (GDD §2.4).
 */
export function projectPrestigeEloEarned(state: GameState): number {
  return calculateEloShardsEarned(
    state.maxStageReached,
    state.currencies.totalGoldEarned,
    getPrestigeEloMultBonus(state.achievements),
  )
}

/**
 * Builds the post-prestige snapshot: fresh run with retained meta currencies.
 */
export function buildPostPrestigeState(
  nowMs: number,
  retain: PrestigeRetainBundle,
  eloJustEarned: number,
): GameState {
  const fresh = createInitialGameState(nowMs)
  const totalElo = retain.eloShards + eloJustEarned

  fresh.currencies = {
    gold: 0,
    eloShards: totalElo,
    trophies: retain.trophies,
    totalGoldEarned: 0,
  }
  fresh.metaUpgrades = { ...retain.metaUpgrades }
  fresh.achievements = { ...retain.achievements }
  fresh.hasPrestigedOnce = true
  fresh.prestigeAvailable = true
  fresh.currentStage = 1
  fresh.maxStageReached = 1
  fresh.waveCheckpointStage = 1
  fresh.lastFailRewindToStage = null
  fresh.lifetime = {
    ...retain.lifetime,
    totalPrestiges: retain.lifetime.totalPrestiges + 1,
  }
  fresh.equippedCosmetics = { ...retain.equippedCosmetics }
  fresh.aestheticPreferences = { ...retain.aestheticPreferences }
  fresh.wavePhase = 'WAVE_PREP'
  fresh.exhibitionLastTickMs = nowMs
  fresh.enPassantCarryByPieceId = {}
  fresh.bossCombat = null
  fresh.lastPawnLeakDamage = 0
  fresh.waveOutcomeReport = null

  const mods = calculateMetaModifiers(fresh.metaUpgrades)
  fresh.deploySlots = BASE_DEPLOY_SLOTS + mods.bonusDeploySlots

  applyMetaModifiersToState(fresh)
  return fresh
}

/**
 * Deploys Grandmaster Instinct bonus pawns onto empty rank-1 squares after reset.
 */
export function deployGrandmasterBonusPawns(
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
  pawnCount: number,
  nowMs: number,
): ChessPiece[] {
  let pieces = [...playerPieces]
  const enemies = enemyPieces
  for (let i = 0; i < pawnCount; i += 1) {
    const square = findDeploySquare(pieces, enemies, 'pawn')
    if (!square) break
    const pawn = createPiece(`bonus-pawn-${nowMs}-${i}`, 'pawn', 'player', square)
    pieces = [...pieces, pawn]
  }
  return pieces
}
