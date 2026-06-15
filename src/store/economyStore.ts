/**
 * Run-scoped economy — gold, shop purchases, upgrade catalog (Pinia action module).
 * Mutates `game` store state; no separate persisted slice.
 */
import { defineStore } from 'pinia'
import { playGameSfx } from '@/store/gameAudioBridge'
import {
  buildPieceShopCatalog,
  createShopPieceId,
  findDeploySquare,
  MAX_DEPLOY_SLOTS,
  type PieceShopOffer,
} from '@/engine/pieceShop'
import { refreshPlayerArmyCombatStats } from '@/engine/playerStageScaling'
import { reduceRoyalDecree } from '@/engine/royalDecree'
import { pruneEnPassantCarry } from '@/engine/enPassantEconomy'
import { getPromotionStreakGoldMult } from '@/engine/promotion'
import {
  pickBestAffordablePurchase,
} from '@/engine/upgrades'
import {
  accumulateWaveCombatStats,
} from '@/engine/waveOutcome'
import {
  calculateActiveMult,
  calculateGoldAction,
  COMBO_CAP,
  COMBO_DECAY_MS,
  createPiece,
  type ChessPiece,
  type PieceKind,
} from '@/types/game'
import { bootstrapPieceInitiative } from '@/engine/initiative'
import { useGameStore } from '@/store/gameStore'

export interface AwardGoldOptions {
  applyActiveMult?: boolean
  incrementCombo?: boolean
  nowMs?: number
}

function game() {
  return useGameStore()
}

export const useEconomyStore = defineStore('economy', {
  actions: {
    applyComboDecay(nowMs = Date.now()): void {
      const g = game()
      if (g.combo.count <= 0) return
      const elapsed = nowMs - g.combo.lastActionAtMs
      if (elapsed >= COMBO_DECAY_MS) {
        g.combo.count = 0
      }
    },

    incrementCombo(nowMs = Date.now()): void {
      const g = game()
      this.applyComboDecay(nowMs)
      g.combo.count = Math.min(g.combo.count + 1, COMBO_CAP)
      g.combo.lastActionAtMs = nowMs
    },

    addGold(amount: number): void {
      if (!Number.isFinite(amount) || amount <= 0) return
      const g = game()
      g.currencies.gold += amount
      g.currencies.totalGoldEarned += amount
      g.lifetime.lifetimeGoldEarned += amount
      g.touchSessionActivity()
    },

    spendGold(amount: number): boolean {
      if (!Number.isFinite(amount) || amount <= 0) return true
      const g = game()
      if (g.currencies.gold < amount) return false
      g.currencies.gold -= amount
      return true
    },

    addEloShards(amount: number): void {
      if (!Number.isFinite(amount) || amount <= 0) return
      game().currencies.eloShards += amount
    },

    spendEloShards(amount: number): boolean {
      if (!Number.isFinite(amount) || amount <= 0) return true
      const g = game()
      if (g.currencies.eloShards < amount) return false
      g.currencies.eloShards -= amount
      return true
    },

    recordUpgradePurchase(): void {
      game().lifetime.totalUpgradesBought += 1
    },

    awardActionGold(options: AwardGoldOptions = {}): number {
      const g = game()
      const nowMs = options.nowMs ?? Date.now()
      this.applyComboDecay(nowMs)

      if (options.incrementCombo) {
        this.incrementCombo(nowMs)
      }

      const activeMult = options.applyActiveMult
        ? calculateActiveMult(g.combo.count)
        : 1

      const raw = calculateGoldAction(
        g.currentStage,
        g.prestigeGoldMult,
        activeMult,
        g.friendlyActionsThisStage,
      )

      const studyMult = g.studyPackActive ? 1.25 : 1
      const streakMult = getPromotionStreakGoldMult(g.promotion.streak)
      const granted = raw * studyMult * streakMult

      this.addGold(granted)
      if (g.wavePhase === 'WAVE_ACTIVE') {
        g.waveCombatStats = accumulateWaveCombatStats(g.waveCombatStats, {
          goldFromActions: granted,
          friendlyActions: 1,
        })
      }
      g.friendlyActionsThisStage += 1
      return granted
    },

    deployPlayerPiece(piece: ChessPiece, nowMs = Date.now()): void {
      const g = game()
      const bootstrapped = bootstrapPieceInitiative(piece, nowMs, g.globalSpeedMult)
      const [scaled] = refreshPlayerArmyCombatStats(
        [bootstrapped],
        g.currentStage,
        g.promotion.masteryLevel,
        g.metaModifiers.apMult,
      )
      g.playerPieces = [...g.playerPieces, scaled!]
      g.royalDecree = reduceRoyalDecree(g.royalDecree, {
        type: 'PLAYER_PIECE_DEPLOYED',
        playerPieces: g.playerPieces,
      })
    },

    deployPawn(file: number, rank: number, id?: string, nowMs = Date.now()): ChessPiece {
      const g = game()
      const pawnId = id ?? createShopPieceId('pawn', g.playerPieces)
      const pawn = createPiece(pawnId, 'pawn', 'player', { file, rank })
      this.deployPlayerPiece(pawn, nowMs)
      return pawn
    },

    purchasePieceFromShop(kind: PieceKind, nowMs = Date.now()): boolean {
      const g = game()
      const offer = g.pieceShopOffers.find((o) => o.kind === kind)
      if (!offer?.purchasable) return false
      if (!this.spendGold(offer.cost)) return false

      const square = findDeploySquare(g.playerPieces, g.enemyPieces, kind)
      if (!square) {
        this.addGold(offer.cost)
        return false
      }

      const piece = createPiece(createShopPieceId(kind, g.playerPieces), kind, 'player', square)
      this.deployPlayerPiece(piece, nowMs)
      this.recordUpgradePurchase()
      playGameSfx('upgrade')
      return true
    },

    purchaseBoardSlot(_nowMs = Date.now()): boolean {
      const g = game()
      const offer = g.pieceShopOffers.find((o) => o.id === 'shop:boardSlot')
      if (!offer?.purchasable || g.deploySlots >= MAX_DEPLOY_SLOTS) return false
      if (!this.spendGold(offer.cost)) return false
      g.deploySlots += 1
      this.recordUpgradePurchase()
      playGameSfx('upgrade')
      return true
    },

    purchasePieceShopOffer(offerId: string, nowMs = Date.now()): boolean {
      if (offerId === 'shop:boardSlot') {
        return this.purchaseBoardSlot(nowMs)
      }
      const kind = offerId.replace('shop:piece:', '') as PieceKind
      return this.purchasePieceFromShop(kind, nowMs)
    },

    removePlayerPiece(pieceId: string): void {
      const g = game()
      g.playerPieces = g.playerPieces.filter((piece) => piece.id !== pieceId)
      const { [pieceId]: _removed, ...restCarry } = g.enPassantCarryByPieceId
      g.enPassantCarryByPieceId = pruneEnPassantCarry(restCarry, g.playerPieces)
      g.royalDecree = reduceRoyalDecree(g.royalDecree, {
        type: 'PLAYER_PIECE_REMOVED',
        playerPieces: g.playerPieces,
      })
    },

    purchaseUpgradeOffer(offerId: string): boolean {
      const g = game()
      const offer = g.upgradeOffers.find((o) => o.id === offerId)
      if (!offer?.affordable) return false
      if (!this.spendGold(offer.cost)) return false

      if (offer.track === 'clickPower') {
        g.clickPowerLevel = offer.nextLevel
        this.recordUpgradePurchase()
        playGameSfx('upgrade')
        return true
      }

      if (offer.track === 'promotionMastery') {
        g.promotion.masteryLevel = offer.nextLevel
        this.recordUpgradePurchase()
        playGameSfx('upgrade')
        return true
      }

      if (offer.track === 'autoAdvanceWaves') {
        if (g.autoAdvanceWavesPurchased) return false
        if (!this.spendGold(offer.cost)) return false
        g.autoAdvanceWavesPurchased = true
        g.autoAdvanceWavesEnabled = true
        g.autoStartWavesEnabled = false
        this.recordUpgradePurchase()
        playGameSfx('upgrade')
        return true
      }

      if (!offer.pieceId) return false
      const index = g.playerPieces.findIndex((piece) => piece.id === offer.pieceId)
      if (index === -1) return false

      const piece = g.playerPieces[index]!
      const levels = { ...piece.upgradeLevels }
      if (offer.track === 'initiative') {
        levels.initiative = offer.nextLevel
      } else {
        levels[offer.track] = offer.nextLevel
      }

      const updated: ChessPiece = {
        ...piece,
        upgradeLevels: levels,
        initiative: {
          ...piece.initiative,
          iniLevel: levels.initiative,
        },
      }
      const [scaled] = refreshPlayerArmyCombatStats(
        [updated],
        g.currentStage,
        g.promotion.masteryLevel,
        g.metaModifiers.apMult,
        { preserveHpRatio: true },
      )
      g.playerPieces[index] = scaled!
      g.pulsePieceJuice(piece.id)
      this.recordUpgradePurchase()
      playGameSfx('upgrade')
      return true
    },

    purchaseBestRoiUpgrade(): boolean {
      const g = game()
      const pick = pickBestAffordablePurchase(g.upgradeOffers, g.pieceShopOffers)
      if (!pick) return false
      if (pick.source === 'shop') {
        return this.purchasePieceShopOffer(pick.id)
      }
      return this.purchaseUpgradeOffer(pick.id)
    },

    /** Builds shop catalog from current run state (getter helper for tests). */
    buildShopOffers(): PieceShopOffer[] {
      const g = game()
      return buildPieceShopCatalog({
        gold: g.currencies.gold,
        maxStageReached: g.maxStageReached,
        currentStage: g.currentStage,
        wavePhase: g.wavePhase,
        playerPieces: g.playerPieces,
        enemyPieces: g.enemyPieces,
        unlockedSlots: g.unlockedSlots,
        deploySlots: g.deploySlots,
        globalSpeedMult: g.globalSpeedMult,
      })
    },
  },
})
