/**
 * Wave combat loop — initiative ticks, move resolution, win/lose (Pinia action module).
 * Mutates `game` store state; orchestrated via `gameStore` hub delegates.
 */
import { defineStore, getActivePinia } from 'pinia'
import { selectBestMove } from '@/engine/aiHeuristic'
import { getEnemyMoveHeuristic } from '@/engine/enemyAiHeuristic'
import { coordKey, getAllPieces } from '@/engine/board'
import { resolveCombatMove, type CombatResult } from '@/engine/combat'
import { withDevGodModeDamage } from '@/engine/devGodMode'
import { isDevModeRuntimeEnabled } from '@/engine/devModeRuntime'
import {
  CLICK_COOLDOWN_MS,
  isClickCombatReady,
  resolveClickDamage,
} from '@/engine/clickCombat'
import { getCombatTimeMs } from '@/engine/combatTime'
import type { BoardMove } from '@/engine/moves'
import { generateLegalMoves } from '@/engine/moves'
import {
  countLivingEnemies,
  isWaveFailed,
} from '@/engine/waveState'
import {
  buildIntentTimeline,
  getPrimaryTelegraphedEnemyId,
  getTelegraphedEnemyIds,
} from '@/engine/enemyIntent'
import {
  getRoyalDecreeModifiers,
} from '@/engine/royalDecree'
import {
  getWavePatternPlayerApMult,
  resolveWavePatternForStage,
  createDefaultDojoModules,
} from '@/engine/wavePatterns'
import {
  shouldGrantTempoBonus,
  TEMPO_INITIATIVE_MULT,
  applyTempoIntervalMult,
} from '@/engine/tempoBonus'
import {
  bootstrapPiecesForCombat,
  getNextReadyActor,
  getPieceIntervalMs,
  processReadyInitiativeActions,
  scheduleNextAction,
  syncInitiativeProgress,
} from '@/engine/initiative'
import { isBossStage } from '@/engine/stageManager'
import {
  computeFailWaveResolution,
  computeWaveClearGold,
  evaluateWaveOutcomeState,
  kingFailLabels,
} from '@/engine/waveLifecycle'
import { getWaveCheckpointStage } from '@/engine/waveCheckpoints'
import {
  playCombatFeedbackAudio,
  playGameSfx,
} from '@/store/gameAudioBridge'
import {
  applyBossDamageReduction,
  applyKingReflectDamage,
  calculateIronRookReflectDamage,
  tickBossMechanics,
} from '@/engine/bossMechanics'
import { evaluateBossTrophyAward } from '@/engine/bossTrophies'
import {
  attributionFromEnemyMove,
  formatKingFailTelegraph,
} from '@/engine/kingFailAttribution'
import { isBossWaveTimedOut } from '@/engine/bossTimer'
import { getGrandmasterCombatModifiers } from '@/engine/grandmasterBoss'
import {
  accumulateWaveCombatStats,
  buildDefeatReport,
  buildVictoryReport,
} from '@/engine/waveOutcome'
import {
  nextCombatActionsSinceEnemyKill,
  shouldFailWaveForCombatStall,
} from '@/engine/waveCombatPacing'
import { resolveEnemyPawnLeaks } from '@/engine/pawnLeak'
import {
  buildPromotionContext,
  runPromotionPipeline,
  updatePlayerPiece,
} from '@/store/promotionActions'
import {
  getAvailablePromotionForms,
} from '@/engine/promotion'
import {
  consumeRevivalFlashAction,
  getRevivalFlashApMult,
  isPieceInvulnerable,
  tryImmortalRevive,
} from '@/engine/immortalGame'
import {
  createCombatFeedback,
  feedbackFromCombatMove,
  IMPACT_FRAME_MS,
  IMPACT_ZOOM_MS,
  isImpactFrameActive as isCombatImpactFrozen,
  pruneCombatFeedback,
  SCREEN_SHAKE_MS,
} from '@/engine/combatFeedback'
import {
  calculateActiveMult,
  STAMINA_CLICK_COST,
  STAMINA_REGEN_PER_SEC,
  type ChessPiece,
  type GameState,
  type KingFailAttribution,
  type SuperPromotionForm,
} from '@/types/game'
import { useMetaStore } from '@/store/metaStore'
import { useGameStore } from '@/store/gameStore'
import { useEconomyStore } from '@/store/economyStore'

/** Last player combat resolution — used for tempo bonus detection (not persisted). */
let lastResolvedPlayerCombat: CombatResult | null = null

export interface CombatTickResult {
  actedCount: number
  enemyActedCount: number
  goldEarned: number
  actedPieceIds: string[]
  enemyActedPieceIds: string[]
}

function game() {
  return useGameStore()
}

function economy() {
  return useEconomyStore()
}

function readGameState(): GameState {
  return game().$state as GameState
}

export const useCombatStore = defineStore('combat', {
  actions: {
    evaluateWaveOutcome(): void {
      const g = game()
      const outcome = evaluateWaveOutcomeState(
        g.wavePhase,
        g.playerPieces,
        g.enemyPieces,
      )
      if (outcome.shouldFail) {
        this.failWave()
        return
      }
      if (outcome.shouldComplete) {
        this.completeWave()
      }
    },

    completeWave(nowMs = Date.now()): void {
      const g = game()
      const econ = economy()
      if (g.wavePhase !== 'WAVE_ACTIVE') return
      g.manualPendingPieceId = null
      g.prepPendingPieceId = null
      this.stopCombatLoop()

      const clearedStage = g.currentStage
      const nextStage = clearedStage + 1
      const clearGold = computeWaveClearGold(
        clearedStage,
        g.playerPieces.filter((p) => p.side === 'player').length,
      )
      g.waveCombatStats = accumulateWaveCombatStats(g.waveCombatStats, {
        goldFromClear: clearGold,
      })
      econ.addGold(clearGold)
      econ.incrementCombo(nowMs)

      const trophy = evaluateBossTrophyAward(clearedStage, g.bossTrophiesClaimed)
      if (trophy) {
        g.bossTrophiesClaimed = [...g.bossTrophiesClaimed, trophy.stage]
        g.currencies.trophies += 1
        g.lastTrophyEarned = trophy.trophyName
      }
      const statsSnapshot = { ...g.waveCombatStats }
      g.enemyPieces = []
      g.bossCombat = null
      g.bossWaveDeadlineMs = null
      g.wavePhase = 'WAVE_COMPLETE'
      g.lifetime.lifetimeWavesCleared =
        (g.lifetime.lifetimeWavesCleared ?? 0) + 1
      g.armyVictoryGlowBurstUntilMs = nowMs + 1400
      for (const piece of g.playerPieces) {
        this.pulsePieceJuice(piece.id, nowMs)
      }
      playGameSfx('waveClear')

      g.waveOutcomeReport = buildVictoryReport({
        foughtStage: clearedStage,
        nextStage,
        stats: statsSnapshot,
        trophyName: trophy?.trophyName ?? null,
        checkpointStage: getWaveCheckpointStage(Math.max(g.maxStageReached, nextStage)),
      })
      g.waveCompleteAtMs = null
    },

    failWave(nowMs = Date.now()): void {
      const g = game()
      if (g.wavePhase !== 'WAVE_ACTIVE') return
      const foughtStage = g.currentStage
      const statsSnapshot = { ...g.waveCombatStats }
      const fail = computeFailWaveResolution(
        g.currentStage,
        g.maxStageReached,
        g.failCountThisStage,
        g.enemyHpScale,
      )
      g.currentStage = fail.currentStage
      g.failCountThisStage = fail.failCountThisStage
      g.enemyHpScale = fail.enemyHpScale
      g.waveCheckpointStage = fail.waveCheckpointStage
      g.lastFailRewindToStage = fail.lastFailRewindToStage
      g.waveCompleteAtMs = null

      const kingLabels = kingFailLabels(g.playerPieces)
      g.lastWaveFailReason = 'king-fallen'
      g.lastKingFailDetail = kingLabels.lastKingFailDetail
      if (!g.lastKingFailAttribution) {
        g.lastKingFailAttribution = kingLabels.defaultAttribution
      }
      g.manualPendingPieceId = null
      g.pendingPromotion = null
      this.stopCombatLoop()
      playGameSfx('fail')
      g.screenShakeUntilMs = nowMs + SCREEN_SHAKE_MS

      const kingFailMsg =
        g.lastKingFailDetail === 'missing'
          ? 'Your King was captured.'
          : 'Your King was defeated.'
      const rewindMsg =
        g.lastFailRewindToStage !== null
          ? ` Returned to milestone wave ${g.lastFailRewindToStage}.`
          : ''
      const softMsg =
        g.failCountThisStage > 0
          ? ` Enemies at ${Math.round(g.enemyHpScale * 100)}% HP this stage.`
          : ''

      g.waveOutcomeReport = buildDefeatReport({
        foughtStage,
        nextStage: g.currentStage,
        stats: statsSnapshot,
        failRewindToStage: g.lastFailRewindToStage,
        checkpointStage: g.waveCheckpointStage,
        failCountThisStage: g.failCountThisStage,
        enemyHpScale: g.enemyHpScale,
        kingFallMessage: `${kingFailMsg}${rewindMsg}${softMsg} Position your army and start again.`,
        kingFallTelegraph: formatKingFailTelegraph(
          g.lastKingFailAttribution,
          g.lastKingFailDetail,
          g.lastPawnLeakDamage,
        ),
      })

      g.enterWavePrep(nowMs)
    },

    checkBossWaveTimeout(nowMs = Date.now()): void {
      const g = game()
      if (g.wavePhase !== 'WAVE_ACTIVE') return
      if (!isBossWaveTimedOut(g.bossWaveDeadlineMs, nowMs)) return
      this.recordKingFailAttribution({ source: 'timeout' })
      this.failWave(nowMs)
    },

    syncCombatPacingAfterAction(
      enemiesBefore: ChessPiece[],
      nowMs = Date.now(),
    ): void {
      const g = game()
      if (g.wavePhase !== 'WAVE_ACTIVE') return

      g.combatActionsSinceEnemyKill = nextCombatActionsSinceEnemyKill(
        g.combatActionsSinceEnemyKill,
        enemiesBefore,
        g.enemyPieces,
      )

      if (
        shouldFailWaveForCombatStall({
          livingEnemies: countLivingEnemies(g.enemyPieces),
          combatActionsSinceEnemyKill: g.combatActionsSinceEnemyKill,
          stageStartedAtMs: g.stageStartedAtMs,
          nowMs,
          isBossStage: isBossStage(g.currentStage),
          hasBossDeadline: g.bossWaveDeadlineMs !== null,
        })
      ) {
        if (!g.lastKingFailAttribution) {
          this.recordKingFailAttribution({ source: 'stall' })
        }
        this.failWave(nowMs)
      }
    },

    pushCombatFeedback(
      events: ReturnType<typeof createCombatFeedback>[],
      nowMs = Date.now(),
    ): void {
      const g = game()
      if (events.length === 0) return
      g.combatFeedbackEvents = [...g.combatFeedbackEvents, ...events]
      if (events.some((event) => event.kind === 'capture')) {
        g.screenShakeUntilMs = nowMs + SCREEN_SHAKE_MS
      }
      if (events.some((event) => event.heavy)) {
        g.impactFreezeUntilMs = nowMs + IMPACT_FRAME_MS
        g.boardZoomUntilMs = nowMs + IMPACT_ZOOM_MS
        g.screenShakeUntilMs = Math.max(
          g.screenShakeUntilMs,
          nowMs + SCREEN_SHAKE_MS,
        )
      }
      playCombatFeedbackAudio(events)
    },

    pulsePieceJuice(pieceId: string, nowMs = Date.now()): void {
      const g = game()
      g.pieceJuicePulseUntilMs = {
        ...g.pieceJuicePulseUntilMs,
        [pieceId]: nowMs + 720,
      }
    },

    prunePieceJuicePulse(nowMs = Date.now()): void {
      const g = game()
      const next: Record<string, number> = {}
      for (const [id, until] of Object.entries(g.pieceJuicePulseUntilMs)) {
        if (until > nowMs) next[id] = until
      }
      g.pieceJuicePulseUntilMs = next
    },

    pruneCombatFeedback(nowMs = Date.now()): void {
      const g = game()
      g.combatFeedbackEvents = pruneCombatFeedback(g.combatFeedbackEvents, nowMs)
    },

    completeOnboardingTelegraph(): void {
      const g = game()
      g.lifetime = {
        ...g.lifetime,
        onboardingTelegraphComplete: true,
      }
      if (g.wavePhase === 'WAVE_ACTIVE' && g.currentStage === 1) {
        this.completeWave()
      }
    },

    refreshEnemyIntent(nowMs = game().lastSimulatedMs): void {
      const g = game()
      const timeline = buildIntentTimeline(
        g.playerPieces,
        g.enemyPieces,
        nowMs,
        g.globalSpeedMult,
        g.intentSpeedMults,
      )
      g.telegraphedEnemyIds = getTelegraphedEnemyIds(timeline)
    },

    grantTempoBonus(coord: { file: number; rank: number }, nowMs = Date.now()): void {
      const g = game()
      g.playerTempoHasteMult = TEMPO_INITIATIVE_MULT
      this.pushCombatFeedback(
        [createCombatFeedback('clash', coord, nowMs, undefined, { heavy: true })],
        nowMs,
      )
      playGameSfx('capture')
      if (g.showOnboardingTelegraph) {
        this.completeOnboardingTelegraph()
      }
    },

    startCombatLoop(nowMs = Date.now()): void {
      const g = game()
      g.combatLoopRunning = true
      g.lastSimulatedMs = nowMs
      g.playerPieces = bootstrapPiecesForCombat(
        g.playerPieces,
        nowMs,
        g.globalSpeedMult,
      )
    },

    stopCombatLoop(): void {
      game().combatLoopRunning = false
    },

    recordKingFailAttribution(attribution: KingFailAttribution): void {
      game().lastKingFailAttribution = attribution
    },

    beginManualPlayerTurn(pieceId: string, nowMs = Date.now()): void {
      const g = game()
      const piece = g.playerPieces.find((p) => p.id === pieceId)
      if (!piece) return

      const decreeMods = getRoyalDecreeModifiers(g.royalDecree)
      const moves = generateLegalMoves(piece, {
        allPieces: getAllPieces(g.playerPieces, g.enemyPieces),
        decreeStepEnabled: decreeMods.decreeStepEnabled,
      })

      if (moves.length === 0) {
        const index = g.playerPieces.findIndex((p) => p.id === pieceId)
        if (index !== -1) {
          g.playerPieces[index] = scheduleNextAction(
            g.playerPieces[index]!,
            nowMs,
            g.globalSpeedMult,
          )
        }
        g.manualPendingPieceId = null
        g.lastSimulatedMs = nowMs
        this.syncCombatPacingAfterAction([...g.enemyPieces], nowMs)
        if (g.wavePhase !== 'WAVE_ACTIVE') return
        this.evaluateWaveOutcome()
        return
      }

      g.manualPendingPieceId = pieceId
      g.combatFocus = 'move'
    },

    skipManualTurn(nowMs = Date.now()): boolean {
      const g = game()
      if (g.autoMode || g.wavePhase !== 'WAVE_ACTIVE') return false
      const pieceId = g.manualPendingPieceId
      if (!pieceId) return false

      const index = g.playerPieces.findIndex((piece) => piece.id === pieceId)
      if (index === -1) return false

      g.playerPieces[index] = scheduleNextAction(
        g.playerPieces[index]!,
        nowMs,
        g.globalSpeedMult,
      )
      g.manualPendingPieceId = null
      g.lastSimulatedMs = nowMs
      g.playerPieces = syncInitiativeProgress(
        g.playerPieces,
        nowMs,
        g.globalSpeedMult,
      )
      this.syncCombatPacingAfterAction([...g.enemyPieces], nowMs)
      if (g.wavePhase !== 'WAVE_ACTIVE') return true
      this.evaluateWaveOutcome()
      playGameSfx('uiClick')
      return true
    },

    scheduleEnemyAfterAction(pieceId: string, nowMs = Date.now()): void {
      const g = game()
      const index = g.enemyPieces.findIndex((piece) => piece.id === pieceId)
      if (index === -1) return
      g.enemyPieces[index] = scheduleNextAction(
        g.enemyPieces[index]!,
        nowMs,
        g.globalSpeedMult,
      )
    },

    schedulePlayerAfterAction(pieceId: string, nowMs = Date.now()): void {
      const g = game()
      const index = g.playerPieces.findIndex((piece) => piece.id === pieceId)
      if (index === -1) return
      const gm = getGrandmasterCombatModifiers(g.bossCombat, g.enemyPieces)
      const speed = g.globalSpeedMult * gm.playerInitiativeMult
      let piece = scheduleNextAction(g.playerPieces[index]!, nowMs, speed)
      if (g.playerTempoHasteMult < 1) {
        const intervalMs = applyTempoIntervalMult(
          getPieceIntervalMs(piece, speed),
          g.playerTempoHasteMult,
        )
        piece = {
          ...piece,
          initiative: {
            ...piece.initiative,
            nextActionAtMs: nowMs + intervalMs,
            progress: 0,
          },
        }
        g.playerTempoHasteMult = 1
      }
      g.playerPieces[index] = piece
    },

    processPromotionForPiece(pieceId: string, chosenForm?: SuperPromotionForm): number {
      const g = game()
      const econ = economy()
      const piece = g.playerPieces.find((p) => p.id === pieceId)
      if (!piece) return 0

      const pipeline = runPromotionPipeline(
        piece,
        buildPromotionContext(readGameState()),
        g.enemyPieces,
        g.promotion.streak,
        chosenForm,
        g.enPassantCarryByPieceId[pieceId],
      )

      g.playerPieces = updatePlayerPiece(g.playerPieces, pieceId, pipeline.piece)
      g.syncPlayerArmyCombatStats(true)

      if (pipeline.pendingPlayerChoice) {
        g.pendingPromotion = {
          pieceId,
          availableForms: getAvailablePromotionForms(g.currentStage),
        }
        this.stopCombatLoop()
        return 0
      }

      if (pipeline.fanfareGold > 0) {
        if (g.wavePhase === 'WAVE_ACTIVE') {
          g.waveCombatStats = accumulateWaveCombatStats(g.waveCombatStats, {
            goldFromPromotion: pipeline.fanfareGold,
          })
        }
        econ.addGold(pipeline.fanfareGold)
        playGameSfx('promotion')
      }
      g.promotion.streak = pipeline.nextStreak
      g.pendingPromotion = null
      return pipeline.fanfareGold
    },

    choosePromotionForm(form: SuperPromotionForm, nowMs = Date.now()): void {
      const g = game()
      if (!g.pendingPromotion) return
      this.processPromotionForPiece(g.pendingPromotion.pieceId, form)
      playGameSfx('promotion')
      this.startCombatLoop(nowMs)
    },

    dismissPendingPromotion(): void {
      game().pendingPromotion = null
      this.startCombatLoop()
    },

    executePlayerManualMove(move: BoardMove, nowMs = Date.now()): number {
      const g = game()
      if (g.wavePhase !== 'WAVE_ACTIVE' || g.autoMode) return 0
      if (g.manualPendingPieceId !== move.pieceId) return 0

      const legal = g.manualLegalMoves
      const isLegal = legal.some(
        (m) => m.to.file === move.to.file && m.to.rank === move.to.rank && m.pieceId === move.pieceId,
      )
      if (!isLegal) return 0

      const enemiesBefore = [...g.enemyPieces]
      const telegraphed = [...g.telegraphedEnemyIds]
      const primaryTelegraphed = getPrimaryTelegraphedEnemyId(g.enemyIntentTimeline)
      const gold = this.resolvePlayerMove(move, nowMs, { trackCombat: true })
      const combat = lastResolvedPlayerCombat
      if (
        combat &&
        shouldGrantTempoBonus({
          telegraphedEnemyIds: telegraphed,
          primaryTelegraphedId: primaryTelegraphed,
          move,
          combat,
          enemiesBefore,
          manualOnly: true,
          isManualMove: true,
        })
      ) {
        this.grantTempoBonus(move.to, nowMs)
      }
      const index = g.playerPieces.findIndex((p) => p.id === move.pieceId)
      if (index !== -1) {
        g.playerPieces[index] = scheduleNextAction(
          g.playerPieces[index]!,
          nowMs,
          g.globalSpeedMult,
        )
      }
      g.manualPendingPieceId = null
      g.lastSimulatedMs = nowMs
      g.playerPieces = syncInitiativeProgress(
        g.playerPieces,
        nowMs,
        g.globalSpeedMult,
      )
      this.evaluateWaveOutcome()
      return gold
    },

    resolvePlayerMove(
      move: BoardMove,
      nowMs = Date.now(),
      options?: { trackCombat?: boolean },
    ): number {
      const g = game()
      const econ = economy()
      const piece = g.playerPieces.find((p) => p.id === move.pieceId)
      if (!piece) return 0

      const enemiesBefore = [...g.enemyPieces]

      const decreeMods = getRoyalDecreeModifiers(g.royalDecree)
      const kingMult =
        piece.kind === 'king' && g.royalDecree.isActive ? decreeMods.kingAttackMult : 1
      const pinia = getActivePinia()
      const metaModules =
        pinia != null
          ? useMetaStore(pinia).dojoModules
          : createDefaultDojoModules()
      const pattern = resolveWavePatternForStage(g.currentStage)
      const patternApMult = getWavePatternPlayerApMult(pattern, metaModules, piece.kind)
      const apMult = kingMult * getRevivalFlashApMult(piece) * patternApMult
      const bossRuntime = g.bossCombat
      const bossAdjust = bossRuntime
        ? (raw: number, defender: ChessPiece) =>
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
        : undefined
      const combat = resolveCombatMove(move, g.playerPieces, g.enemyPieces, {
        stage: g.currentStage,
        activeMult: calculateActiveMult(g.combo.count),
        royalDecreeActive: g.royalDecree.isActive,
        attackerApMult: apMult,
        adjustDamage: withDevGodModeDamage(bossAdjust),
      })
      g.playerPieces = combat.playerPieces
      g.enemyPieces = combat.enemyPieces
      if (options?.trackCombat) {
        lastResolvedPlayerCombat = combat
      }
      g.reconcileBoardPositions()
      const targetBefore = move.capturedPieceId
        ? enemiesBefore.find((p) => p.id === move.capturedPieceId)
        : enemiesBefore.find((p) => coordKey(p.position) === coordKey(move.to))
      this.pushCombatFeedback(
        feedbackFromCombatMove(move, combat, nowMs, {
          targetIsBoss: targetBefore?.isBoss,
          attackerHasSuper: Boolean(piece.superPromotion),
          defenderMaxHp: targetBefore?.stats.maxHp,
          attackerKind: piece.kind,
        }),
        nowMs,
      )

      if (combat.damageDealt > 0) {
        g.waveCombatStats = accumulateWaveCombatStats(g.waveCombatStats, {
          damageDealt: combat.damageDealt,
        })
      }
      if (combat.captured) {
        g.waveCombatStats = accumulateWaveCombatStats(g.waveCombatStats, {
          captures: 1,
        })
      }

      if (bossRuntime && combat.damageDealt > 0) {
        const defender = targetBefore
          ? g.enemyPieces.find((p) => p.id === targetBefore.id)
          : g.enemyPieces.find(
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
            g.playerPieces = applyKingReflectDamage(g.playerPieces, reflect)
            g.waveCombatStats = accumulateWaveCombatStats(g.waveCombatStats, {
              damageTaken: reflect,
            })
          }
        }
      }

      const actorIndex = g.playerPieces.findIndex((p) => p.id === move.pieceId)
      if (actorIndex !== -1) {
        g.playerPieces[actorIndex] = consumeRevivalFlashAction(g.playerPieces[actorIndex]!)
      }

      let captureGold = 0
      if (combat.captureGold > 0) {
        g.waveCombatStats = accumulateWaveCombatStats(g.waveCombatStats, {
          goldFromCaptures: combat.captureGold,
        })
        econ.addGold(combat.captureGold)
        captureGold += combat.captureGold
        econ.incrementCombo(nowMs)
      }

      const actingPiece = g.playerPieces.find((p) => p.id === move.pieceId)
      if (actingPiece) {
        captureGold += this.processPromotionForPiece(move.pieceId)
      }

      if (g.pendingPromotion) {
        this.syncCombatPacingAfterAction(enemiesBefore, nowMs)
        if (g.wavePhase !== 'WAVE_ACTIVE') return captureGold
        this.evaluateWaveOutcome()
        return captureGold
      }

      const actionGold = econ.awardActionGold({
        applyActiveMult: !g.autoMode,
        incrementCombo: !g.autoMode,
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
      if (g.wavePhase !== 'WAVE_ACTIVE') return captureGold
      this.evaluateWaveOutcome()
      return captureGold
    },

    resolveEnemyMove(move: BoardMove, nowMs = Date.now()): void {
      const g = game()
      const econ = economy()
      const enemiesBefore = [...g.enemyPieces]
      const playerBefore = g.playerPieces
      const attackerBefore = enemiesBefore.find((p) => p.id === move.pieceId)
      const defender =
        move.capturedPieceId && move.side === 'enemy'
          ? playerBefore.find((p) => p.id === move.capturedPieceId)
          : undefined
      const combat = resolveCombatMove(move, g.playerPieces, g.enemyPieces, {
        stage: g.currentStage,
        activeMult: 1,
        royalDecreeActive: false,
        defenderInvulnerable: defender ? isPieceInvulnerable(defender, nowMs) : false,
        adjustDamage: withDevGodModeDamage(undefined),
      })
      g.enemyPieces = combat.enemyPieces
      this.pushCombatFeedback(
        feedbackFromCombatMove(move, combat, nowMs, {
          attackerKind: attackerBefore?.kind,
        }),
        nowMs,
      )

      if (combat.damageDealt > 0 && defender?.side === 'player') {
        g.waveCombatStats = accumulateWaveCombatStats(g.waveCombatStats, {
          damageTaken: combat.damageDealt,
        })
      }

      if (combat.captured && move.capturedPieceId && move.side === 'enemy') {
        const meta = g.metaModifiers
        const revived = tryImmortalRevive(
          playerBefore,
          combat.playerPieces,
          move.capturedPieceId,
          meta.hasImmortalGame,
          g.immortalGameUsedThisStage,
          nowMs,
        )
        g.playerPieces = revived.pieces
        if (revived.used) {
          g.immortalGameUsedThisStage = true
        }
      } else {
        g.playerPieces = combat.playerPieces
      }
      g.reconcileBoardPositions()

      const attacker = g.enemyPieces.find((p) => p.id === move.pieceId)
      const kingBefore = playerBefore.find((p) => p.side === 'player' && p.kind === 'king')
      const kingAfter = g.playerPieces.find((p) => p.side === 'player' && p.kind === 'king')
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
      econ.applyComboDecay(nowMs)
      this.syncCombatPacingAfterAction(enemiesBefore, nowMs)
      if (g.wavePhase !== 'WAVE_ACTIVE') return
      this.evaluateWaveOutcome()
    },

    processEnemyPawnLeaks(): void {
      const g = game()
      const leak = resolveEnemyPawnLeaks(
        g.playerPieces,
        g.enemyPieces,
        g.currentStage,
      )
      if (leak.totalDamage <= 0) return
      g.playerPieces = leak.playerPieces
      g.enemyPieces = leak.enemyPieces
      g.lastPawnLeakDamage = leak.totalDamage
      g.waveCombatStats = accumulateWaveCombatStats(g.waveCombatStats, {
        damageTaken: leak.totalDamage,
      })
      const king = g.playerPieces.find((p) => p.kind === 'king')
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
        g.screenShakeUntilMs = Date.now() + SCREEN_SHAKE_MS
      }
      if (isWaveFailed(g.playerPieces)) {
        this.recordKingFailAttribution({
          source: 'leak',
          leakDamage: leak.totalDamage,
        })
      }
      this.evaluateWaveOutcome()
    },

    tickBossAfterEnemyAction(actedEnemyId: string, nowMs = Date.now()): void {
      const g = game()
      if (!g.bossCombat) return
      const result = tickBossMechanics(
        g.bossCombat,
        g.currentStage,
        g.playerPieces,
        g.enemyPieces,
        actedEnemyId,
        nowMs,
        g.globalSpeedMult,
      )
      g.bossCombat = result.runtime
      g.playerPieces = result.playerPieces
      g.enemyPieces = result.enemyPieces
      this.evaluateWaveOutcome()
    },

    executeEnemyMove(pieceId: string, nowMs = Date.now()): boolean {
      const g = game()
      const piece = g.enemyPieces.find((p) => p.id === pieceId)
      if (!piece) return false

      const allPieces = getAllPieces(g.playerPieces, g.enemyPieces)
      const move = getEnemyMoveHeuristic(piece, {
        allPieces,
        decreeStepEnabled: false,
        movingPiece: piece,
      })

      if (move) {
        this.resolveEnemyMove(move, nowMs)
        if (g.wavePhase === 'WAVE_ACTIVE') {
          this.tickBossAfterEnemyAction(pieceId, nowMs)
        }
      }
      return move !== null
    },

    tickEnemyInitiative(nowMs = Date.now()): string[] {
      const g = game()
      const result = processReadyInitiativeActions(
        g.enemyPieces,
        nowMs,
        g.globalSpeedMult,
      )
      g.enemyPieces = result.pieces

      const actedIds: string[] = []
      for (const pieceId of result.actedPieceIds) {
        if (this.executeEnemyMove(pieceId, nowMs)) {
          actedIds.push(pieceId)
        }
        if (g.wavePhase !== 'WAVE_ACTIVE') break
      }

      g.enemyPieces = syncInitiativeProgress(
        g.enemyPieces,
        nowMs,
        g.globalSpeedMult,
      )
      return actedIds
    },

    executePlayerAutoMove(pieceId: string, nowMs = Date.now()): number {
      const g = game()
      const piece = g.playerPieces.find((p) => p.id === pieceId)
      if (!piece) return 0

      const allPieces = getAllPieces(g.playerPieces, g.enemyPieces)
      const decreeMods = getRoyalDecreeModifiers(g.royalDecree)
      const meta = g.metaModifiers
      const move = selectBestMove(piece, {
        allPieces,
        decreeStepEnabled: decreeMods.decreeStepEnabled,
        royalDecreeActive: g.royalDecree.isActive,
        personality: g.effectiveAutoAiPersonality,
        movingPiece: piece,
        aiScoreMult: meta.aiScoreMult,
      })

      let captureGold = 0

      if (move) {
        captureGold += this.resolvePlayerMove(move, nowMs)
      }

      if (g.pendingPromotion) {
        return captureGold
      }

      return captureGold
    },

    regenStamina(deltaSec: number): void {
      const g = game()
      if (!Number.isFinite(deltaSec) || deltaSec <= 0) return
      const decreeMult = getRoyalDecreeModifiers(g.royalDecree).staminaRegenMult
      const rate = STAMINA_REGEN_PER_SEC * decreeMult
      g.stamina.current = Math.min(g.stamina.max, g.stamina.current + rate * deltaSec)
    },

    spendStaminaForClick(): boolean {
      const g = game()
      if (isDevModeRuntimeEnabled()) return true
      if (g.stamina.current < STAMINA_CLICK_COST) return false
      g.stamina.current -= STAMINA_CLICK_COST
      return true
    },

    clickEnemyPiece(enemyPieceId: string, nowMs = Date.now()): number {
      const g = game()
      const econ = economy()
      if (g.wavePhase !== 'WAVE_ACTIVE') return 0
      if (isWaveFailed(g.playerPieces)) return 0
      if (g.combatFocus !== 'strike') return 0

      const enemy = g.enemyPieces.find((piece) => piece.id === enemyPieceId)
      if (!enemy || enemy.side !== 'enemy') return 0

      const combatNow = getCombatTimeMs({
        autoMode: g.autoMode,
        manualPendingPieceId: g.manualPendingPieceId,
        lastSimulatedMs: g.lastSimulatedMs,
        nowMs,
      })
      if (!isClickCombatReady(g.clickCombatReadyAtMs, combatNow)) return 0
      if (!this.spendStaminaForClick()) return 0

      econ.applyComboDecay(nowMs)
      econ.incrementCombo(nowMs)

      const enemiesBefore = [...g.enemyPieces]
      const gmMods = g.grandmasterCombatModifiers
      const activeMult = calculateActiveMult(g.combo.count) * gmMods.clickDamageMult
      const bossRuntime = g.bossCombat
      const coord = enemy.position

      const clickBossAdjust = bossRuntime
        ? (raw: number, defender: ChessPiece) =>
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
        : undefined
      const result = resolveClickDamage(
        enemyPieceId,
        g.playerPieces,
        g.enemyPieces,
        {
          clickPowerLevel: g.clickPowerLevel,
          activeMult,
          stage: g.currentStage,
          royalDecreeActive: g.royalDecree.isActive,
          adjustDamage: withDevGodModeDamage(clickBossAdjust),
        },
      )

      g.playerPieces = result.playerPieces
      g.enemyPieces = result.enemyPieces

      if (result.damageDealt > 0) {
        g.waveCombatStats = accumulateWaveCombatStats(g.waveCombatStats, {
          damageDealt: result.damageDealt,
        })
      }
      if (result.captured) {
        g.waveCombatStats = accumulateWaveCombatStats(g.waveCombatStats, {
          captures: 1,
        })
      }

      const clickHeavy =
        result.captured &&
        (enemy.isBoss || Boolean(g.playerPieces.some((p) => p.superPromotion)))
      if (result.captured) {
        this.pushCombatFeedback(
          [
            createCombatFeedback('capture', coord, nowMs, undefined, {
              heavy: clickHeavy,
              attackerKind: 'king',
            }),
          ],
          nowMs,
        )
      } else if (result.damageDealt > 0) {
        this.pushCombatFeedback(
          [
            createCombatFeedback('clash', coord, nowMs, result.damageDealt, {
              heavy: clickHeavy,
              attackerKind: 'king',
            }),
          ],
          nowMs,
        )
      }

      let goldEarned = 0
      if (result.captureGold > 0) {
        g.waveCombatStats = accumulateWaveCombatStats(g.waveCombatStats, {
          goldFromCaptures: result.captureGold,
        })
        econ.addGold(result.captureGold)
        goldEarned += result.captureGold
      }

      const actionGold = econ.awardActionGold({
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

      g.clickCombatReadyAtMs = combatNow + CLICK_COOLDOWN_MS
      this.syncCombatPacingAfterAction(enemiesBefore, nowMs)
      if (g.wavePhase !== 'WAVE_ACTIVE') return result.damageDealt
      this.evaluateWaveOutcome()
      return result.damageDealt
    },

    tickCombat(nowMs = Date.now()): CombatTickResult {
      const g = game()
      const econ = economy()
      const empty: CombatTickResult = {
        actedCount: 0,
        enemyActedCount: 0,
        goldEarned: 0,
        actedPieceIds: [],
        enemyActedPieceIds: [],
      }

      if (!g.combatLoopRunning || g.wavePhase !== 'WAVE_ACTIVE') {
        return empty
      }

      this.prunePieceJuicePulse(nowMs)

      if (isCombatImpactFrozen(g.impactFreezeUntilMs, nowMs)) {
        this.pruneCombatFeedback(nowMs)
        return empty
      }

      if (g.pendingPromotion) {
        return empty
      }

      this.checkBossWaveTimeout(nowMs)
      if (g.wavePhase !== 'WAVE_ACTIVE') {
        return empty
      }

      if (
        shouldFailWaveForCombatStall({
          livingEnemies: countLivingEnemies(g.enemyPieces),
          combatActionsSinceEnemyKill: g.combatActionsSinceEnemyKill,
          stageStartedAtMs: g.stageStartedAtMs,
          nowMs,
          isBossStage: isBossStage(g.currentStage),
          hasBossDeadline: g.bossWaveDeadlineMs !== null,
        })
      ) {
        if (!g.lastKingFailAttribution) {
          this.recordKingFailAttribution({ source: 'stall' })
        }
        this.failWave(nowMs)
        return empty
      }

      const playerSpeed = g.effectivePlayerSpeedMult

      const combatTimePaused =
        !g.autoMode && g.manualPendingPieceId !== null

      if (!combatTimePaused) {
        const deltaSec = Math.max(0, (nowMs - g.lastSimulatedMs) / 1000)
        if (deltaSec > 0) {
          this.regenStamina(deltaSec)
        }
        g.lastSimulatedMs = nowMs
      }

      econ.applyComboDecay(nowMs)
      this.pruneCombatFeedback(nowMs)
      this.refreshEnemyIntent(nowMs)

      let actedPieceIds: string[] = []
      let goldEarned = 0

      if (g.autoMode) {
        g.touchSessionActivity(nowMs)
        g.playerPieces = syncInitiativeProgress(
          g.playerPieces,
          nowMs,
          playerSpeed,
        )
        g.enemyPieces = syncInitiativeProgress(
          g.enemyPieces,
          nowMs,
          g.globalSpeedMult,
        )

        const actor = getNextReadyActor(g.playerPieces, g.enemyPieces, nowMs)
        let enemyActedPieceIds: string[] = []

        if (actor?.side === 'enemy') {
          if (this.executeEnemyMove(actor.id, nowMs)) {
            enemyActedPieceIds = [actor.id]
          }
          this.scheduleEnemyAfterAction(actor.id, nowMs)
          g.enemyPieces = syncInitiativeProgress(
            g.enemyPieces,
            nowMs,
            g.globalSpeedMult,
          )
        } else if (actor?.side === 'player') {
          goldEarned += this.executePlayerAutoMove(actor.id, nowMs)
          this.schedulePlayerAfterAction(actor.id, nowMs)
          g.playerPieces = syncInitiativeProgress(
            g.playerPieces,
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

      const combatNow = getCombatTimeMs({
        autoMode: g.autoMode,
        manualPendingPieceId: g.manualPendingPieceId,
        lastSimulatedMs: g.lastSimulatedMs,
        nowMs,
      })
      g.playerPieces = syncInitiativeProgress(
        g.playerPieces,
        combatNow,
        playerSpeed,
      )
      g.enemyPieces = syncInitiativeProgress(
        g.enemyPieces,
        combatNow,
        g.globalSpeedMult,
      )

      if (g.manualPendingPieceId) {
        return empty
      }

      const actor = getNextReadyActor(g.playerPieces, g.enemyPieces, nowMs)
      let enemyActedPieceIds: string[] = []

      if (actor?.side === 'enemy') {
        if (this.executeEnemyMove(actor.id, nowMs)) {
          enemyActedPieceIds = [actor.id]
        }
        this.scheduleEnemyAfterAction(actor.id, nowMs)
        g.enemyPieces = syncInitiativeProgress(
          g.enemyPieces,
          nowMs,
          g.globalSpeedMult,
        )
        this.evaluateWaveOutcome()
        if (g.wavePhase !== 'WAVE_ACTIVE') {
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
        if (!g.manualPendingPieceId) {
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
  },
})
