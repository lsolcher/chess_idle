/**
 * Central Pinia store for Idle Chess RPG v0.3 run state.
 * Wraps `GameState` from domain types; combat loops and UI read/write through here.
 */
import { createPinia, defineStore, getActivePinia, setActivePinia } from 'pinia'
import {
  bootstrapPieceInitiative,
  bootstrapPiecesForCombat,
  buildTurnOrderQueue,
  getNextReadyActor,
  getReadyPlayerPieceIds,
  processReadyInitiativeActions,
  scheduleNextAction,
  syncInitiativeProgress,
} from '@/engine/initiative'
import { selectBestMove } from '@/engine/aiHeuristic'
import { getEnemyMoveHeuristic } from '@/engine/enemyAiHeuristic'
import { coordKey, getAllPieces } from '@/engine/board'
import { resolveCombatMove } from '@/engine/combat'
import {
  CLICK_COOLDOWN_MS,
  computeClickCooldownProgress,
  isClickCombatReady,
  resolveClickDamage,
} from '@/engine/clickCombat'
import { getCombatTimeMs } from '@/engine/combatTime'
import type { BoardMove } from '@/engine/moves'
import { generateLegalMoves } from '@/engine/moves'
import {
  getWaveCheckpointStage,
  resolveStageAfterFail,
} from '@/engine/waveCheckpoints'
import {
  applyFailEnemyHpScale,
  getKingFailReason,
  healPlayerPiecesForPrep,
  countLivingEnemies,
  isWaveCleared,
  isWaveFailed,
  persistArmyPromotionsBetweenStages,
  relocateArmyToPrepRanks,
  restorePlayerKingForPrep,
} from '@/engine/waveState'
import {
  getRoyalDecreeModifiers,
  reduceRoyalDecree,
  runRoyalDecreeStateMachineCheck,
} from '@/engine/royalDecree'
import {
  applyDeploySlotMilestones,
  buildPieceShopCatalog,
  createShopPieceId,
  findDeploySquare,
  MAX_DEPLOY_SLOTS,
  resolveUnlockedSlotsFromMilestones,
  type PieceShopOffer,
} from '@/engine/pieceShop'
import { getBossWaveClearMultiplier, isBossStage } from '@/engine/stageManager'
import { generatePrepRepositionMoves } from '@/engine/prepMovement'
import { playCombatFeedbackAudio, playGameSfx } from '@/store/gameAudioBridge'
import { spawnEnemiesForStage } from '@/engine/waves'
import {
  applyMetaModifiersToState,
  buildMetaUpgradeOffers,
  calculateMetaModifiers,
  canPurchaseMetaUpgrade,
  getMetaUpgradeCost,
  getPrestigeEloMultBonus,
  isMetaTreeUnlocked,
  type MetaUpgradeOffer,
} from '@/engine/metaUpgrades'
import {
  buildPostPrestigeState,
  deployGrandmasterBonusPawns,
  projectPrestigeEloEarned,
} from '@/engine/prestige'
import { calculateTotalExhibitionGoldPerSec, tickExhibitionGold } from '@/engine/exhibitions'
import {
  getEnPassantCarryPercent,
  pruneEnPassantCarry,
  snapshotEnPassantCarry,
  retainPromotionFormHints,
} from '@/engine/enPassantEconomy'
import {
  consumeRevivalFlashAction,
  getRevivalFlashApMult,
  isPieceInvulnerable,
  tryImmortalRevive,
} from '@/engine/immortalGame'
import { evaluateAutoAdvanceTick } from '@/engine/waveAutomation'
import {
  applyBossDamageReduction,
  applyKingReflectDamage,
  calculateIronRookReflectDamage,
  createBossCombatRuntime,
  tickBossMechanics,
} from '@/engine/bossMechanics'
import { evaluateBossTrophyAward } from '@/engine/bossTrophies'
import { getBossDefinition, resolveBossIdentity } from '@/engine/bossIdentity'
import {
  attributionFromEnemyMove,
  formatKingFailTelegraph,
} from '@/engine/kingFailAttribution'
import {
  getBossTimeRemainingMs,
  getBossWaveLimitMs,
  isBossWaveTimedOut,
} from '@/engine/bossTimer'
import {
  buildAestheticProgressSnapshot,
  getBoardEvolutionClasses,
  getBoardEvolutionTier,
  getPermanentTrophyShellClasses,
  getPieceAuraClasses,
  MAX_PIECE_AURA_TIER,
  resolvePermanentVisualTrophies,
} from '@/engine/aestheticProgression'
import { getGrandmasterCombatModifiers } from '@/engine/grandmasterBoss'
import {
  getMusicLayerProgress,
  MUSIC_LAYER_DEFINITIONS,
  type MusicLayerDefinition,
} from '@/engine/musicLayers'
import { serializeGameState } from '@/engine/gameSerialization'
import {
  accumulateWaveCombatStats,
  buildDefeatReport,
  buildVictoryReport,
  createEmptyWaveCombatStats,
} from '@/engine/waveOutcome'
import {
  nextCombatActionsSinceEnemyKill,
  shouldFailWaveForCombatStall,
} from '@/engine/waveCombatPacing'
import { ARENA_POINT_CAP, canSaveArenaLoadout } from '@/engine/arenaLoadout'
import { shouldRunAutoShopAssistant } from '@/engine/supporterQoL'
import { useMetaStore } from '@/store/metaStore'
import { calculateArmyPvPValue } from '@/engine/pvpMath'
import {
  exportArmySnapshot,
  exportArmySnapshotFromPieces,
  importArmySnapshot,
  saveGhostArmy,
  serializeArmySnapshot,
} from '@/engine/ghostSystem'
import {
  bumpLifetimeStage,
  COSMETIC_CATALOG,
  findCosmeticById,
  getCosmeticProgress,
  isCosmeticUnlocked,
  resolveCosmeticTheme,
  resolveEquippedCosmetics,
  type CosmeticDefinition,
} from '@/engine/cosmetics'
import { resolveEnemyPawnLeaks } from '@/engine/pawnLeak'
import {
  buildPromotionContext,
  runPromotionPipeline,
  updatePlayerPiece,
} from '@/store/promotionActions'
import {
  getAvailablePromotionForms,
  getPromotionStreakGoldMult,
} from '@/engine/promotion'
import {
  getHighlightedUpgradeCatalog,
  type UpgradeOffer,
} from '@/engine/upgrades'
import type { PersistenceOptions } from 'pinia-plugin-persistedstate'
import {
  bootstrapPersistedRosters,
  gameStorePersistConfig,
  restorePersistedSession,
} from '@/store/persistConfig'
import {
  createCombatFeedback,
  feedbackFromCombatMove,
  isScreenShaking as isScreenShakeActive,
  pruneCombatFeedback,
  SCREEN_SHAKE_MS,
} from '@/engine/combatFeedback'
import {
  buildPieceStats,
  calculateActionIntervalSec,
  calculateActiveMult,
  calculateGoldAction,
  calculateGoldClear,
  calculateEloShardsEarned,
  COMBO_CAP,
  COMBO_DECAY_MS,
  createInitialGameState,
  createPiece,
  normalizeAutoAiPersonality,
  STAMINA_CLICK_COST,
  STAMINA_REGEN_PER_SEC,
  type AutoAiPersonality,
  type ChessPiece,
  type CombatFocus,
  type AestheticPreferences,
  type GameState,
  type MetaUpgradeId,
  type PieceKind,
  type SuperPromotionForm,
} from '@/types/game'

/** Minimum stage before manual prestige unlocks (GDD §2.4). */
export const PRESTIGE_UNLOCK_STAGE = 20

export interface AwardGoldOptions {
  applyActiveMult?: boolean
  incrementCombo?: boolean
  nowMs?: number
}

export interface CombatTickResult {
  actedCount: number
  enemyActedCount: number
  goldEarned: number
  actedPieceIds: string[]
  enemyActedPieceIds: string[]
}

/** Narrows Pinia `this.$state` for actions that pass full state into pure engines. */
function readStoreState(store: { $state: unknown }): GameState {
  return store.$state as GameState
}

export const useGameStore = defineStore('game', {
  state: (): GameState => createInitialGameState(),

  getters: {
    /** Nested currency accessors — not top-level state mirrors (Pinia § tech debt). */
    gold: (state): number => state.currencies.gold,
    eloShards: (state): number => state.currencies.eloShards,
    trophies: (state): number => state.currencies.trophies,
    totalGoldEarned: (state): number => state.currencies.totalGoldEarned,
    comboCount: (state): number => state.combo.count,

    activeMult(state): number {
      return calculateActiveMult(state.combo.count)
    },

    isRoyalDecreeActive: (state): boolean => state.royalDecree.isActive,

    royalDecreeModifiers(state) {
      return getRoyalDecreeModifiers(state.royalDecree)
    },

    isAutoMode: (state): boolean => state.autoMode,
    /** Alias for GDD "autoPlay" toggle naming. */
    autoPlay: (state): boolean => state.autoMode,
    isCombatLoopRunning: (state): boolean => state.combatLoopRunning,
    isWavePrep: (state): boolean => state.wavePhase === 'WAVE_PREP',
    isWaveActive: (state): boolean => state.wavePhase === 'WAVE_ACTIVE',

    showKingFallOverlay: (state): boolean =>
      state.wavePhase === 'WAVE_PREP' &&
      state.lastWaveFailReason === 'king-fallen' &&
      state.waveOutcomeReport === null,

    showWaveOutcomeModal: (state): boolean => state.waveOutcomeReport !== null,

    kingFallMessage(state): string {
      if (state.lastWaveFailReason !== 'king-fallen') return ''
      if (state.lastKingFailAttribution?.source === 'stall') {
        return 'Wave forfeited: eliminate all enemies before the stall timer runs out. Position your army and try again.'
      }
      const detail =
        state.lastKingFailDetail === 'missing'
          ? 'Your King was captured.'
          : 'Your King was defeated.'
      const rewind =
        state.lastFailRewindToStage !== null
          ? ` Returned to milestone wave ${state.lastFailRewindToStage}.`
          : ''
      const soft =
        state.failCountThisStage > 0
          ? ` Enemies at ${Math.round(state.enemyHpScale * 100)}% HP this stage.`
          : ''
      return `${detail}${rewind}${soft} Position your army and start the wave again.`
    },

    waveCheckpointLabel(state): string {
      return `Checkpoint: wave ${state.waveCheckpointStage}`
    },

    kingFallTelegraph(state): string {
      if (state.lastWaveFailReason !== 'king-fallen') return ''
      return formatKingFailTelegraph(
        state.lastKingFailAttribution,
        state.lastKingFailDetail,
        state.lastPawnLeakDamage,
      )
    },

    /** Resolved Tailwind classes for board, pieces, and shell (Phase 8). */
    cosmeticTheme(state) {
      return resolveCosmeticTheme(state.equippedCosmetics, state.lifetime)
    },

    shellThemeClass(): string {
      return this.cosmeticTheme.shell
    },

    /** Run-scoped + lifetime aesthetic snapshot (Phase 8.6). */
    aestheticProgress(state) {
      return buildAestheticProgressSnapshot(
        state.currentStage,
        state.lifetime.maxStageEverReached,
        state.lifetime.totalPrestiges,
      )
    },

    /** Extra board square classes from gradual evolution (CSS-only). */
    gradualBoardClasses(state): { light: string; dark: string } {
      if (
        !state.aestheticPreferences.gradualProgression ||
        !state.aestheticPreferences.boardEvolution
      ) {
        return { light: '', dark: '' }
      }
      return getBoardEvolutionClasses(getBoardEvolutionTier(state.currentStage))
    },

    permanentShellAccentClasses(state): string {
      return getPermanentTrophyShellClasses(
        resolvePermanentVisualTrophies(
          state.lifetime.maxStageEverReached,
          state.lifetime.totalPrestiges,
        ),
      )
    },

    musicLayerWardrobe(state): {
      definition: MusicLayerDefinition
      unlocked: boolean
      stagePct: number
      prestigeMet: boolean
    }[] {
      return MUSIC_LAYER_DEFINITIONS.map((definition) => {
        const progress = getMusicLayerProgress(definition, state.lifetime)
        return { definition, ...progress }
      })
    },

    /** Wardrobe rows with unlock progress for the Themes tab. */
    effectivePlayerSpeedMult(state): number {
      const gm = getGrandmasterCombatModifiers(state.bossCombat, state.enemyPieces)
      return state.globalSpeedMult * gm.playerInitiativeMult
    },

    grandmasterCombatModifiers(state) {
      return getGrandmasterCombatModifiers(state.bossCombat, state.enemyPieces)
    },

    bossTimeRemainingMs(state): number {
      return getBossTimeRemainingMs(state.bossWaveDeadlineMs, Date.now())
    },

    isBossWaveTimedOut(state): boolean {
      return isBossWaveTimedOut(state.bossWaveDeadlineMs, Date.now())
    },

    cosmeticWardrobe(state): {
      definition: CosmeticDefinition
      unlocked: boolean
      equipped: boolean
      progress: ReturnType<typeof getCosmeticProgress>
    }[] {
      const equipped = resolveEquippedCosmetics(state.equippedCosmetics, state.lifetime)
      return COSMETIC_CATALOG.map((definition) => ({
        definition,
        unlocked: isCosmeticUnlocked(definition, state.lifetime),
        equipped:
          (definition.category === 'board' && equipped.boardThemeId === definition.id) ||
          (definition.category === 'pieceSkin' && equipped.pieceSkinId === definition.id) ||
          (definition.category === 'shell' && equipped.shellBackgroundId === definition.id),
        progress: getCosmeticProgress(definition, state.lifetime),
      }))
    },

    isWaveComplete: (state): boolean => state.wavePhase === 'WAVE_COMPLETE',
    canStartWave: (state): boolean => state.wavePhase === 'WAVE_PREP',
    canProceedToNextWave: (state): boolean => state.wavePhase === 'WAVE_COMPLETE',

    /** Player pieces with a full initiative bar. */
    readyPlayerPieceIds(state): string[] {
      return getReadyPlayerPieceIds(state.playerPieces, state.lastSimulatedMs)
    },

    /** Full combat queue — friendly + enemy, sorted by initiative (GDD §1.5 turn order). */
    combatTurnOrder(state) {
      const gm = getGrandmasterCombatModifiers(state.bossCombat, state.enemyPieces)
      return buildTurnOrderQueue(
        state.playerPieces,
        state.enemyPieces,
        state.lastSimulatedMs,
        state.globalSpeedMult,
        {
          player: state.globalSpeedMult * gm.playerInitiativeMult,
          enemy: state.globalSpeedMult,
        },
      )
    },

    enemyPiecesWithProgress(state): ChessPiece[] {
      return syncInitiativeProgress(
        state.enemyPieces,
        state.lastSimulatedMs,
        state.globalSpeedMult,
      )
    },

    /** Piece that may act now; in manual mode player turns set manualPendingPieceId. */
    activeTurnPieceId(state): string | null {
      if (state.wavePhase !== 'WAVE_ACTIVE') return null
      if (state.manualPendingPieceId) return state.manualPendingPieceId
      const actor = getNextReadyActor(
        state.playerPieces,
        state.enemyPieces,
        state.lastSimulatedMs,
      )
      return actor?.id ?? null
    },

    activeTurnSide(state): 'player' | 'enemy' | null {
      if (state.wavePhase !== 'WAVE_ACTIVE') return null
      if (state.manualPendingPieceId) return 'player'
      const actor = getNextReadyActor(
        state.playerPieces,
        state.enemyPieces,
        state.lastSimulatedMs,
      )
      return actor?.side ?? null
    },

    isAwaitingManualMove(state): boolean {
      return (
        !state.autoMode &&
        state.wavePhase === 'WAVE_ACTIVE' &&
        state.manualPendingPieceId !== null
      )
    },

    hasNoManualLegalMoves(): boolean {
      return this.manualLegalMoves.length === 0 && this.isAwaitingManualMove
    },

    canSkipManualTurn(): boolean {
      return this.hasNoManualLegalMoves
    },

    /** Legal moves for the piece paused in manual mode. */
    manualLegalMoves(state): BoardMove[] {
      if (!state.manualPendingPieceId || state.wavePhase !== 'WAVE_ACTIVE') return []
      const piece = state.playerPieces.find((p) => p.id === state.manualPendingPieceId)
      if (!piece) return []
      const decreeMods = getRoyalDecreeModifiers(state.royalDecree)
      return generateLegalMoves(piece, {
        allPieces: getAllPieces(state.playerPieces, state.enemyPieces),
        decreeStepEnabled: decreeMods.decreeStepEnabled,
      })
    },

    /** Empty deploy-rank squares reachable during WAVE_PREP repositioning. */
    prepLegalMoves(state): BoardMove[] {
      if (!state.prepPendingPieceId || state.wavePhase !== 'WAVE_PREP') return []
      const piece = state.playerPieces.find((p) => p.id === state.prepPendingPieceId)
      if (!piece) return []
      return generatePrepRepositionMoves(piece, state.playerPieces, state.enemyPieces)
    },

    hasPendingPromotion: (state): boolean => state.pendingPromotion !== null,
    staminaCurrent: (state): number => state.stamina.current,
    staminaMax: (state): number => state.stamina.max,

    canClickEnemy: (state): boolean =>
      state.wavePhase === 'WAVE_ACTIVE' &&
      isClickCombatReady(state.clickCombatReadyAtMs, state.lastSimulatedMs) &&
      state.stamina.current >= STAMINA_CLICK_COST,

    isStrikeFocus: (state): boolean => state.combatFocus === 'strike',

    isMoveFocus: (state): boolean => state.combatFocus === 'move',

    canArmStrikeFocus: (state): boolean => state.wavePhase === 'WAVE_ACTIVE',

    canArmMoveFocus(state): boolean {
      if (state.wavePhase !== 'WAVE_ACTIVE' || state.autoMode) return false
      return state.manualPendingPieceId !== null
    },

    canStrikeEnemy(state): boolean {
      return (
        state.combatFocus === 'strike' &&
        state.wavePhase === 'WAVE_ACTIVE' &&
        isClickCombatReady(state.clickCombatReadyAtMs, state.lastSimulatedMs) &&
        state.stamina.current >= STAMINA_CLICK_COST
      )
    },

    clickCooldownProgress(state): number {
      if (state.wavePhase !== 'WAVE_ACTIVE') return 1
      return computeClickCooldownProgress(
        state.clickCombatReadyAtMs,
        state.lastSimulatedMs,
      )
    },

    isCombatTimePaused(state): boolean {
      return !state.autoMode && state.manualPendingPieceId !== null
    },

    playerPieceCount: (state): number =>
      state.playerPieces.filter((piece) => piece.side === 'player').length,

    playerPiecesWithProgress(state: GameState): ChessPiece[] {
      const gm = getGrandmasterCombatModifiers(state.bossCombat, state.enemyPieces)
      return syncInitiativeProgress(
        state.playerPieces,
        state.lastSimulatedMs,
        state.globalSpeedMult * gm.playerInitiativeMult,
      )
    },

    nextActingPieceId(state): string | null {
      const gm = getGrandmasterCombatModifiers(state.bossCombat, state.enemyPieces)
      const head = buildTurnOrderQueue(
        state.playerPieces,
        state.enemyPieces,
        state.lastSimulatedMs,
        state.globalSpeedMult,
        {
          player: state.globalSpeedMult * gm.playerInitiativeMult,
          enemy: state.globalSpeedMult,
        },
      )[0]
      return head?.id ?? null
    },

    canPrestige: (state): boolean => state.maxStageReached >= PRESTIGE_UNLOCK_STAGE,

    projectedGoldPerAction(state): number {
      return calculateGoldAction(
        state.currentStage,
        state.prestigeGoldMult,
        calculateActiveMult(state.combo.count),
        state.friendlyActionsThisStage,
      )
    },

    /** Rough idle income/sec from initiative action rate (GDD §5.1 footer). */
    estimatedGoldPerSec(state): number {
      const perAction = calculateGoldAction(
        state.currentStage,
        state.prestigeGoldMult,
        1,
        state.friendlyActionsThisStage,
      )
      const streakMult = getPromotionStreakGoldMult(state.promotion.streak)
      let actionsPerSec = 0
      for (const piece of state.playerPieces) {
        const interval = calculateActionIntervalSec(
          piece.initiative.baseIntervalSec,
          piece.upgradeLevels.initiative,
          state.globalSpeedMult,
        )
        if (interval > 0) actionsPerSec += 1 / interval
      }
      return perAction * streakMult * actionsPerSec
    },

    upgradeOffers(state): UpgradeOffer[] {
      return getHighlightedUpgradeCatalog({
        gold: state.currencies.gold,
        playerPieces: state.playerPieces,
        clickPowerLevel: state.clickPowerLevel,
        promotionMasteryLevel: state.promotion.masteryLevel,
        globalSpeedMult: state.globalSpeedMult,
        currentStage: state.currentStage,
        autoAdvanceWavesPurchased: state.autoAdvanceWavesPurchased,
      })
    },

    bestRoiUpgradeId(state): string | null {
      return state.currencies.gold > 0
        ? (getHighlightedUpgradeCatalog({
            gold: state.currencies.gold,
            playerPieces: state.playerPieces,
            clickPowerLevel: state.clickPowerLevel,
            promotionMasteryLevel: state.promotion.masteryLevel,
            globalSpeedMult: state.globalSpeedMult,
            currentStage: state.currentStage,
            autoAdvanceWavesPurchased: state.autoAdvanceWavesPurchased,
          }).find((o) => o.isBestRoi)?.id ?? null)
        : null
    },

    pieceShopOffers(state): PieceShopOffer[] {
      return buildPieceShopCatalog({
        gold: state.currencies.gold,
        maxStageReached: state.maxStageReached,
        currentStage: state.currentStage,
        wavePhase: state.wavePhase,
        playerPieces: state.playerPieces,
        enemyPieces: state.enemyPieces,
        unlockedSlots: state.unlockedSlots,
        deploySlots: state.deploySlots,
      })
    },

    armySlotsUsed: (state): number =>
      state.playerPieces.filter((piece) => piece.side === 'player').length,

    armySlotsMax: (state): number => state.deploySlots,

    /** Campaign roster eligible for arena deployment (live stats). */
    unlockedPieces: (state): ChessPiece[] =>
      state.playerPieces.filter((piece) => piece.side === 'player'),

    arenaPointCap: (): number => ARENA_POINT_CAP,

    isCurrentStageBoss: (state): boolean => isBossStage(state.currentStage),

    bossClearGoldMultiplier: (state): number =>
      getBossWaveClearMultiplier(state.currentStage),

    activeBossIdentity: (state) => resolveBossIdentity(state.currentStage),

    activeBossLabel(state): string | null {
      const id = resolveBossIdentity(state.currentStage)
      return id ? getBossDefinition(id).label : null
    },

    isScreenShaking(state): boolean {
      return isScreenShakeActive(state.screenShakeUntilMs, Date.now())
    },

    projectedEloEarned(state): number {
      return calculateEloShardsEarned(
        state.maxStageReached,
        state.currencies.totalGoldEarned,
        getPrestigeEloMultBonus(state.achievements),
      )
    },

    metaModifiers(state) {
      return calculateMetaModifiers(state.metaUpgrades)
    },

    metaTreeUnlocked(state): boolean {
      return isMetaTreeUnlocked(state.hasPrestigedOnce, state.currencies.eloShards)
    },

    metaUpgradeOffers(state): MetaUpgradeOffer[] {
      return buildMetaUpgradeOffers(
        state.metaUpgrades,
        state.currencies.eloShards,
        isMetaTreeUnlocked(state.hasPrestigedOnce, state.currencies.eloShards),
      )
    },

    exhibitionGoldPerSec(state): number {
      const mods = calculateMetaModifiers(state.metaUpgrades)
      if (mods.exhibitionRank <= 0) return 0
      return calculateTotalExhibitionGoldPerSec(
        mods.exhibitionRank,
        state.currentStage,
        state.playerPieces,
        state.prestigeGoldMult,
        state.globalSpeedMult,
      )
    },
  },

  actions: {
    initGame(nowMs = Date.now()): void {
      Object.assign(this.$state, createInitialGameState(nowMs))
      this.autoAiPersonality = normalizeAutoAiPersonality(this.autoAiPersonality)
      this.applyMetaModifiers()
      this.syncMilestoneUnlocks()
      this.royalDecree = reduceRoyalDecree(this.royalDecree, { type: 'RUN_INITIALIZED' })
      this.playerPieces = healPlayerPiecesForPrep(
        this.playerPieces.map((piece) =>
          bootstrapPieceInitiative(piece, nowMs, this.globalSpeedMult),
        ),
      )
      this.enemyPieces = []
      this.wavePhase = 'WAVE_PREP'
      this.manualPendingPieceId = null
      this.prepPendingPieceId = null
      this.combatLoopRunning = false
    },

    applyComboDecay(nowMs = Date.now()): void {
      if (this.combo.count <= 0) return
      const elapsed = nowMs - this.combo.lastActionAtMs
      if (elapsed >= COMBO_DECAY_MS) {
        this.combo.count = 0
      }
    },

    incrementCombo(nowMs = Date.now()): void {
      this.applyComboDecay(nowMs)
      this.combo.count = Math.min(this.combo.count + 1, COMBO_CAP)
      this.combo.lastActionAtMs = nowMs
    },

    addGold(amount: number): void {
      if (!Number.isFinite(amount) || amount <= 0) return
      this.currencies.gold += amount
      this.currencies.totalGoldEarned += amount
      this.lifetime.lifetimeGoldEarned += amount
      this.touchSessionActivity()
    },

    /** Counts shop/stat upgrades toward lifetime wardrobe thresholds. */
    recordUpgradePurchase(): void {
      this.lifetime.totalUpgradesBought += 1
    },

    /** Stamps save time for offline progression (Phase 7.5). */
    touchSessionActivity(nowMs = Date.now()): void {
      this.lastActiveAtMs = nowMs
    },

    dismissOfflineGoldToast(): void {
      this.lastOfflineGoldGranted = 0
    },

    dismissWaveOutcome(): void {
      this.waveOutcomeReport = null
    },

    resetWaveCombatStats(): void {
      this.waveCombatStats = createEmptyWaveCombatStats()
    },

    /** Fails the wave when the boss timer elapses (GDD §3.2). */
    checkBossWaveTimeout(nowMs = Date.now()): void {
      if (this.wavePhase !== 'WAVE_ACTIVE') return
      if (!isBossWaveTimedOut(this.bossWaveDeadlineMs, nowMs)) return
      this.recordKingFailAttribution({ source: 'timeout' })
      this.failWave(nowMs)
    },

    /** JSON export for saves / future multiplayer sync (Phase 8.5). */
    exportGameStateJson(): string {
      return serializeGameState(readStoreState(this))
    },

    /** Minimal ghost army JSON for Arena database (Phase 8.8). */
    exportGhostArmyJson(nowMs = Date.now()): string {
      return serializeArmySnapshot(exportArmySnapshot(readStoreState(this), nowMs))
    },

    /** Hydrates player roster from a ghost snapshot JSON string. */
    importGhostArmy(json: string, nowMs = Date.now()): boolean {
      const pieces = importArmySnapshot(json, nowMs, this.globalSpeedMult)
      if (pieces.length === 0) return false
      this.playerPieces = pieces
      this.syncRoyalDecree()
      return true
    },

    /** Saves current army to local ghost database; returns record id. */
    saveGhostArmyToDatabase(label?: string): string | null {
      const snapshot = exportArmySnapshot(readStoreState(this))
      return saveGhostArmy(snapshot, label).id
    },

    /**
     * Persists an arena tactical loadout via ghost serialization (Phase 9).
     * Returns ghost record id when valid; null if king missing or over point cap.
     */
    saveArenaLoadout(pieces: ChessPiece[], label?: string): string | null {
      if (!canSaveArenaLoadout(pieces, ARENA_POINT_CAP)) return null
      const pc = calculateArmyPvPValue(pieces)
      const snapshot = exportArmySnapshotFromPieces(pieces, this.currentStage)
      const record = saveGhostArmy(
        snapshot,
        label ?? `Arena Loadout · ${pc} PC`,
      )
      return record.id
    },

    /** Equips an unlocked cosmetic from the wardrobe tab. */
    equipCosmetic(cosmeticId: string): boolean {
      const def = findCosmeticById(cosmeticId)
      if (!def || !isCosmeticUnlocked(def, this.lifetime)) return false

      if (def.category === 'board') {
        this.equippedCosmetics.boardThemeId = cosmeticId
      } else if (def.category === 'pieceSkin') {
        this.equippedCosmetics.pieceSkinId = cosmeticId
      } else {
        this.equippedCosmetics.shellBackgroundId = cosmeticId
      }
      playGameSfx('uiClick')
      return true
    },

    /** Toggles gradual aesthetic features (Themes tab). */
    setAestheticPreference<K extends keyof AestheticPreferences>(
      key: K,
      value: AestheticPreferences[K],
    ): void {
      this.aestheticPreferences[key] = value
      playGameSfx('uiClick')
    },

    /** CSS aura classes for a piece — O(1); not called from combat tick. */
    pieceAuraClassFor(piece: ChessPiece): string {
      if (
        !this.aestheticPreferences.gradualProgression ||
        !this.aestheticPreferences.pieceAuras
      ) {
        return ''
      }
      let tier = this.aestheticProgress.pieceAuraTier
      if (
        this.aestheticProgress.godTierUnlocked &&
        piece.side === 'player' &&
        piece.kind === 'king'
      ) {
        tier = Math.max(tier, MAX_PIECE_AURA_TIER)
      }
      return getPieceAuraClasses(piece.side, tier, piece.kind)
    },

    spendGold(amount: number): boolean {
      if (!Number.isFinite(amount) || amount <= 0) return true
      if (this.currencies.gold < amount) return false
      this.currencies.gold -= amount
      return true
    },

    addEloShards(amount: number): void {
      if (!Number.isFinite(amount) || amount <= 0) return
      this.currencies.eloShards += amount
    },

    spendEloShards(amount: number): boolean {
      if (!Number.isFinite(amount) || amount <= 0) return true
      if (this.currencies.eloShards < amount) return false
      this.currencies.eloShards -= amount
      return true
    },

    /** Recomputes prestige gold / speed / deploy slots from meta ranks. */
    applyMetaModifiers(): void {
      applyMetaModifiersToState(readStoreState(this))
    },

    purchaseMetaUpgrade(id: MetaUpgradeId): boolean {
      const rank = this.metaUpgrades[id] ?? 0
      const cost = getMetaUpgradeCost(id, rank)
      if (
        !canPurchaseMetaUpgrade(
          id,
          this.metaUpgrades,
          this.currencies.eloShards,
          this.metaTreeUnlocked,
        )
      ) {
        return false
      }
      if (!this.spendEloShards(cost)) return false
      this.metaUpgrades[id] = rank + 1
      this.applyMetaModifiers()
      playGameSfx('upgrade')
      return true
    },

    /**
     * Manual prestige reset (GDD §2.4): awards Elo, wipes run progress, keeps meta.
     */
    performPrestige(nowMs = Date.now()): boolean {
      if (!this.canPrestige) return false

      const eloEarned = projectPrestigeEloEarned(readStoreState(this))
      const retain = {
        eloShards: this.currencies.eloShards,
        trophies: this.currencies.trophies,
        metaUpgrades: { ...this.metaUpgrades },
        achievements: { ...this.achievements },
        hasPrestigedOnce: true,
        lifetime: { ...this.lifetime },
        equippedCosmetics: { ...this.equippedCosmetics },
        aestheticPreferences: { ...this.aestheticPreferences },
      }

      const next = buildPostPrestigeState(nowMs, retain, eloEarned)
      const mods = calculateMetaModifiers(next.metaUpgrades)

      next.playerPieces = deployGrandmasterBonusPawns(
        next.playerPieces,
        next.enemyPieces,
        mods.bonusPawnsOnReset,
        nowMs,
      )

      Object.assign(this.$state, next)
      this.syncMilestoneUnlocks()
      this.syncRoyalDecree()
      this.enterWavePrep(nowMs)
      playGameSfx('prestige')
      return true
    },

    /**
     * Background exhibition boards — runs in prep, combat, and clear (GDD §2.5).
     */
    /** Appends short-lived board VFX; pruned each combat tick. */
    pushCombatFeedback(
      events: ReturnType<typeof createCombatFeedback>[],
      nowMs = Date.now(),
    ): void {
      if (events.length === 0) return
      this.combatFeedbackEvents = [...this.combatFeedbackEvents, ...events]
      if (events.some((event) => event.kind === 'capture')) {
        this.screenShakeUntilMs = nowMs + SCREEN_SHAKE_MS
      }
      playCombatFeedbackAudio(events.map((event) => event.kind))
    },

    pruneCombatFeedback(nowMs = Date.now()): void {
      this.combatFeedbackEvents = pruneCombatFeedback(this.combatFeedbackEvents, nowMs)
    },

    tickExhibitions(nowMs = Date.now()): number {
      const mods = calculateMetaModifiers(this.metaUpgrades)
      if (mods.exhibitionRank <= 0) {
        this.exhibitionLastTickMs = nowMs
        return 0
      }

      const deltaSec = Math.max(0, (nowMs - this.exhibitionLastTickMs) / 1000)
      this.exhibitionLastTickMs = nowMs
      if (deltaSec <= 0) return 0

      const granted = tickExhibitionGold(
        mods.exhibitionRank,
        this.currentStage,
        this.playerPieces,
        this.prestigeGoldMult,
        this.globalSpeedMult,
        deltaSec,
      )
      if (granted > 0) {
        this.addGold(granted)
        this.exhibitionGoldEarned += granted
      }
      return granted
    },

    awardActionGold(options: AwardGoldOptions = {}): number {
      const nowMs = options.nowMs ?? Date.now()
      this.applyComboDecay(nowMs)

      if (options.incrementCombo) {
        this.incrementCombo(nowMs)
      }

      const activeMult = options.applyActiveMult
        ? calculateActiveMult(this.combo.count)
        : 1

      const raw = calculateGoldAction(
        this.currentStage,
        this.prestigeGoldMult,
        activeMult,
        this.friendlyActionsThisStage,
      )

      const studyMult = this.studyPackActive ? 1.25 : 1
      const streakMult = getPromotionStreakGoldMult(this.promotion.streak)
      const granted = raw * studyMult * streakMult

      this.addGold(granted)
      if (this.wavePhase === 'WAVE_ACTIVE') {
        this.waveCombatStats = accumulateWaveCombatStats(this.waveCombatStats, {
          goldFromActions: granted,
          friendlyActions: 1,
        })
      }
      this.friendlyActionsThisStage += 1
      return granted
    },

    /**
     * Applies GDD milestone unlocks for piece types, pawn slots, and deploy capacity.
     */
    syncMilestoneUnlocks(): void {
      this.unlockedSlots = resolveUnlockedSlotsFromMilestones(this.maxStageReached)
      this.deploySlots = applyDeploySlotMilestones(this.maxStageReached, this.deploySlots)
    },

    /**
     * Applies post-clear stage increment and opens prep for the next wave (GDD §1.8).
     */
    advanceStageAfterClear(nowMs = Date.now()): boolean {
      const carryPct = getEnPassantCarryPercent(this.enPassantEconomyRank)
      const carryIncrement = snapshotEnPassantCarry(this.playerPieces, carryPct, {})
      this.playerPieces = persistArmyPromotionsBetweenStages(
        this.playerPieces,
        carryIncrement,
      )
      this.enPassantCarryByPieceId = retainPromotionFormHints(carryIncrement)

      this.currentStage += 1
      if (this.currentStage > this.maxStageReached) {
        this.maxStageReached = this.currentStage
      }
      this.lifetime = bumpLifetimeStage(this.lifetime, this.maxStageReached)
      this.syncMilestoneUnlocks()
      this.prestigeAvailable = this.maxStageReached >= PRESTIGE_UNLOCK_STAGE
      this.friendlyActionsThisStage = 0
      this.promotion.streak = 0
      this.immortalGameUsedThisStage = false
      this.failCountThisStage = 0
      this.enemyHpScale = 1
      this.pendingPromotion = null
      this.manualPendingPieceId = null
      this.prepPendingPieceId = null
      this.waveCheckpointStage = getWaveCheckpointStage(this.maxStageReached)
      this.lastFailRewindToStage = null
      this.enterWavePrep(nowMs)
      return true
    },

    /** @deprecated Legacy saves — normal clears skip WAVE_COMPLETE. */
    advanceStage(nowMs = Date.now()): boolean {
      if (this.wavePhase !== 'WAVE_COMPLETE') return false
      this.waveCompleteAtMs = null
      return this.advanceStageAfterClear(nowMs)
    },

    /** Safe room between waves — heal, clear board, stop combat timers. */
    enterWavePrep(nowMs = Date.now()): void {
      this.wavePhase = 'WAVE_PREP'
      this.manualPendingPieceId = null
      this.prepPendingPieceId = null
      this.pendingPromotion = null
      this.stopCombatLoop()
      this.enemyPieces = []
      this.bossCombat = null
      this.bossWaveDeadlineMs = null
      this.playerPieces = restorePlayerKingForPrep(
        this.playerPieces,
        nowMs,
        this.globalSpeedMult,
      )
      this.playerPieces = healPlayerPiecesForPrep(this.playerPieces)
      this.playerPieces = relocateArmyToPrepRanks(
        this.playerPieces,
        this.enemyPieces,
      )
      this.playerPieces = bootstrapPiecesForCombat(
        this.playerPieces,
        nowMs,
        this.globalSpeedMult,
      )
      this.runSupporterAutoShopIfEnabled()
    },

    /** Supporter QoL — best ROI shop buy in prep only (no combat stat changes). */
    runSupporterAutoShopIfEnabled(): void {
      const pinia = getActivePinia()
      if (!pinia) return
      const meta = useMetaStore(pinia)
      if (!shouldRunAutoShopAssistant(meta.convenienceFlags, this.wavePhase)) {
        return
      }
      this.purchaseBestRoiUpgrade()
    },

    /**
     * Transitions WAVE_PREP → WAVE_ACTIVE and spawns the stage enemy set (GDD §3.1).
     */
    startWave(nowMs = Date.now()): boolean {
      if (this.wavePhase !== 'WAVE_PREP') return false
      this.waveOutcomeReport = null
      this.resetWaveCombatStats()
      this.lastWaveFailReason = null
      this.lastKingFailDetail = null
      this.lastKingFailAttribution = null
      this.lastFailRewindToStage = null
      this.lastPawnLeakDamage = 0
      this.wavePhase = 'WAVE_ACTIVE'
      this.waveCompleteAtMs = null
      this.manualPendingPieceId = null
      this.prepPendingPieceId = null
      this.stageStartedAtMs = nowMs
      this.combatActionsSinceEnemyKill = 0
      this.playerPieces = bootstrapPiecesForCombat(
        this.playerPieces,
        nowMs,
        this.globalSpeedMult,
      )
      this.enemyPieces = spawnEnemiesForStage(
        this.currentStage,
        nowMs,
        this.enemyHpScale,
        this.playerPieces,
      )
      this.bossCombat = createBossCombatRuntime(this.currentStage, this.enemyPieces)
      const bossLimit = getBossWaveLimitMs(this.currentStage, this.metaUpgrades)
      this.bossWaveDeadlineMs = bossLimit > 0 ? nowMs + bossLimit : null
      this.lastPawnLeakDamage = 0
      this.clickCombatReadyAtMs = nowMs
      this.combatFocus = this.autoMode ? 'strike' : 'move'
      this.startCombatLoop(nowMs)
      return true
    },

    /**
     * Awards clear rewards, advances stage, and opens prep in one step (no extra "Next Wave" click).
     */
    completeWave(nowMs = Date.now()): void {
      if (this.wavePhase !== 'WAVE_ACTIVE') return
      this.manualPendingPieceId = null
      this.prepPendingPieceId = null
      this.stopCombatLoop()

      const clearedStage = this.currentStage
      const clearGold =
        calculateGoldClear(
          clearedStage,
          this.playerPieces.filter((p) => p.side === 'player').length,
        ) * getBossWaveClearMultiplier(clearedStage)
      this.waveCombatStats = accumulateWaveCombatStats(this.waveCombatStats, {
        goldFromClear: clearGold,
      })
      this.addGold(clearGold)
      this.incrementCombo(nowMs)

      const trophy = evaluateBossTrophyAward(clearedStage, this.bossTrophiesClaimed)
      if (trophy) {
        this.bossTrophiesClaimed = [...this.bossTrophiesClaimed, trophy.stage]
        this.currencies.trophies += 1
        this.lastTrophyEarned = trophy.trophyName
      }
      const statsSnapshot = { ...this.waveCombatStats }
      this.bossCombat = null
      playGameSfx('waveClear')

      this.advanceStageAfterClear(nowMs)
      this.waveOutcomeReport = buildVictoryReport({
        foughtStage: clearedStage,
        nextStage: this.currentStage,
        stats: statsSnapshot,
        trophyName: trophy?.trophyName ?? null,
        checkpointStage: this.waveCheckpointStage,
      })
      this.waveCompleteAtMs = nowMs
    },

    /**
     * King eliminated — return to prep with softer enemy HP (GDD §1.8 fail state).
     */
    failWave(nowMs = Date.now()): void {
      if (this.wavePhase !== 'WAVE_ACTIVE') return
      const foughtStage = this.currentStage
      const statsSnapshot = { ...this.waveCombatStats }
      const resolution = resolveStageAfterFail(this.currentStage, this.maxStageReached)
      this.waveCheckpointStage = resolution.checkpoint
      this.waveCompleteAtMs = null

      if (resolution.rewound) {
        this.currentStage = resolution.nextStage
        this.failCountThisStage = 0
        this.enemyHpScale = 1
        this.lastFailRewindToStage = resolution.nextStage
      } else {
        this.failCountThisStage += 1
        this.enemyHpScale = applyFailEnemyHpScale(this.enemyHpScale)
        this.lastFailRewindToStage = null
      }
      const kingFail = getKingFailReason(this.playerPieces)
      this.lastWaveFailReason = 'king-fallen'
      this.lastKingFailDetail =
        kingFail === 'missing' || kingFail === 'defeated' ? kingFail : 'defeated'
      if (!this.lastKingFailAttribution) {
        this.lastKingFailAttribution =
          kingFail === 'missing'
            ? { source: 'capture' }
            : { source: 'damage' }
      }
      this.manualPendingPieceId = null
      this.pendingPromotion = null
      this.stopCombatLoop()
      playGameSfx('fail')
      this.screenShakeUntilMs = nowMs + SCREEN_SHAKE_MS

      const kingFailMsg =
        this.lastKingFailDetail === 'missing'
          ? 'Your King was captured.'
          : 'Your King was defeated.'
      const rewindMsg =
        this.lastFailRewindToStage !== null
          ? ` Returned to milestone wave ${this.lastFailRewindToStage}.`
          : ''
      const softMsg =
        this.failCountThisStage > 0
          ? ` Enemies at ${Math.round(this.enemyHpScale * 100)}% HP this stage.`
          : ''

      this.waveOutcomeReport = buildDefeatReport({
        foughtStage,
        nextStage: this.currentStage,
        stats: statsSnapshot,
        failRewindToStage: this.lastFailRewindToStage,
        checkpointStage: this.waveCheckpointStage,
        failCountThisStage: this.failCountThisStage,
        enemyHpScale: this.enemyHpScale,
        kingFallMessage: `${kingFailMsg}${rewindMsg}${softMsg} Position your army and start again.`,
        kingFallTelegraph: formatKingFailTelegraph(
          this.lastKingFailAttribution,
          this.lastKingFailDetail,
          this.lastPawnLeakDamage,
        ),
      })

      this.enterWavePrep(nowMs)
    },

    /** Legacy alias — clears now advance automatically; only migrates old WAVE_COMPLETE saves. */
    proceedToNextWave(nowMs = Date.now()): boolean {
      if (this.wavePhase === 'WAVE_COMPLETE') {
        return this.advanceStage(nowMs)
      }
      return this.isWavePrep
    },

    setAutoAdvanceWavesEnabled(enabled: boolean): void {
      if (!this.autoAdvanceWavesPurchased) return
      this.autoAdvanceWavesEnabled = enabled
      if (!enabled) {
        this.waveCompleteAtMs = null
      }
    },

    setAutoStartWavesEnabled(enabled: boolean): void {
      if (!this.autoAdvanceWavesPurchased) return
      this.autoStartWavesEnabled = enabled
    },

    /**
     * Idle loop helper — auto-proceeds / auto-starts waves after clear delay (Phase 5).
     */
    tickWaveAutomation(nowMs = Date.now()): void {
      const tick = evaluateAutoAdvanceTick({
        wavePhase: this.wavePhase,
        purchased: this.autoAdvanceWavesPurchased,
        enabled: this.autoAdvanceWavesEnabled,
        waveCompleteAtMs: this.waveCompleteAtMs,
        nowMs,
        autoStartNextWave: this.autoStartWavesEnabled,
      })

      this.waveCompleteAtMs = tick.waveCompleteAtMs

      if (tick.shouldStartWave && this.wavePhase === 'WAVE_PREP') {
        this.startWave(nowMs)
      }
    },

    /**
     * Tracks idle combat pacing and forfeits the wave if enemies are not eliminated.
     */
    syncCombatPacingAfterAction(
      enemiesBefore: ChessPiece[],
      nowMs = Date.now(),
    ): void {
      if (this.wavePhase !== 'WAVE_ACTIVE') return

      this.combatActionsSinceEnemyKill = nextCombatActionsSinceEnemyKill(
        this.combatActionsSinceEnemyKill,
        enemiesBefore,
        this.enemyPieces,
      )

      if (
        shouldFailWaveForCombatStall({
          livingEnemies: countLivingEnemies(this.enemyPieces),
          combatActionsSinceEnemyKill: this.combatActionsSinceEnemyKill,
          stageStartedAtMs: this.stageStartedAtMs,
          nowMs,
          isBossStage: isBossStage(this.currentStage),
          hasBossDeadline: this.bossWaveDeadlineMs !== null,
        })
      ) {
        if (!this.lastKingFailAttribution) {
          this.recordKingFailAttribution({ source: 'stall' })
        }
        this.failWave(nowMs)
      }
    },

    /** Evaluates win/lose after board mutations during combat. */
    evaluateWaveOutcome(): void {
      if (this.wavePhase !== 'WAVE_ACTIVE') return
      if (isWaveFailed(this.playerPieces)) {
        this.failWave()
        return
      }
      if (isWaveCleared(this.enemyPieces)) {
        this.completeWave()
      }
    },

    deployPlayerPiece(piece: ChessPiece, nowMs = Date.now()): void {
      const bootstrapped = bootstrapPieceInitiative(piece, nowMs, this.globalSpeedMult)
      this.playerPieces = [...this.playerPieces, bootstrapped]
      this.royalDecree = reduceRoyalDecree(this.royalDecree, {
        type: 'PLAYER_PIECE_DEPLOYED',
        playerPieces: this.playerPieces,
      })
    },

    deployPawn(file: number, rank: number, id?: string, nowMs = Date.now()): ChessPiece {
      const pawnId = id ?? createShopPieceId('pawn', this.playerPieces)
      const pawn = createPiece(pawnId, 'pawn', 'player', { file, rank })
      this.deployPlayerPiece(pawn, nowMs)
      return pawn
    },

    /**
     * Purchases a piece from the shop and auto-deploys on ranks 0–1 (WAVE_PREP only).
     */
    purchasePieceFromShop(kind: PieceKind, nowMs = Date.now()): boolean {
      const offer = this.pieceShopOffers.find((o) => o.kind === kind)
      if (!offer?.purchasable) return false
      if (!this.spendGold(offer.cost)) return false

      const square = findDeploySquare(this.playerPieces, this.enemyPieces, kind)
      if (!square) {
        this.addGold(offer.cost)
        return false
      }

      const piece = createPiece(createShopPieceId(kind, this.playerPieces), kind, 'player', square)
      this.deployPlayerPiece(piece, nowMs)
      this.recordUpgradePurchase()
      playGameSfx('upgrade')
      return true
    },

    /** Expands maximum army size (GDD §2.3 board slot track). */
    purchaseBoardSlot(_nowMs = Date.now()): boolean {
      const offer = this.pieceShopOffers.find((o) => o.id === 'shop:boardSlot')
      if (!offer?.purchasable || this.deploySlots >= MAX_DEPLOY_SLOTS) return false
      if (!this.spendGold(offer.cost)) return false
      this.deploySlots += 1
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
      this.playerPieces = this.playerPieces.filter((piece) => piece.id !== pieceId)
      const { [pieceId]: _removed, ...restCarry } = this.enPassantCarryByPieceId
      this.enPassantCarryByPieceId = restCarry
      this.enPassantCarryByPieceId = pruneEnPassantCarry(
        this.enPassantCarryByPieceId,
        this.playerPieces,
      )
      this.royalDecree = reduceRoyalDecree(this.royalDecree, {
        type: 'PLAYER_PIECE_REMOVED',
        playerPieces: this.playerPieces,
      })
    },

    syncRoyalDecree(): void {
      this.royalDecree = reduceRoyalDecree(this.royalDecree, {
        type: 'FORCE_SYNC',
        playerPieces: this.playerPieces,
      })
    },

    setAutoMode(enabled: boolean): void {
      this.autoMode = enabled
      if (enabled) {
        this.manualPendingPieceId = null
        if (this.wavePhase === 'WAVE_ACTIVE') {
          this.combatFocus = 'strike'
        }
      }
    },

    setCombatFocus(focus: CombatFocus): boolean {
      if (this.wavePhase !== 'WAVE_ACTIVE') return false
      if (focus === 'move' && this.autoMode) return false
      if (focus === 'move' && !this.manualPendingPieceId) return false
      this.combatFocus = focus
      playGameSfx('uiClick')
      return true
    },

    setAutoPlay(enabled: boolean): void {
      this.setAutoMode(enabled)
    },

    setAutoAiPersonality(personality: AutoAiPersonality): void {
      this.autoAiPersonality = personality
    },

    /**
     * Ends the active manual turn when the piece has no legal moves (pass).
     */
    skipManualTurn(nowMs = Date.now()): boolean {
      if (this.autoMode || this.wavePhase !== 'WAVE_ACTIVE') return false
      const pieceId = this.manualPendingPieceId
      if (!pieceId) return false

      const index = this.playerPieces.findIndex((piece) => piece.id === pieceId)
      if (index === -1) return false

      this.playerPieces[index] = scheduleNextAction(
        this.playerPieces[index]!,
        nowMs,
        this.globalSpeedMult,
      )
      this.manualPendingPieceId = null
      this.lastSimulatedMs = nowMs
      this.playerPieces = syncInitiativeProgress(
        this.playerPieces,
        nowMs,
        this.globalSpeedMult,
      )
      this.syncCombatPacingAfterAction([...this.enemyPieces], nowMs)
      if (this.wavePhase !== 'WAVE_ACTIVE') return true
      this.evaluateWaveOutcome()
      playGameSfx('uiClick')
      return true
    },

    /** @internal Assigns manual turn or auto-skips when no legal moves exist. */
    beginManualPlayerTurn(pieceId: string, nowMs = Date.now()): void {
      const piece = this.playerPieces.find((p) => p.id === pieceId)
      if (!piece) return

      const decreeMods = getRoyalDecreeModifiers(this.royalDecree)
      const moves = generateLegalMoves(piece, {
        allPieces: getAllPieces(this.playerPieces, this.enemyPieces),
        decreeStepEnabled: decreeMods.decreeStepEnabled,
      })

      if (moves.length === 0) {
        const index = this.playerPieces.findIndex((p) => p.id === pieceId)
        if (index !== -1) {
          this.playerPieces[index] = scheduleNextAction(
            this.playerPieces[index]!,
            nowMs,
            this.globalSpeedMult,
          )
        }
        this.manualPendingPieceId = null
        this.lastSimulatedMs = nowMs
        this.syncCombatPacingAfterAction([...this.enemyPieces], nowMs)
        if (this.wavePhase !== 'WAVE_ACTIVE') return
        this.evaluateWaveOutcome()
        return
      }

      this.manualPendingPieceId = pieceId
      this.combatFocus = 'move'
    },

    /** Selects the active player piece for manual input (must be their turn). */
    selectManualPiece(pieceId: string, nowMs = Date.now()): boolean {
      if (this.autoMode || this.wavePhase !== 'WAVE_ACTIVE') return false
      const actor = getNextReadyActor(this.playerPieces, this.enemyPieces, nowMs)
      if (!actor || actor.side !== 'player' || actor.id !== pieceId) return false
      this.manualPendingPieceId = pieceId
      this.combatFocus = 'move'
      return true
    },

    /** Reschedules one enemy after its turn resolves (manual + auto interleaved). */
    scheduleEnemyAfterAction(pieceId: string, nowMs = Date.now()): void {
      const index = this.enemyPieces.findIndex((piece) => piece.id === pieceId)
      if (index === -1) return
      this.enemyPieces[index] = scheduleNextAction(
        this.enemyPieces[index]!,
        nowMs,
        this.globalSpeedMult,
      )
    },

    /** Reschedules one friendly piece after an auto-mode action. */
    schedulePlayerAfterAction(pieceId: string, nowMs = Date.now()): void {
      const index = this.playerPieces.findIndex((piece) => piece.id === pieceId)
      if (index === -1) return
      this.playerPieces[index] = scheduleNextAction(
        this.playerPieces[index]!,
        nowMs,
        this.globalSpeedMult,
      )
    },

    /**
     * Records why the King was lost before `evaluateWaveOutcome` calls `failWave`.
     */
    recordKingFailAttribution(
      attribution: import('@/types/game').KingFailAttribution,
    ): void {
      this.lastKingFailAttribution = attribution
    },

    /** Selects a friendly piece to reposition on deploy ranks between waves. */
    selectPrepPiece(pieceId: string): boolean {
      if (this.wavePhase !== 'WAVE_PREP') return false
      const piece = this.playerPieces.find((p) => p.id === pieceId)
      if (!piece || piece.side !== 'player') return false
      const moves = generatePrepRepositionMoves(piece, this.playerPieces, this.enemyPieces)
      if (moves.length === 0) return false
      this.prepPendingPieceId = pieceId
      return true
    },

    /** Moves a prep-selected piece to an empty deploy-rank square. */
    executePrepMove(move: BoardMove): boolean {
      if (this.wavePhase !== 'WAVE_PREP' || !this.prepPendingPieceId) return false
      if (move.pieceId !== this.prepPendingPieceId) return false

      const legal = this.prepLegalMoves.some(
        (m) => m.to.file === move.to.file && m.to.rank === move.to.rank,
      )
      if (!legal) return false

      const index = this.playerPieces.findIndex((p) => p.id === move.pieceId)
      if (index === -1) return false

      this.playerPieces[index] = {
        ...this.playerPieces[index]!,
        position: { ...move.to },
      }
      this.prepPendingPieceId = null
      playGameSfx('uiClick')
      return true
    },

    startCombatLoop(nowMs = Date.now()): void {
      this.combatLoopRunning = true
      this.lastSimulatedMs = nowMs
      this.playerPieces = bootstrapPiecesForCombat(
        this.playerPieces,
        nowMs,
        this.globalSpeedMult,
      )
    },

    stopCombatLoop(): void {
      this.combatLoopRunning = false
    },

    /**
     * Resolves back-rank promotion for a pawn (GDD §1.3).
     * Returns fanfare gold granted; sets pendingPromotion in manual mode.
     */
    processPromotionForPiece(pieceId: string, chosenForm?: SuperPromotionForm): number {
      const piece = this.playerPieces.find((p) => p.id === pieceId)
      if (!piece) return 0

      const pipeline = runPromotionPipeline(
        piece,
        buildPromotionContext(readStoreState(this)),
        this.enemyPieces,
        this.promotion.streak,
        chosenForm,
        this.enPassantCarryByPieceId[pieceId],
      )

      this.playerPieces = updatePlayerPiece(this.playerPieces, pieceId, pipeline.piece)

      if (pipeline.pendingPlayerChoice) {
        this.pendingPromotion = {
          pieceId,
          availableForms: getAvailablePromotionForms(this.currentStage),
        }
        this.stopCombatLoop()
        return 0
      }

      if (pipeline.fanfareGold > 0) {
        if (this.wavePhase === 'WAVE_ACTIVE') {
          this.waveCombatStats = accumulateWaveCombatStats(this.waveCombatStats, {
            goldFromPromotion: pipeline.fanfareGold,
          })
        }
        this.addGold(pipeline.fanfareGold)
        playGameSfx('promotion')
      }
      this.promotion.streak = pipeline.nextStreak
      this.pendingPromotion = null
      return pipeline.fanfareGold
    },

    /** Player selects super-form from promotion modal (active mode). */
    choosePromotionForm(form: SuperPromotionForm, nowMs = Date.now()): void {
      if (!this.pendingPromotion) return
      this.processPromotionForPiece(this.pendingPromotion.pieceId, form)
      playGameSfx('promotion')
      this.startCombatLoop(nowMs)
    },

    dismissPendingPromotion(): void {
      this.pendingPromotion = null
      this.startCombatLoop()
    },

    /**
     * Executes a player-chosen legal move in manual mode (GDD §1.4 hybrid loop).
     */
    executePlayerManualMove(move: BoardMove, nowMs = Date.now()): number {
      if (this.wavePhase !== 'WAVE_ACTIVE' || this.autoMode) return 0
      if (this.manualPendingPieceId !== move.pieceId) return 0

      const legal = this.manualLegalMoves
      const isLegal = legal.some(
        (m) => m.to.file === move.to.file && m.to.rank === move.to.rank && m.pieceId === move.pieceId,
      )
      if (!isLegal) return 0

      const gold = this.resolvePlayerMove(move, nowMs)
      const index = this.playerPieces.findIndex((p) => p.id === move.pieceId)
      if (index !== -1) {
        this.playerPieces[index] = scheduleNextAction(
          this.playerPieces[index]!,
          nowMs,
          this.globalSpeedMult,
        )
      }
      this.manualPendingPieceId = null
      this.lastSimulatedMs = nowMs
      this.playerPieces = syncInitiativeProgress(
        this.playerPieces,
        nowMs,
        this.globalSpeedMult,
      )
      this.evaluateWaveOutcome()
      return gold
    },

    /**
     * Shared combat resolution for auto and manual move execution.
     */
    resolvePlayerMove(move: BoardMove, nowMs = Date.now()): number {
      const piece = this.playerPieces.find((p) => p.id === move.pieceId)
      if (!piece) return 0

      const enemiesBefore = [...this.enemyPieces]

      const decreeMods = getRoyalDecreeModifiers(this.royalDecree)
      const kingMult =
        piece.kind === 'king' && this.royalDecree.isActive ? decreeMods.kingAttackMult : 1
      const apMult = kingMult * getRevivalFlashApMult(piece)
      const bossRuntime = this.bossCombat
      const combat = resolveCombatMove(move, this.playerPieces, this.enemyPieces, {
        stage: this.currentStage,
        activeMult: calculateActiveMult(this.combo.count),
        royalDecreeActive: this.royalDecree.isActive,
        attackerApMult: apMult,
        adjustDamage: bossRuntime
          ? (raw, defender) =>
              applyBossDamageReduction(
                raw,
                {
                  identity: bossRuntime.identity,
                  attackerKind: piece.kind,
                  attackerSide: 'player',
                  defender,
                  moveFrom: move.from,
                  moveTo: move.to,
                },
                bossRuntime,
              )
          : undefined,
      })
      this.playerPieces = combat.playerPieces
      this.enemyPieces = combat.enemyPieces
      this.pushCombatFeedback(feedbackFromCombatMove(move, combat, nowMs), nowMs)

      if (combat.damageDealt > 0) {
        this.waveCombatStats = accumulateWaveCombatStats(this.waveCombatStats, {
          damageDealt: combat.damageDealt,
        })
      }
      if (combat.captured) {
        this.waveCombatStats = accumulateWaveCombatStats(this.waveCombatStats, {
          captures: 1,
        })
      }

      if (bossRuntime && combat.damageDealt > 0) {
        const defender = this.enemyPieces.find(
          (p) => p.id === move.capturedPieceId,
        ) ?? this.enemyPieces.find(
          (p) => coordKey(p.position) === coordKey(move.to),
        )
        if (defender) {
          const reflect = calculateIronRookReflectDamage(
            combat.damageDealt,
            {
              identity: bossRuntime.identity,
              attackerKind: piece.kind,
              attackerSide: 'player',
              defender,
              moveFrom: move.from,
              moveTo: move.to,
            },
            bossRuntime,
          )
          if (reflect > 0) {
            this.playerPieces = applyKingReflectDamage(this.playerPieces, reflect)
            this.waveCombatStats = accumulateWaveCombatStats(this.waveCombatStats, {
              damageTaken: reflect,
            })
          }
        }
      }

      const actorIndex = this.playerPieces.findIndex((p) => p.id === move.pieceId)
      if (actorIndex !== -1) {
        this.playerPieces[actorIndex] = consumeRevivalFlashAction(this.playerPieces[actorIndex]!)
      }

      let captureGold = 0
      if (combat.captureGold > 0) {
        this.waveCombatStats = accumulateWaveCombatStats(this.waveCombatStats, {
          goldFromCaptures: combat.captureGold,
        })
        this.addGold(combat.captureGold)
        captureGold += combat.captureGold
        this.incrementCombo(nowMs)
      }

      const actingPiece = this.playerPieces.find((p) => p.id === move.pieceId)
      if (actingPiece) {
        captureGold += this.processPromotionForPiece(move.pieceId)
      }

      if (this.pendingPromotion) {
        this.syncCombatPacingAfterAction(enemiesBefore, nowMs)
        if (this.wavePhase !== 'WAVE_ACTIVE') return captureGold
        this.evaluateWaveOutcome()
        return captureGold
      }

      const actionGold = this.awardActionGold({
        applyActiveMult: !this.autoMode,
        incrementCombo: !this.autoMode,
        nowMs,
      })
      if (actionGold > 0) {
        this.pushCombatFeedback(
          [createCombatFeedback('gold', move.to, nowMs, Math.round(actionGold))],
          nowMs,
        )
      }
      captureGold += actionGold
      this.syncCombatPacingAfterAction(enemiesBefore, nowMs)
      if (this.wavePhase !== 'WAVE_ACTIVE') return captureGold
      this.evaluateWaveOutcome()
      return captureGold
    },

    /**
     * Resolves an enemy move against the player roster (no gold awarded).
     */
    resolveEnemyMove(move: BoardMove, nowMs = Date.now()): void {
      const enemiesBefore = [...this.enemyPieces]
      const playerBefore = this.playerPieces
      const defender =
        move.capturedPieceId && move.side === 'enemy'
          ? playerBefore.find((p) => p.id === move.capturedPieceId)
          : undefined
      const combat = resolveCombatMove(move, this.playerPieces, this.enemyPieces, {
        stage: this.currentStage,
        activeMult: 1,
        royalDecreeActive: false,
        defenderInvulnerable: defender ? isPieceInvulnerable(defender, nowMs) : false,
      })
      this.enemyPieces = combat.enemyPieces
      this.pushCombatFeedback(feedbackFromCombatMove(move, combat, nowMs), nowMs)

      if (combat.damageDealt > 0 && defender?.side === 'player') {
        this.waveCombatStats = accumulateWaveCombatStats(this.waveCombatStats, {
          damageTaken: combat.damageDealt,
        })
      }

      if (combat.captured && move.capturedPieceId && move.side === 'enemy') {
        const meta = calculateMetaModifiers(this.metaUpgrades)
        const revived = tryImmortalRevive(
          playerBefore,
          combat.playerPieces,
          move.capturedPieceId,
          meta.hasImmortalGame,
          this.immortalGameUsedThisStage,
          nowMs,
        )
        this.playerPieces = revived.pieces
        if (revived.used) {
          this.immortalGameUsedThisStage = true
        }
      } else {
        this.playerPieces = combat.playerPieces
      }

      const attacker = this.enemyPieces.find((p) => p.id === move.pieceId)
      const kingBefore = playerBefore.find((p) => p.side === 'player' && p.kind === 'king')
      const kingAfter = this.playerPieces.find((p) => p.side === 'player' && p.kind === 'king')
      if (kingBefore) {
        const capturedKing =
          !kingAfter || move.capturedPieceId === kingBefore.id
        const defeatedByDamage =
          !!kingAfter && kingAfter.stats.hp <= 0 && move.capturedPieceId !== kingBefore.id
        const attr = attributionFromEnemyMove(
          move,
          attacker,
          capturedKing,
          defeatedByDamage,
        )
        if (attr) this.recordKingFailAttribution(attr)
      }

      this.processEnemyPawnLeaks()
      this.applyComboDecay(nowMs)
      this.syncCombatPacingAfterAction(enemiesBefore, nowMs)
      if (this.wavePhase !== 'WAVE_ACTIVE') return
      this.evaluateWaveOutcome()
    },

    /** Enemy pawn leak — direct King damage when a pawn reaches rank 0 (GDD Phase 5). */
    processEnemyPawnLeaks(): void {
      const leak = resolveEnemyPawnLeaks(
        this.playerPieces,
        this.enemyPieces,
        this.currentStage,
      )
      if (leak.totalDamage <= 0) return
      this.playerPieces = leak.playerPieces
      this.enemyPieces = leak.enemyPieces
      this.lastPawnLeakDamage = leak.totalDamage
      this.waveCombatStats = accumulateWaveCombatStats(this.waveCombatStats, {
        damageTaken: leak.totalDamage,
      })
      const king = this.playerPieces.find((p) => p.kind === 'king')
      if (king) {
        this.pushCombatFeedback(
          [
            createCombatFeedback(
              'leak',
              king.position,
              Date.now(),
              leak.totalDamage,
            ),
          ],
        )
        this.screenShakeUntilMs = Date.now() + SCREEN_SHAKE_MS
      }
      if (isWaveFailed(this.playerPieces)) {
        this.recordKingFailAttribution({
          source: 'leak',
          leakDamage: leak.totalDamage,
        })
      }
      this.evaluateWaveOutcome()
    },

    /** Runs signature boss scripts after an enemy action resolves. */
    tickBossAfterEnemyAction(actedEnemyId: string, nowMs = Date.now()): void {
      if (!this.bossCombat) return
      const result = tickBossMechanics(
        this.bossCombat,
        this.currentStage,
        this.playerPieces,
        this.enemyPieces,
        actedEnemyId,
        nowMs,
        this.globalSpeedMult,
      )
      this.bossCombat = result.runtime
      this.playerPieces = result.playerPieces
      this.enemyPieces = result.enemyPieces
      this.evaluateWaveOutcome()
    },

    /**
     * Enemy initiative action — heuristic move + combat resolution.
     */
    executeEnemyMove(pieceId: string, nowMs = Date.now()): boolean {
      const piece = this.enemyPieces.find((p) => p.id === pieceId)
      if (!piece) return false

      const allPieces = getAllPieces(this.playerPieces, this.enemyPieces)
      const move = getEnemyMoveHeuristic(piece, {
        allPieces,
        decreeStepEnabled: false,
        movingPiece: piece,
      })

      if (move) {
        this.resolveEnemyMove(move, nowMs)
        if (this.wavePhase === 'WAVE_ACTIVE') {
          this.tickBossAfterEnemyAction(pieceId, nowMs)
        }
      }
      return move !== null
    },

    /**
     * Processes all ready enemies: sync timers, act, reschedule (GDD §1.5).
     */
    tickEnemyInitiative(nowMs = Date.now()): string[] {
      const result = processReadyInitiativeActions(
        this.enemyPieces,
        nowMs,
        this.globalSpeedMult,
      )
      this.enemyPieces = result.pieces

      const actedIds: string[] = []
      for (const pieceId of result.actedPieceIds) {
        if (this.executeEnemyMove(pieceId, nowMs)) {
          actedIds.push(pieceId)
        }
        if (this.wavePhase !== 'WAVE_ACTIVE') break
      }

      this.enemyPieces = syncInitiativeProgress(
        this.enemyPieces,
        nowMs,
        this.globalSpeedMult,
      )
      return actedIds
    },

    /**
     * Runs AI move selection + combat resolution for one player piece (GDD §1.6).
     */
    executePlayerAutoMove(pieceId: string, nowMs = Date.now()): number {
      const piece = this.playerPieces.find((p) => p.id === pieceId)
      if (!piece) return 0

      const allPieces = getAllPieces(this.playerPieces, this.enemyPieces)
      const decreeMods = getRoyalDecreeModifiers(this.royalDecree)
      const meta = calculateMetaModifiers(this.metaUpgrades)
      const move = selectBestMove(piece, {
        allPieces,
        decreeStepEnabled: decreeMods.decreeStepEnabled,
        royalDecreeActive: this.royalDecree.isActive,
        personality: this.autoAiPersonality,
        movingPiece: piece,
        aiScoreMult: meta.aiScoreMult,
      })

      let captureGold = 0

      if (move) {
        captureGold += this.resolvePlayerMove(move, nowMs)
      }

      if (this.pendingPromotion) {
        return captureGold
      }

      return captureGold
    },

    tickCombat(nowMs = Date.now()): CombatTickResult {
      const empty: CombatTickResult = {
        actedCount: 0,
        enemyActedCount: 0,
        goldEarned: 0,
        actedPieceIds: [],
        enemyActedPieceIds: [],
      }

      if (!this.combatLoopRunning || this.wavePhase !== 'WAVE_ACTIVE') {
        return empty
      }

      if (this.pendingPromotion) {
        return empty
      }

      this.checkBossWaveTimeout(nowMs)
      if (this.wavePhase !== 'WAVE_ACTIVE') {
        return empty
      }

      if (
        shouldFailWaveForCombatStall({
          livingEnemies: countLivingEnemies(this.enemyPieces),
          combatActionsSinceEnemyKill: this.combatActionsSinceEnemyKill,
          stageStartedAtMs: this.stageStartedAtMs,
          nowMs,
          isBossStage: isBossStage(this.currentStage),
          hasBossDeadline: this.bossWaveDeadlineMs !== null,
        })
      ) {
        if (!this.lastKingFailAttribution) {
          this.recordKingFailAttribution({ source: 'stall' })
        }
        this.failWave(nowMs)
        return empty
      }

      const playerSpeed = this.effectivePlayerSpeedMult

      const combatTimePaused =
        !this.autoMode && this.manualPendingPieceId !== null

      if (!combatTimePaused) {
        const deltaSec = Math.max(0, (nowMs - this.lastSimulatedMs) / 1000)
        if (deltaSec > 0) {
          this.regenStamina(deltaSec)
        }
        this.lastSimulatedMs = nowMs
      }

      this.applyComboDecay(nowMs)
      this.pruneCombatFeedback(nowMs)

      let actedPieceIds: string[] = []
      let goldEarned = 0

      if (this.autoMode) {
        this.touchSessionActivity(nowMs)
        this.playerPieces = syncInitiativeProgress(
          this.playerPieces,
          nowMs,
          playerSpeed,
        )
        this.enemyPieces = syncInitiativeProgress(
          this.enemyPieces,
          nowMs,
          this.globalSpeedMult,
        )

        const actor = getNextReadyActor(this.playerPieces, this.enemyPieces, nowMs)
        let enemyActedPieceIds: string[] = []

        if (actor?.side === 'enemy') {
          if (this.executeEnemyMove(actor.id, nowMs)) {
            enemyActedPieceIds = [actor.id]
          }
          this.scheduleEnemyAfterAction(actor.id, nowMs)
          this.enemyPieces = syncInitiativeProgress(
            this.enemyPieces,
            nowMs,
            this.globalSpeedMult,
          )
        } else if (actor?.side === 'player') {
          goldEarned += this.executePlayerAutoMove(actor.id, nowMs)
          this.schedulePlayerAfterAction(actor.id, nowMs)
          this.playerPieces = syncInitiativeProgress(
            this.playerPieces,
            nowMs,
            playerSpeed,
          )
          actedPieceIds = [actor.id]
        }

        this.evaluateWaveOutcome()

        return {
          actedCount: actedPieceIds.length,
          enemyActedCount: enemyActedPieceIds.length,
          goldEarned,
          actedPieceIds,
          enemyActedPieceIds,
        }
      }

      /** Manual = strict turn-based: one global actor per tick (GDD §1.4). */
      const combatNow = getCombatTimeMs({
        autoMode: this.autoMode,
        manualPendingPieceId: this.manualPendingPieceId,
        lastSimulatedMs: this.lastSimulatedMs,
        nowMs,
      })
      this.playerPieces = syncInitiativeProgress(
        this.playerPieces,
        combatNow,
        playerSpeed,
      )
      this.enemyPieces = syncInitiativeProgress(
        this.enemyPieces,
        combatNow,
        this.globalSpeedMult,
      )

      if (this.manualPendingPieceId) {
        return empty
      }

      const actor = getNextReadyActor(this.playerPieces, this.enemyPieces, nowMs)
      let enemyActedPieceIds: string[] = []

      if (actor?.side === 'enemy') {
        if (this.executeEnemyMove(actor.id, nowMs)) {
          enemyActedPieceIds = [actor.id]
        }
        this.scheduleEnemyAfterAction(actor.id, nowMs)
        this.enemyPieces = syncInitiativeProgress(
          this.enemyPieces,
          nowMs,
          this.globalSpeedMult,
        )
        this.evaluateWaveOutcome()
        if (this.wavePhase !== 'WAVE_ACTIVE') {
          return {
            actedCount: 0,
            enemyActedCount: enemyActedPieceIds.length,
            goldEarned: 0,
            actedPieceIds: [],
            enemyActedPieceIds,
          }
        }
      } else if (actor?.side === 'player') {
        this.beginManualPlayerTurn(actor.id, nowMs)
        if (!this.manualPendingPieceId) {
          return {
            actedCount: 0,
            enemyActedCount: 0,
            goldEarned: 0,
            actedPieceIds: [],
            enemyActedPieceIds: [],
          }
        }
        return empty
      }

      this.evaluateWaveOutcome()

      return {
        actedCount: actedPieceIds.length,
        enemyActedCount: enemyActedPieceIds.length,
        goldEarned,
        actedPieceIds,
        enemyActedPieceIds,
      }
    },

    regenStamina(deltaSec: number): void {
      if (!Number.isFinite(deltaSec) || deltaSec <= 0) return
      const decreeMult = getRoyalDecreeModifiers(this.royalDecree).staminaRegenMult
      const rate = STAMINA_REGEN_PER_SEC * decreeMult
      this.stamina.current = Math.min(this.stamina.max, this.stamina.current + rate * deltaSec)
    },

    spendStaminaForClick(): boolean {
      if (this.stamina.current < STAMINA_CLICK_COST) return false
      this.stamina.current -= STAMINA_CLICK_COST
      return true
    },

    /**
     * Direct click damage on an enemy (GDD §1.1) — works in auto and manual; costs stamina.
     */
    clickEnemyPiece(enemyPieceId: string, nowMs = Date.now()): number {
      if (this.wavePhase !== 'WAVE_ACTIVE') return 0
      if (isWaveFailed(this.playerPieces)) return 0
      if (this.combatFocus !== 'strike') return 0

      const enemy = this.enemyPieces.find((piece) => piece.id === enemyPieceId)
      if (!enemy || enemy.side !== 'enemy') return 0

      const combatNow = getCombatTimeMs({
        autoMode: this.autoMode,
        manualPendingPieceId: this.manualPendingPieceId,
        lastSimulatedMs: this.lastSimulatedMs,
        nowMs,
      })
      if (!isClickCombatReady(this.clickCombatReadyAtMs, combatNow)) return 0
      if (!this.spendStaminaForClick()) return 0

      this.applyComboDecay(nowMs)
      this.incrementCombo(nowMs)

      const enemiesBefore = [...this.enemyPieces]
      const gmMods = this.grandmasterCombatModifiers
      const activeMult = calculateActiveMult(this.combo.count) * gmMods.clickDamageMult
      const bossRuntime = this.bossCombat
      const coord = enemy.position

      const result = resolveClickDamage(
        enemyPieceId,
        this.playerPieces,
        this.enemyPieces,
        {
          clickPowerLevel: this.clickPowerLevel,
          activeMult,
          stage: this.currentStage,
          royalDecreeActive: this.royalDecree.isActive,
          adjustDamage: bossRuntime
            ? (raw, defender) =>
                applyBossDamageReduction(
                  raw,
                  {
                    identity: bossRuntime.identity,
                    attackerKind: 'king',
                    attackerSide: 'player',
                    defender,
                    moveFrom: coord,
                    moveTo: coord,
                  },
                  bossRuntime,
                )
            : undefined,
        },
      )

      this.playerPieces = result.playerPieces
      this.enemyPieces = result.enemyPieces

      if (result.damageDealt > 0) {
        this.waveCombatStats = accumulateWaveCombatStats(this.waveCombatStats, {
          damageDealt: result.damageDealt,
        })
      }
      if (result.captured) {
        this.waveCombatStats = accumulateWaveCombatStats(this.waveCombatStats, {
          captures: 1,
        })
      }

      if (result.captured) {
        this.pushCombatFeedback(
          [createCombatFeedback('capture', coord, nowMs)],
          nowMs,
        )
        this.screenShakeUntilMs = nowMs + SCREEN_SHAKE_MS
        playGameSfx('capture')
      } else if (result.damageDealt > 0) {
        this.pushCombatFeedback(
          [
            createCombatFeedback('chip', coord, nowMs, result.damageDealt),
          ],
          nowMs,
        )
        playGameSfx('chip')
      }

      let goldEarned = 0
      if (result.captureGold > 0) {
        this.waveCombatStats = accumulateWaveCombatStats(this.waveCombatStats, {
          goldFromCaptures: result.captureGold,
        })
        this.addGold(result.captureGold)
        goldEarned += result.captureGold
      }

      const actionGold = this.awardActionGold({
        applyActiveMult: true,
        incrementCombo: false,
        nowMs,
      })
      if (actionGold > 0) {
        this.pushCombatFeedback(
          [createCombatFeedback('gold', coord, nowMs, Math.round(actionGold))],
          nowMs,
        )
        goldEarned += actionGold
      }

      this.clickCombatReadyAtMs = combatNow + CLICK_COOLDOWN_MS
      this.syncCombatPacingAfterAction(enemiesBefore, nowMs)
      if (this.wavePhase !== 'WAVE_ACTIVE') return result.damageDealt
      this.evaluateWaveOutcome()
      return result.damageDealt
    },

    /** Purchases a catalog offer by id; rebuilds piece stats on success. */
    purchaseUpgradeOffer(offerId: string): boolean {
      const offer = this.upgradeOffers.find((o) => o.id === offerId)
      if (!offer?.affordable) return false
      if (!this.spendGold(offer.cost)) return false

      if (offer.track === 'clickPower') {
        this.clickPowerLevel = offer.nextLevel
        this.recordUpgradePurchase()
        playGameSfx('upgrade')
        return true
      }

      if (offer.track === 'promotionMastery') {
        this.promotion.masteryLevel = offer.nextLevel
        this.recordUpgradePurchase()
        playGameSfx('upgrade')
        return true
      }

      if (offer.track === 'autoAdvanceWaves') {
        if (this.autoAdvanceWavesPurchased) return false
        if (!this.spendGold(offer.cost)) return false
        this.autoAdvanceWavesPurchased = true
        this.autoAdvanceWavesEnabled = true
        this.recordUpgradePurchase()
        playGameSfx('upgrade')
        return true
      }

      if (!offer.pieceId) return false
      const index = this.playerPieces.findIndex((piece) => piece.id === offer.pieceId)
      if (index === -1) return false

      const piece = this.playerPieces[index]!
      const levels = { ...piece.upgradeLevels }
      if (offer.track === 'initiative') {
        levels.initiative = offer.nextLevel
      } else {
        levels[offer.track] = offer.nextLevel
      }

      const meta = calculateMetaModifiers(this.metaUpgrades)
      const stats = buildPieceStats(piece.kind, levels)
      const scaledAp = stats.ap * meta.apMult
      const hpRatio = piece.stats.maxHp > 0 ? piece.stats.hp / piece.stats.maxHp : 1

      this.playerPieces[index] = {
        ...piece,
        upgradeLevels: levels,
        stats: {
          ...stats,
          ap: scaledAp,
          hp: Math.min(stats.maxHp, stats.maxHp * hpRatio),
        },
        initiative: {
          ...piece.initiative,
          iniLevel: levels.initiative,
        },
      }
      this.recordUpgradePurchase()
      playGameSfx('upgrade')
      return true
    },

    purchaseBestRoiUpgrade(): boolean {
      const best = this.upgradeOffers.find((o) => o.isBestRoi)
      if (!best) return false
      return this.purchaseUpgradeOffer(best.id)
    },

    /**
     * Called after localStorage hydrate — ensures safe prep room (Phase 3.8).
     */
    finalizePersistedRestore(nowMs = Date.now()): void {
      const state = readStoreState(this)
      const rosters = bootstrapPersistedRosters(state, nowMs)
      ;(this.$patch as (patch: Partial<GameState>) => void)({
        ...restorePersistedSession(state, nowMs),
        ...rosters,
      })
      this.exhibitionLastTickMs = nowMs
      this.applyMetaModifiers()
      this.syncRoyalDecree()
      if (this.wavePhase === 'WAVE_ACTIVE') {
        this.startCombatLoop(nowMs)
      }
    },
  },

  persist: gameStorePersistConfig as PersistenceOptions<GameState>,
})

export function runGameStoreSanityCheck(nowMs = 0): { passed: boolean; messages: string[] } {
  createPiniaForTest()
  const messages: string[] = []
  let passed = true

  const assert = (label: string, ok: boolean) => {
    messages.push(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
    if (!ok) passed = false
  }

  const store = useGameStore()
  store.initGame(nowMs)

  assert('initial gold is zero', store.gold === 0)
  assert('initial elo is zero', store.eloShards === 0)
  assert('initial stage is 1', store.currentStage === 1)
  assert('initial combo is zero', store.comboCount === 0)
  assert('royal decree active on solo king', store.isRoyalDecreeActive)

  store.addGold(100)
  assert('addGold updates wallet', store.gold === 100)

  store.incrementCombo(nowMs)
  store.incrementCombo(nowMs + 100)
  assert('combo increments', store.comboCount === 2)

  store.applyComboDecay(nowMs + 100 + COMBO_DECAY_MS + 1)
  assert('combo decays after idle window', store.comboCount === 0)

  const decreeBefore = store.isRoyalDecreeActive
  store.deployPawn(3, 1, 'test-pawn', nowMs)
  assert('decree was active before deploy', decreeBefore)
  assert('deploy second piece kills decree instantly', !store.isRoyalDecreeActive)
  assert('decree permanently expired', store.royalDecree.permanentlyExpired)

  store.startWave(nowMs)
  const tick = store.tickCombat(nowMs + 3000)
  assert('initiative tick fires king action', tick.actedCount >= 1)
  assert('initiative tick earns gold in auto mode', tick.goldEarned > 0)

  store.enemyPieces = []
  store.evaluateWaveOutcome()
  assert('wave clear advances to next prep', store.isWavePrep)
  assert('stage increments after clear', store.currentStage === 2)

  const decreeSim = runRoyalDecreeStateMachineCheck(nowMs)
  assert('royal decree state machine passes', decreeSim.passed)

  return { passed, messages }
}

export function createPiniaForTest(): ReturnType<typeof createPinia> {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}
