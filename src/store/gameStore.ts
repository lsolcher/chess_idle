/**
 * Central Pinia hub for Idle Chess RPG run state.
 * Persists `GameState`; delegates combat to `combatStore` and economy to `economyStore`.
 */
import { createPinia, defineStore, getActivePinia, setActivePinia } from 'pinia'
import {
  bootstrapPieceInitiative,
  bootstrapPiecesForCombat,
  buildTurnOrderQueue,
  getNextReadyActor,
  getReadyPlayerPieceIds,
  syncInitiativeProgress,
} from '@/engine/initiative'
import { getAllPieces, reconcileUniqueBoardPositions } from '@/engine/board'
import { computeClickCooldownProgress, isClickCombatReady } from '@/engine/clickCombat'
import type { BoardMove } from '@/engine/moves'
import { generateLegalMoves } from '@/engine/moves'
import { healPlayerPiecesForPrep } from '@/engine/waveState'
import { buildIntentTimeline } from '@/engine/enemyIntent'
import {
  getRoyalDecreeModifiers,
  normalizeRoyalDecreeState,
  reduceRoyalDecree,
  runRoyalDecreeStateMachineCheck,
} from '@/engine/royalDecree'
import { resolveEffectiveAutoAiPersonality } from '@/engine/adaptiveAI'
import { isWavePatternCountered, resolveWavePatternForStage } from '@/engine/wavePatterns'
import { useMetaStore } from '@/store/metaStore'
import {
  applyDeploySlotMilestones,
  clampDeploySlotsToRoster,
  buildPieceShopCatalog,
  resolveUnlockedSlotsFromMilestones,
} from '@/engine/pieceShop'
import { getBossWaveClearMultiplier, isBossStage } from '@/engine/stageManager'
import {
  buildOnboardingEnemyPieces,
  buildOnboardingPlayerPieces,
  isOnboardingTelegraphWave,
  ONBOARDING_PAWN_ID,
  ONBOARDING_ROOK_ID,
} from '@/engine/onboardingTelegraph'
import { computeAdvanceStageAfterClear, preparePlayerPiecesForPrep } from '@/engine/waveLifecycle'
import { generatePrepRepositionMoves } from '@/engine/prepMovement'
import { playGameSfx, playPrestigeChimeAudio } from '@/store/gameAudioBridge'
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
  PRESTIGE_UNLOCK_STAGE,
  projectPrestigeEloEarned,
} from '@/engine/prestige'
import { evaluateAutoAdvanceTick } from '@/engine/waveAutomation'
import { mergeTownBonuses, NEUTRAL_TOWN_BONUSES } from '@/engine/townBuildings'
import { createBossCombatRuntime } from '@/engine/bossMechanics'
import { getBossDefinition, resolveBossIdentity } from '@/engine/bossIdentity'
import { formatKingFailTelegraph } from '@/engine/kingFailAttribution'
import { getBossTimeRemainingMs, getBossWaveLimitMs, isBossWaveTimedOut } from '@/engine/bossTimer'
import { refreshPlayerArmyCombatStats } from '@/engine/playerStageScaling'
import {
  buildAestheticProgressSnapshot,
  getBoardEvolutionClasses,
  getBoardEvolutionShellClasses,
  getBoardEvolutionTier,
  getBoardSquareEvolutionClasses,
  getPermanentTrophyShellClasses,
  getPieceAuraClasses,
  getPieceVictoryGlowClasses,
  getVictoryBackgroundShellClasses,
  getPiecePowerAuraClasses,
  getPiecePowerAuraTier,
  getShellAtmosphereClasses,
  MAX_PIECE_AURA_TIER,
  resolvePermanentVisualTrophies,
} from '@/engine/aestheticProgression'
import { getGrandmasterCombatModifiers } from '@/engine/grandmasterBoss'
import {
  getMusicLayerProgress,
  getUnlockedMusicLayers,
  MUSIC_LAYER_DEFINITIONS,
  type MusicLayerDefinition,
  type MusicLayerId,
} from '@/engine/musicLayers'
import { serializeGameState } from '@/engine/gameSerialization'
import { createEmptyWaveCombatStats } from '@/engine/waveOutcome'
import { ARENA_POINT_CAP, canSaveArenaLoadout } from '@/engine/arenaLoadout'
import { shouldRunAutoShopAssistant } from '@/engine/supporterQoL'
import { useTownStore } from '@/store/townStore'
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
  getStrategySuiteClasses,
  resolveCosmeticTheme,
  resolveEquippedCosmetics,
  type CosmeticDefinition,
} from '@/engine/cosmetics'
import { getHighlightedUpgradeCatalog, pickBestAffordablePurchase, type UpgradeOffer } from '@/engine/upgrades'
import type { PersistenceOptions } from 'pinia-plugin-persistedstate'
import {
  bootstrapPersistedRosters,
  gameStorePersistConfig,
  restorePersistedSession,
} from '@/store/persistConfig'
import {
  createCombatFeedback,
  isBoardZoomActive as isCombatBoardZoomed,
  isImpactFrameActive as isCombatImpactFrozen,
  isScreenShaking as isScreenShakeActive,
} from '@/engine/combatFeedback'
import {
  calculateActionIntervalSec,
  calculateActiveMult,
  calculateGoldAction,
  calculateEloShardsEarned,
  COMBO_DECAY_MS,
  createInitialGameState,
  normalizeAutoAiPersonality,
  STAMINA_CLICK_COST,
  type AutoAiPersonality,
  type ChessPiece,
  type CombatFocus,
  type AestheticPreferences,
  type GameState,
  type MetaUpgradeId,
  type PieceKind,
  type SuperPromotionForm,
} from '@/types/game'
import { getPromotionStreakGoldMult } from '@/engine/promotion'
import { useCombatStore } from '@/store/combatStore'
import { useEconomyStore } from '@/store/economyStore'

export { PRESTIGE_UNLOCK_STAGE } from '@/engine/prestige'
export type { AwardGoldOptions } from '@/store/economyStore'
export type { CombatTickResult } from '@/store/combatStore'

function combat() {
  return useCombatStore()
}

function economy() {
  return useEconomyStore()
}

/** Resolves meta tree + Chess Town bonuses for combat and economy getters. */
function resolveEffectiveMetaModifiers(state: GameState) {
  const base = calculateMetaModifiers(state.metaUpgrades)
  const pinia = getActivePinia()
  if (!pinia) return mergeTownBonuses(base, NEUTRAL_TOWN_BONUSES)
  return mergeTownBonuses(base, useTownStore(pinia).getTownBonuses())
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
        state.lifetime.lifetimeWavesCleared ?? 0,
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

    boardEvolutionTier(state): number {
      return getBoardEvolutionTier(state.currentStage)
    },

    boardEvolutionShellClass(): string {
      if (
        !this.aestheticPreferences.gradualProgression ||
        !this.aestheticPreferences.boardEvolution
      ) {
        return ''
      }
      return getBoardEvolutionShellClasses(this.boardEvolutionTier)
    },

    activeMusicLayers(state): MusicLayerId[] {
      if (!state.aestheticPreferences.musicLayers) return ['base']
      return getUnlockedMusicLayers(
        state.lifetime.maxStageEverReached,
        state.lifetime.totalPrestiges,
      )
    },

    shellAtmosphereClass(): string {
      return getShellAtmosphereClasses(
        this.lifetime.maxStageEverReached,
        this.activeMusicLayers,
      )
    },

    victoryBackgroundOverlayClass(): string {
      if (!this.aestheticPreferences.gradualProgression) return ''
      return getVictoryBackgroundShellClasses(
        this.aestheticProgress.victoryBackgroundTier,
      )
    },

    showMusicParticles(): boolean {
      const layers = this.activeMusicLayers
      return (
        layers.includes('strings') ||
        layers.includes('celestial') ||
        layers.includes('orchestral') ||
        layers.includes('god')
      )
    },

    showMusicLightShafts(): boolean {
      return (
        this.activeMusicLayers.includes('god') ||
        this.activeMusicLayers.includes('celestial')
      )
    },

    strategySuiteClasses() {
      return getStrategySuiteClasses(this.cosmeticTheme)
    },

    isBoardZoomActive(): boolean {
      return isCombatBoardZoomed(this.boardZoomUntilMs, Date.now())
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

    intentSpeedMults(state) {
      const gm = getGrandmasterCombatModifiers(state.bossCombat, state.enemyPieces)
      return {
        player: state.globalSpeedMult * gm.playerInitiativeMult,
        enemy: state.globalSpeedMult,
      }
    },

    /** Next 3 initiative actors for the Enemy Intent Ribbon. */
    enemyIntentTimeline(state) {
      const gm = getGrandmasterCombatModifiers(state.bossCombat, state.enemyPieces)
      return buildIntentTimeline(
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

    currentWavePattern(state) {
      return resolveWavePatternForStage(state.currentStage)
    },

    wavePatternCountered(state) {
      const pinia = getActivePinia()
      if (!pinia) return false
      const meta = useMetaStore(pinia)
      const pattern = resolveWavePatternForStage(state.currentStage)
      return isWavePatternCountered(pattern, meta.dojoModules)
    },

    effectiveAutoAiPersonality(state) {
      return resolveEffectiveAutoAiPersonality(
        state.autoAiPersonality,
        state.currencies.eloShards,
        state.maxStageReached,
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
      if (state.currencies.gold <= 0) return null
      const pick = pickBestAffordablePurchase(
        getHighlightedUpgradeCatalog({
          gold: state.currencies.gold,
          playerPieces: state.playerPieces,
          clickPowerLevel: state.clickPowerLevel,
          promotionMasteryLevel: state.promotion.masteryLevel,
          globalSpeedMult: state.globalSpeedMult,
          currentStage: state.currentStage,
          autoAdvanceWavesPurchased: state.autoAdvanceWavesPurchased,
        }),
        buildPieceShopCatalog({
          gold: state.currencies.gold,
          maxStageReached: state.maxStageReached,
          currentStage: state.currentStage,
          wavePhase: state.wavePhase,
          playerPieces: state.playerPieces,
          enemyPieces: state.enemyPieces,
          unlockedSlots: state.unlockedSlots,
          deploySlots: state.deploySlots,
          globalSpeedMult: state.globalSpeedMult,
        }),
      )
      return pick?.id ?? null
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
        globalSpeedMult: state.globalSpeedMult,
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

    isImpactFrameActive(state): boolean {
      return isCombatImpactFrozen(state.impactFreezeUntilMs, Date.now())
    },

    projectedEloEarned(state): number {
      return calculateEloShardsEarned(
        state.maxStageReached,
        state.currencies.totalGoldEarned,
        getPrestigeEloMultBonus(state.achievements),
      )
    },

    metaModifiers(state) {
      return resolveEffectiveMetaModifiers(state)
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

    showOnboardingTelegraph(state): boolean {
      return (
        state.wavePhase === 'WAVE_ACTIVE' &&
        isOnboardingTelegraphWave(
          state.currentStage,
          state.lifetime.onboardingTelegraphComplete ?? false,
        )
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
        { missingHpRecoveryFraction: this.metaModifiers.prepMissingHpRecoveryFraction },
      )
      this.enemyPieces = []
      this.wavePhase = 'WAVE_PREP'
      this.manualPendingPieceId = null
      this.prepPendingPieceId = null
      this.combatLoopRunning = false
    },

    /** Repairs duplicate coordinates so pieces do not vanish or jump on the board. */
    reconcileBoardPositions(): void {
      const fixed = reconcileUniqueBoardPositions(this.playerPieces, this.enemyPieces)
      this.playerPieces = fixed.playerPieces
      this.enemyPieces = fixed.enemyPieces
    },

    applyComboDecay(nowMs = Date.now()): void {
      economy().applyComboDecay(nowMs)
    },

    incrementCombo(nowMs = Date.now()): void {
      economy().incrementCombo(nowMs)
    },

    addGold(amount: number): void {
      economy().addGold(amount)
    },

    recordUpgradePurchase(): void {
      economy().recordUpgradePurchase()
    },

    /** Stamps save time for offline progression (Phase 7.5). */
    touchSessionActivity(nowMs = Date.now()): void {
      this.lastActiveAtMs = nowMs
    },

    dismissOfflineGoldToast(): void {
      this.lastOfflineGoldGranted = 0
    },

    dismissWaveOutcome(nowMs = Date.now()): void {
      const report = this.waveOutcomeReport
      if (report?.kind === 'victory') {
        this.proceedFromWaveCompleteToPrep(nowMs)
      }
      this.waveOutcomeReport = null
      this.waveCompleteAtMs = null
    },

    resetWaveCombatStats(): void {
      this.waveCombatStats = createEmptyWaveCombatStats()
    },

    checkBossWaveTimeout(nowMs = Date.now()): void {
      combat().checkBossWaveTimeout(nowMs)
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

    /** Upgrade-rank power glow + win-streak sparkle + optional level-up pulse. */
    pieceJuiceClassFor(piece: ChessPiece): string {
      const parts: string[] = []
      if (piece.side === 'player') {
        const powerTier = getPiecePowerAuraTier(piece.upgradeLevels)
        const power = getPiecePowerAuraClasses(piece.side, powerTier)
        if (power) parts.push(power)
        const victory = this.pieceVictoryGlowClassFor(piece)
        if (victory) parts.push(victory)
      }
      const stageAura = this.pieceAuraClassFor(piece)
      if (stageAura) parts.push(stageAura)
      const pulseUntil = this.pieceJuicePulseUntilMs[piece.id] ?? 0
      if (pulseUntil > Date.now()) parts.push('animate-piece-level-pulse')
      return parts.join(' ')
    },

    /** Win-based glow on standard chess glyphs (run streak + lifetime clears). */
    pieceVictoryGlowClassFor(piece: ChessPiece): string {
      if (
        piece.side !== 'player' ||
        !this.aestheticPreferences.gradualProgression ||
        !this.aestheticPreferences.pieceAuras
      ) {
        return ''
      }
      const tier = this.aestheticProgress.victoryGlowTier
      const bursting = this.armyVictoryGlowBurstUntilMs > Date.now()
      return getPieceVictoryGlowClasses(tier, piece.kind, bursting)
    },

    boardSquareEvolutionClass(light: boolean): string {
      if (
        !this.aestheticPreferences.gradualProgression ||
        !this.aestheticPreferences.boardEvolution
      ) {
        return ''
      }
      return getBoardSquareEvolutionClasses(this.boardEvolutionTier, light)
    },

    spendGold(amount: number): boolean {
      return economy().spendGold(amount)
    },

    addEloShards(amount: number): void {
      economy().addEloShards(amount)
    },

    spendEloShards(amount: number): boolean {
      return economy().spendEloShards(amount)
    },

    /** Recomputes prestige gold / speed / deploy slots from meta + town ranks. */
    applyMetaModifiers(): void {
      const pinia = getActivePinia()
      const town = pinia ? useTownStore(pinia).getTownBonuses() : NEUTRAL_TOWN_BONUSES
      applyMetaModifiersToState(readStoreState(this), town)
      this.syncPlayerArmyCombatStats(true)
    },

    /** Applies stage + meta scaling so the army keeps pace with procedural enemies. */
    syncPlayerArmyCombatStats(preserveHpRatio = false): void {
      this.playerPieces = refreshPlayerArmyCombatStats(
        this.playerPieces,
        this.currentStage,
        this.promotion.masteryLevel,
        this.metaModifiers.apMult,
        { preserveHpRatio },
      )
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
      playGameSfx('metaPurchase')
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
      this.applyMetaModifiers()
      this.enterWavePrep(nowMs)
      playPrestigeChimeAudio()
      return true
    },

    /**
     * Background exhibition boards — runs in prep, combat, and clear (GDD §2.5).
     */
    pushCombatFeedback(
      events: ReturnType<typeof createCombatFeedback>[],
      nowMs = Date.now(),
    ): void {
      combat().pushCombatFeedback(events, nowMs)
    },

    pulsePieceJuice(pieceId: string, nowMs = Date.now()): void {
      combat().pulsePieceJuice(pieceId, nowMs)
    },

    prunePieceJuicePulse(nowMs = Date.now()): void {
      combat().prunePieceJuicePulse(nowMs)
    },

    pruneCombatFeedback(nowMs = Date.now()): void {
      combat().pruneCombatFeedback(nowMs)
    },

    completeOnboardingTelegraph(): void {
      combat().completeOnboardingTelegraph()
    },

    refreshEnemyIntent(nowMs = this.lastSimulatedMs): void {
      combat().refreshEnemyIntent(nowMs)
    },

    grantTempoBonus(coord: { file: number; rank: number }, nowMs = Date.now()): void {
      combat().grantTempoBonus(coord, nowMs)
    },

    awardActionGold(options: import('@/store/economyStore').AwardGoldOptions = {}): number {
      return economy().awardActionGold(options)
    },

    /**
     * Applies GDD milestone unlocks for piece types, pawn slots, and deploy capacity.
     */
    syncMilestoneUnlocks(): void {
      this.unlockedSlots = resolveUnlockedSlotsFromMilestones(this.maxStageReached)
      this.deploySlots = clampDeploySlotsToRoster(
        applyDeploySlotMilestones(this.maxStageReached, this.deploySlots, this.unlockedSlots),
        this.unlockedSlots,
      )
    },

    /** Clears victory modal → prep: advances stage and refreshes combat clocks. */
    proceedFromWaveCompleteToPrep(nowMs = Date.now()): boolean {
      if (this.wavePhase !== 'WAVE_COMPLETE') return false
      return this.advanceStageAfterClear(nowMs)
    },

    /**
     * Applies post-clear stage increment and opens prep for the next wave (GDD §1.8).
     */
    advanceStageAfterClear(nowMs = Date.now()): boolean {
      const next = computeAdvanceStageAfterClear({
        playerPieces: this.playerPieces,
        enPassantCarryByPieceId: this.enPassantCarryByPieceId,
        enPassantEconomyRank: this.enPassantEconomyRank,
        currentStage: this.currentStage,
        maxStageReached: this.maxStageReached,
        lifetime: this.lifetime,
      })
      this.playerPieces = next.playerPieces
      this.enPassantCarryByPieceId = next.enPassantCarryByPieceId
      this.currentStage = next.currentStage
      this.maxStageReached = next.maxStageReached
      this.lifetime = bumpLifetimeStage(next.lifetime, next.maxStageReached)
      this.prestigeAvailable = next.prestigeAvailable
      this.friendlyActionsThisStage = next.friendlyActionsThisStage
      this.promotion.streak = next.promotionStreak
      this.immortalGameUsedThisStage = next.immortalGameUsedThisStage
      this.failCountThisStage = next.failCountThisStage
      this.enemyHpScale = next.enemyHpScale
      this.pendingPromotion = null
      this.manualPendingPieceId = null
      this.prepPendingPieceId = null
      this.waveCheckpointStage = next.waveCheckpointStage
      this.lastFailRewindToStage = next.lastFailRewindToStage
      this.syncMilestoneUnlocks()
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
      this.lastSimulatedMs = nowMs
      this.stopCombatLoop()
      this.enemyPieces = []
      this.bossCombat = null
      this.bossWaveDeadlineMs = null
      const prepPieces = preparePlayerPiecesForPrep(
        this.playerPieces,
        this.enemyPieces,
        nowMs,
        this.globalSpeedMult,
        this.metaModifiers.prepMissingHpRecoveryFraction,
      )
      this.playerPieces = prepPieces.playerPieces
      this.syncPlayerArmyCombatStats(true)
      this.reconcileBoardPositions()
      this.playerPieces = this.playerPieces.map((piece) =>
        bootstrapPieceInitiative(piece, nowMs, this.globalSpeedMult),
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
      console.log('[gameStore] startWave', {
        wavePhase: this.wavePhase,
        stage: this.currentStage,
        playerPieces: this.playerPieces.length,
      })
      if (this.wavePhase === 'WAVE_COMPLETE') {
        this.proceedFromWaveCompleteToPrep(nowMs)
      }
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
      this.syncPlayerArmyCombatStats(true)
      const onboarding =
        !import.meta.env.VITEST &&
        isOnboardingTelegraphWave(
          this.currentStage,
          this.lifetime.onboardingTelegraphComplete ?? false,
        )
      if (onboarding) {
        this.setAutoPlay(false)
        this.playerPieces = buildOnboardingPlayerPieces(nowMs, this.globalSpeedMult)
        this.syncPlayerArmyCombatStats(true)
        this.enemyPieces = buildOnboardingEnemyPieces(nowMs, this.currentStage)
      } else {
        this.enemyPieces = spawnEnemiesForStage(
          this.currentStage,
          nowMs,
          this.enemyHpScale,
          this.playerPieces,
        )
      }
      this.reconcileBoardPositions()
      this.bossCombat = createBossCombatRuntime(this.currentStage, this.enemyPieces)
      const bossLimit = getBossWaveLimitMs(this.currentStage, this.metaUpgrades)
      this.bossWaveDeadlineMs = bossLimit > 0 ? nowMs + bossLimit : null
      this.lastPawnLeakDamage = 0
      this.clickCombatReadyAtMs = nowMs
      this.combatFocus = onboarding ? 'move' : this.autoMode ? 'strike' : 'move'
      this.playerTempoHasteMult = 1
      this.refreshEnemyIntent(nowMs)
      if (onboarding) {
        const pawn = this.playerPieces.find((p) => p.id === ONBOARDING_PAWN_ID)
        if (pawn) {
          this.beginManualPlayerTurn(pawn.id, nowMs)
        }
      }
      this.startCombatLoop(nowMs)
      return true
    },

    completeWave(nowMs = Date.now()): void {
      combat().completeWave(nowMs)
    },

    failWave(nowMs = Date.now()): void {
      combat().failWave(nowMs)
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
      if (!enabled) {
        this.waveCompleteAtMs = null
      }
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
        prepUiBlocked: this.waveOutcomeReport !== null,
      })

      this.waveCompleteAtMs = tick.waveCompleteAtMs

      if (tick.shouldStartWave && this.wavePhase === 'WAVE_PREP') {
        this.startWave(nowMs)
      }
    },

    syncCombatPacingAfterAction(
      enemiesBefore: ChessPiece[],
      nowMs = Date.now(),
    ): void {
      combat().syncCombatPacingAfterAction(enemiesBefore, nowMs)
    },

    evaluateWaveOutcome(): void {
      combat().evaluateWaveOutcome()
    },

    deployPlayerPiece(piece: ChessPiece, nowMs = Date.now()): void {
      economy().deployPlayerPiece(piece, nowMs)
    },

    deployPawn(file: number, rank: number, id?: string, nowMs = Date.now()): ChessPiece {
      return economy().deployPawn(file, rank, id, nowMs)
    },

    purchasePieceFromShop(kind: PieceKind, nowMs = Date.now()): boolean {
      return economy().purchasePieceFromShop(kind, nowMs)
    },

    purchaseBoardSlot(nowMs = Date.now()): boolean {
      return economy().purchaseBoardSlot(nowMs)
    },

    purchasePieceShopOffer(offerId: string, nowMs = Date.now()): boolean {
      return economy().purchasePieceShopOffer(offerId, nowMs)
    },

    removePlayerPiece(pieceId: string): void {
      economy().removePlayerPiece(pieceId)
    },

    syncRoyalDecree(): void {
      this.royalDecree = normalizeRoyalDecreeState(
        reduceRoyalDecree(this.royalDecree, {
          type: 'FORCE_SYNC',
          playerPieces: this.playerPieces,
        }),
      )
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
      if (focus === 'move' && !this.manualPendingPieceId) {
        this.ensureOnboardingManualTurn(this.lastSimulatedMs)
        if (!this.manualPendingPieceId) return false
      }
      this.combatFocus = focus
      playGameSfx('uiClick')
      return true
    },

    /** Re-arms the scripted pawn turn during the Intent Ribbon tutorial (hydrate-safe). */
    armOnboardingMove(nowMs = Date.now()): boolean {
      if (this.wavePhase !== 'WAVE_ACTIVE') return false
      this.setAutoPlay(false)
      this.ensureOnboardingBoardState(nowMs)
      this.ensureOnboardingManualTurn(nowMs)
      if (!this.manualPendingPieceId) return false
      this.combatFocus = 'move'
      playGameSfx('uiClick')
      return true
    },

    /** Restores tutorial roster if a mid-save wave is missing the scripted pawn/rook. */
    ensureOnboardingBoardState(nowMs = Date.now()): void {
      if (
        !isOnboardingTelegraphWave(
          this.currentStage,
          this.lifetime.onboardingTelegraphComplete ?? false,
        )
      ) {
        return
      }
      const hasPawn = this.playerPieces.some((p) => p.id === ONBOARDING_PAWN_ID)
      const hasRook = this.enemyPieces.some((p) => p.id === ONBOARDING_ROOK_ID)
      if (hasPawn && hasRook) return

      this.playerPieces = buildOnboardingPlayerPieces(nowMs, this.globalSpeedMult)
      this.syncPlayerArmyCombatStats(true)
      this.enemyPieces = buildOnboardingEnemyPieces(nowMs, this.currentStage)
      this.reconcileBoardPositions()
      this.bossCombat = createBossCombatRuntime(this.currentStage, this.enemyPieces)
      this.refreshEnemyIntent(nowMs)
    },

    ensureOnboardingManualTurn(nowMs = Date.now()): void {
      if (
        !isOnboardingTelegraphWave(
          this.currentStage,
          this.lifetime.onboardingTelegraphComplete ?? false,
        )
      ) {
        return
      }
      const pawn = this.playerPieces.find((p) => p.id === ONBOARDING_PAWN_ID)
      if (pawn) {
        this.beginManualPlayerTurn(pawn.id, nowMs)
      }
    },

    setAutoPlay(enabled: boolean): void {
      this.setAutoMode(enabled)
    },

    setAutoAiPersonality(_personality: AutoAiPersonality): void {
      this.autoAiPersonality = 'adaptive'
    },

    skipManualTurn(nowMs = Date.now()): boolean {
      return combat().skipManualTurn(nowMs)
    },

    beginManualPlayerTurn(pieceId: string, nowMs = Date.now()): void {
      combat().beginManualPlayerTurn(pieceId, nowMs)
    },

    selectManualPiece(pieceId: string, nowMs = Date.now()): boolean {
      if (this.autoMode || this.wavePhase !== 'WAVE_ACTIVE') return false
      const actor = getNextReadyActor(this.playerPieces, this.enemyPieces, nowMs)
      if (!actor || actor.side !== 'player' || actor.id !== pieceId) return false
      this.manualPendingPieceId = pieceId
      this.combatFocus = 'move'
      return true
    },

    scheduleEnemyAfterAction(pieceId: string, nowMs = Date.now()): void {
      combat().scheduleEnemyAfterAction(pieceId, nowMs)
    },

    schedulePlayerAfterAction(pieceId: string, nowMs = Date.now()): void {
      combat().schedulePlayerAfterAction(pieceId, nowMs)
    },

    recordKingFailAttribution(
      attribution: import('@/types/game').KingFailAttribution,
    ): void {
      combat().recordKingFailAttribution(attribution)
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
      this.reconcileBoardPositions()
      this.prepPendingPieceId = null
      playGameSfx('uiClick')
      return true
    },

    startCombatLoop(nowMs = Date.now()): void {
      combat().startCombatLoop(nowMs)
    },

    stopCombatLoop(): void {
      combat().stopCombatLoop()
    },

    processPromotionForPiece(pieceId: string, chosenForm?: SuperPromotionForm): number {
      return combat().processPromotionForPiece(pieceId, chosenForm)
    },

    choosePromotionForm(form: SuperPromotionForm, nowMs = Date.now()): void {
      combat().choosePromotionForm(form, nowMs)
    },

    dismissPendingPromotion(): void {
      combat().dismissPendingPromotion()
    },

    executePlayerManualMove(move: BoardMove, nowMs = Date.now()): number {
      return combat().executePlayerManualMove(move, nowMs)
    },

    resolvePlayerMove(
      move: BoardMove,
      nowMs = Date.now(),
      options?: { trackCombat?: boolean },
    ): number {
      return combat().resolvePlayerMove(move, nowMs, options)
    },

    resolveEnemyMove(move: BoardMove, nowMs = Date.now()): void {
      combat().resolveEnemyMove(move, nowMs)
    },

    processEnemyPawnLeaks(): void {
      combat().processEnemyPawnLeaks()
    },

    tickBossAfterEnemyAction(actedEnemyId: string, nowMs = Date.now()): void {
      combat().tickBossAfterEnemyAction(actedEnemyId, nowMs)
    },

    executeEnemyMove(pieceId: string, nowMs = Date.now()): boolean {
      return combat().executeEnemyMove(pieceId, nowMs)
    },

    tickEnemyInitiative(nowMs = Date.now()): string[] {
      return combat().tickEnemyInitiative(nowMs)
    },

    executePlayerAutoMove(pieceId: string, nowMs = Date.now()): number {
      return combat().executePlayerAutoMove(pieceId, nowMs)
    },

    regenStamina(deltaSec: number): void {
      combat().regenStamina(deltaSec)
    },

    spendStaminaForClick(): boolean {
      return combat().spendStaminaForClick()
    },

    clickEnemyPiece(enemyPieceId: string, nowMs = Date.now()): number {
      return combat().clickEnemyPiece(enemyPieceId, nowMs)
    },

    tickCombat(nowMs = Date.now()) {
      return combat().tickCombat(nowMs)
    },

    purchaseUpgradeOffer(offerId: string): boolean {
      return economy().purchaseUpgradeOffer(offerId)
    },

    purchaseBestRoiUpgrade(): boolean {
      return economy().purchaseBestRoiUpgrade()
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
  assert('deploy second piece ends full decree', !store.isRoyalDecreeActive)
  assert('army built latched', store.royalDecree.armyBuilt)

  store.startWave(nowMs)
  const tick = store.tickCombat(nowMs + 3000)
  assert('initiative tick fires king action', tick.actedCount >= 1)
  assert('initiative tick earns gold in auto mode', tick.goldEarned > 0)

  store.enemyPieces = []
  store.evaluateWaveOutcome()
  assert('wave clear opens victory modal', store.isWaveComplete)
  store.dismissWaveOutcome(nowMs)
  assert('continue to prep advances stage', store.isWavePrep)
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
