/**
 * Pinia persistence policy — retains run progress including mid-wave combat (Phase 6).
 * Only ephemeral timers/VFX are stripped on hydrate; wave board state is restored.
 */
import { bootstrapPiecesForCombat } from '@/engine/initiative'
import { createBossCombatRuntime } from '@/engine/bossMechanics'
import { createDefaultEquippedCosmetics } from '@/engine/cosmetics'
import { calculateOfflineGoldGrant } from '@/engine/offlineProgress'
import { readPersistedSupporterOfflineMultiplier } from '@/store/persistMetaReader'
import { resolvePersistStorage } from '@/store/persistStorage'

export { resolvePersistStorage } from '@/store/persistStorage'
import { normalizePersistedLifetime } from '@/engine/saveMigration'
import { calculateMetaModifiers } from '@/engine/metaUpgrades'
import { refreshPlayerArmyCombatStats } from '@/engine/playerStageScaling'
import { healPlayerPiecesForPrep } from '@/engine/waveState'
import { calculateMetaModifiers } from '@/engine/metaUpgrades'
import { mergeTownBonuses, NEUTRAL_TOWN_BONUSES } from '@/engine/townBuildings'
import type { PiniaPluginContext } from 'pinia'
import type { PersistenceOptions } from 'pinia-plugin-persistedstate'
import type { GameState, WavePhase } from '@/types/game'
import {
  createDefaultAestheticPreferences,
  normalizeAutoAiPersonality,
  normalizeCombatFocus,
} from '@/types/game'
import {
  isOnboardingTelegraphWave,
  ONBOARDING_PAWN_ID,
} from '@/engine/onboardingTelegraph'
import { normalizeRoyalDecreeState } from '@/engine/royalDecree'
import { evaluateRoyalDecree, GAME_SCHEMA_VERSION } from '@/types/game'
import { GAME_SAVE_STORAGE_KEY } from '@/version'

export { GAME_SAVE_STORAGE_KEY } from '@/version'

/**
 * Fields excluded from localStorage — session-only telemetry and combat loop handles.
 * Wave phase + enemy board are persisted so refresh can resume mid-fight (Phase 6).
 */
export const PERSIST_OMIT_PATHS: (keyof GameState)[] = [
  'combatLoopRunning',
  'manualPendingPieceId',
  'prepPendingPieceId',
  'lastSimulatedMs',
  'combatFeedbackEvents',
  'screenShakeUntilMs',
  'impactFreezeUntilMs',
  'boardZoomUntilMs',
  'pieceJuicePulseUntilMs',
  'lastOfflineGoldGranted',
  'waveCombatStats',
  'waveOutcomeReport',
  'waveCompleteAtMs',
]

/**
 * Rehydrates volatile session fields while preserving wave phase when possible.
 */
export function restorePersistedSession(
  state: GameState,
  nowMs = Date.now(),
): Partial<GameState> {
  const wavePhase: WavePhase = state.wavePhase ?? 'WAVE_PREP'

  const common: Partial<GameState> = {
    schemaVersion: GAME_SCHEMA_VERSION,
    combatLoopRunning: false,
    manualPendingPieceId: null,
    prepPendingPieceId: null,
    lastSimulatedMs: nowMs,
    clickCombatReadyAtMs: Math.min(state.clickCombatReadyAtMs ?? nowMs, nowMs),
    combatFeedbackEvents: [],
    screenShakeUntilMs: 0,
    impactFreezeUntilMs: 0,
    boardZoomUntilMs: 0,
    pieceJuicePulseUntilMs: {},
    exhibitionLastTickMs: state.exhibitionLastTickMs ?? nowMs,
    exhibitionGoldEarned: state.exhibitionGoldEarned ?? 0,
    hasPrestigedOnce: state.hasPrestigedOnce ?? false,
    autoAdvanceWavesPurchased: state.autoAdvanceWavesPurchased ?? false,
    autoAdvanceWavesEnabled: state.autoAdvanceWavesEnabled ?? false,
    autoStartWavesEnabled: state.autoStartWavesEnabled ?? false,
    autoAiPersonality: normalizeAutoAiPersonality(state.autoAiPersonality),
    telegraphedEnemyIds: state.telegraphedEnemyIds ?? [],
    playerTempoHasteMult: state.playerTempoHasteMult ?? 1,
    combatFocus: normalizeCombatFocus(state.combatFocus, state.autoMode ?? true),
    enPassantCarryByPieceId: state.enPassantCarryByPieceId ?? {},
    bossTrophiesClaimed: state.bossTrophiesClaimed ?? [],
    lastPawnLeakDamage: 0,
    lastActiveAtMs: state.lastActiveAtMs ?? nowMs,
    lastKingFailAttribution: state.lastKingFailAttribution ?? null,
    lifetime: normalizePersistedLifetime(state),
    equippedCosmetics: state.equippedCosmetics ?? createDefaultEquippedCosmetics(),
    aestheticPreferences: {
      ...createDefaultAestheticPreferences(),
      ...state.aestheticPreferences,
    },
    waveCheckpointStage: state.waveCheckpointStage ?? 1,
    lastFailRewindToStage: state.lastFailRewindToStage ?? null,
    combatActionsSinceEnemyKill: state.combatActionsSinceEnemyKill ?? 0,
  }

  if (wavePhase === 'WAVE_ACTIVE') {
    return {
      ...common,
      wavePhase: 'WAVE_ACTIVE',
      enemyPieces: state.enemyPieces ?? [],
      pendingPromotion: state.pendingPromotion ?? null,
      bossCombat:
        state.bossCombat ??
        createBossCombatRuntime(state.currentStage, state.enemyPieces ?? []),
      bossWaveDeadlineMs: state.bossWaveDeadlineMs ?? null,
      waveCompleteAtMs: null,
    }
  }

  if (wavePhase === 'WAVE_COMPLETE') {
    return {
      ...common,
      wavePhase: 'WAVE_PREP',
      currentStage: (state.currentStage ?? 1) + 1,
      enemyPieces: [],
      pendingPromotion: null,
      bossCombat: null,
      waveCompleteAtMs: state.waveCompleteAtMs ?? nowMs,
    }
  }

  return {
    ...common,
    wavePhase: 'WAVE_PREP',
    enemyPieces: [],
    pendingPromotion: null,
    bossCombat: null,
    waveCompleteAtMs: null,
  }
}

/** @deprecated Use restorePersistedSession — kept for tests migrating off prep-only restore. */
export function sanitizePersistedGameState(
  state: GameState,
  nowMs = Date.now(),
): Partial<GameState> {
  return restorePersistedSession(state, nowMs)
}

/**
 * Bootstraps piece initiative timers after restore for the saved wave phase.
 */
export function bootstrapPersistedRosters(
  state: GameState,
  nowMs: number,
): { playerPieces: GameState['playerPieces']; enemyPieces: GameState['enemyPieces'] } {
  const speed = state.globalSpeedMult

  if (state.wavePhase === 'WAVE_PREP') {
    const healed = healPlayerPiecesForPrep(state.playerPieces, {
      missingHpRecoveryFraction: calculateMetaModifiers(state.metaUpgrades)
        .prepMissingHpRecoveryFraction,
    })
    return {
      playerPieces: bootstrapPiecesForCombat(healed, nowMs, speed),
      enemyPieces: [],
    }
  }

  return {
    playerPieces: bootstrapPiecesForCombat(state.playerPieces, nowMs, speed),
    enemyPieces: bootstrapPiecesForCombat(state.enemyPieces, nowMs, speed),
  }
}

export const gameStorePersistConfig: PersistenceOptions<GameState> = {
  key: GAME_SAVE_STORAGE_KEY,
  storage: resolvePersistStorage(),
  omit: PERSIST_OMIT_PATHS,
  afterHydrate: (ctx: PiniaPluginContext) => {
    const state = ctx.store.$state as GameState
    const nowMs = Date.now()
    const awayMs = nowMs - (state.lastActiveAtMs ?? nowMs)
    const offline = calculateOfflineGoldGrant({
      awayMs,
      currentStage: state.currentStage,
      wavePhase: state.wavePhase ?? 'WAVE_PREP',
      prestigeGoldMult: state.prestigeGoldMult,
      globalSpeedMult: state.globalSpeedMult,
      playerPieces: state.playerPieces,
      metaUpgrades: state.metaUpgrades,
      achievements: state.achievements,
      friendlyActionsThisStage: state.friendlyActionsThisStage,
      supporterOfflineGoldMultiplier: readPersistedSupporterOfflineMultiplier(),
    })
    const rosters = bootstrapPersistedRosters(state, nowMs)
    const metaApMult = mergeTownBonuses(
      calculateMetaModifiers(state.metaUpgrades),
      NEUTRAL_TOWN_BONUSES,
    ).apMult
    const playerPieces = refreshPlayerArmyCombatStats(
      rosters.playerPieces,
      state.currentStage,
      state.promotion.masteryLevel,
      metaApMult,
      { preserveHpRatio: state.wavePhase === 'WAVE_ACTIVE' },
    )
    const royalDecree = normalizeRoyalDecreeState(
      evaluateRoyalDecree(playerPieces, state.royalDecree),
    )

    ;(ctx.store.$patch as (patch: Partial<GameState>) => void)({
      ...restorePersistedSession(state, nowMs),
      ...rosters,
      playerPieces,
      royalDecree,
      lastActiveAtMs: nowMs,
      ...(offline.gold > 0
        ? {
            currencies: {
              ...state.currencies,
              gold: state.currencies.gold + offline.gold,
              totalGoldEarned: state.currencies.totalGoldEarned + offline.gold,
            },
            lastOfflineGoldGranted: offline.gold,
          }
        : {}),
    })

    if ((ctx.store.$state as GameState).wavePhase === 'WAVE_ACTIVE') {
      const store = ctx.store as unknown as {
        startCombatLoop: (ms?: number) => void
        beginManualPlayerTurn: (pieceId: string, ms?: number) => void
      }
      store.startCombatLoop(nowMs)
      const hydrated = ctx.store.$state as GameState
      if (
        isOnboardingTelegraphWave(
          hydrated.currentStage,
          hydrated.lifetime.onboardingTelegraphComplete ?? false,
        ) &&
        !hydrated.autoMode
      ) {
        store.beginManualPlayerTurn(ONBOARDING_PAWN_ID, nowMs)
      }
    }
  },
}
