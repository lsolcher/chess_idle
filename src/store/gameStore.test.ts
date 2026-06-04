import { beforeEach, describe, expect, it } from 'vitest'
import { createBossCombatRuntime } from '@/engine/bossMechanics'
import {
  GRANDMASTER_PHASE3_CLICK_MULT,
  GRANDMASTER_PHASE3_INITIATIVE_MULT,
} from '@/engine/grandmasterBoss'
import { listGhostArmies } from '@/engine/ghostSystem'
import { applySuperPromotion } from '@/engine/promotion'
import { COMBO_CAP, COMBO_DECAY_MS, createPiece } from '@/types/game'
import {
  createPiniaForTest,
  PRESTIGE_UNLOCK_STAGE,
  runGameStoreSanityCheck,
  useGameStore,
} from './gameStore'

describe('useGameStore', () => {
  beforeEach(() => {
    createPiniaForTest()
  })

  it('initializes with GDD default run state', () => {
    const store = useGameStore()
    store.initGame(0)

    expect(store.gold).toBe(0)
    expect(store.eloShards).toBe(0)
    expect(store.currentStage).toBe(1)
    expect(store.comboCount).toBe(0)
    expect(store.activeMult).toBeCloseTo(1.5)
    expect(store.isRoyalDecreeActive).toBe(true)
    expect(store.playerPieceCount).toBe(1)
    expect(store.canPrestige).toBe(false)
    expect(store.isWavePrep).toBe(true)
    expect(store.enemyPieces).toHaveLength(0)
    expect(store.canStartWave).toBe(true)
  })

  it('tracks gold add/spend without allowing negative balance', () => {
    const store = useGameStore()
    store.addGold(250)
    expect(store.gold).toBe(250)
    expect(store.totalGoldEarned).toBe(250)

    expect(store.spendGold(300)).toBe(false)
    expect(store.gold).toBe(250)

    expect(store.spendGold(100)).toBe(true)
    expect(store.gold).toBe(150)
  })

  it('ignores invalid gold amounts (NaN, zero, negative)', () => {
    const store = useGameStore()
    store.addGold(-50)
    store.addGold(0)
    store.addGold(Number.NaN)
    expect(store.gold).toBe(0)
  })

  it('increments combo up to cap and decays after idle window', () => {
    const store = useGameStore()
    const t0 = 1_000

    for (let i = 0; i < COMBO_CAP + 5; i += 1) {
      store.incrementCombo(t0 + i)
    }
    expect(store.comboCount).toBe(COMBO_CAP)

    store.applyComboDecay(t0 + COMBO_CAP + COMBO_DECAY_MS + 10)
    expect(store.comboCount).toBe(0)
  })

  it('awards scaled action gold and increments friendly action counter', () => {
    const store = useGameStore()
    store.initGame(0)

    const first = store.awardActionGold({ applyActiveMult: false, nowMs: 0 })
    const second = store.awardActionGold({ applyActiveMult: false, nowMs: 0 })

    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first)
    expect(store.friendlyActionsThisStage).toBe(2)
  })

  it('purchases and deploys pawn in wave prep', () => {
    const store = useGameStore()
    store.initGame(0)
    store.addGold(500)
    expect(store.purchasePieceFromShop('pawn', 0)).toBe(true)
    expect(store.playerPieceCount).toBe(2)
    expect(store.playerPieces.some((p) => p.kind === 'pawn')).toBe(true)
    expect(store.isRoyalDecreeActive).toBe(false)
  })

  it('blocks piece shop purchase when board is full', () => {
    const store = useGameStore()
    store.initGame(0)
    store.addGold(10_000)
    store.purchasePieceFromShop('pawn', 0)
    expect(store.armySlotsUsed).toBe(2)
    expect(store.purchasePieceFromShop('pawn', 0)).toBe(false)
  })

  it('unlocks second pawn slot at stage 6 milestone', () => {
    const store = useGameStore()
    store.initGame(0)
    store.$patch({ maxStageReached: 6, currentStage: 6 })
    store.syncMilestoneUnlocks()
    expect(store.unlockedSlots.pawn).toBe(2)
  })

  it('purchases board slot upgrade in prep', () => {
    const store = useGameStore()
    store.initGame(0)
    store.addGold(10_000)
    const before = store.deploySlots
    expect(store.purchaseBoardSlot(0)).toBe(true)
    expect(store.deploySlots).toBe(before + 1)
  })

  it('deploying a pawn permanently disables Royal Decree', () => {
    const store = useGameStore()
    store.initGame(0)

    expect(store.isRoyalDecreeActive).toBe(true)
    store.deployPawn(4, 1, undefined, 0)

    expect(store.playerPieceCount).toBe(2)
    expect(store.isRoyalDecreeActive).toBe(false)
    expect(store.royalDecree.permanentlyExpired).toBe(true)

    store.removePlayerPiece('player-king-0')
    store.syncRoyalDecree()
    expect(store.isRoyalDecreeActive).toBe(false)
  })

  it('initiative loop awards gold when king bar fills', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    store.enemyPieces = store.enemyPieces.map((e) => ({
      ...e,
      initiative: { ...e.initiative, nextActionAtMs: 99_000 },
    }))

    let totalGold = 0
    let totalActs = 0
    for (let t = 1000; t <= 5000; t += 500) {
      const result = store.tickCombat(t)
      totalGold += result.goldEarned
      totalActs += result.actedCount + result.enemyActedCount
    }
    expect(totalActs).toBeGreaterThanOrEqual(1)
    expect(totalGold).toBeGreaterThan(0)
    expect(store.gold).toBeGreaterThan(0)
  })

  it('multiple ready pieces each act on separate ticks (interleaved auto)', () => {
    const store = useGameStore()
    store.initGame(0)
    store.deployPawn(3, 1, 'fast-pawn', 0)
    store.startWave(0)
    store.enemyPieces = store.enemyPieces.map((e) => ({
      ...e,
      initiative: { ...e.initiative, nextActionAtMs: 99_000 },
    }))

    let playerActs = 0
    for (let t = 1000; t <= 4000; t += 500) {
      playerActs += store.tickCombat(t).actedCount
    }
    expect(playerActs).toBeGreaterThanOrEqual(2)
  })

  it('runs wave state machine: prep → active → complete → next prep', () => {
    const store = useGameStore()
    store.initGame(0)
    expect(store.isWavePrep).toBe(true)

    store.startWave(0)
    expect(store.isWaveActive).toBe(true)
    expect(store.enemyPieces.length).toBeGreaterThan(0)

    store.enemyPieces = []
    store.evaluateWaveOutcome()
    expect(store.isWavePrep).toBe(true)
    expect(store.currentStage).toBe(2)
    expect(store.gold).toBeGreaterThan(0)
  })

  it('spawns 1 enemy pawn on stage 1 when wave starts', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    expect(store.enemyPieces.filter((e) => e.kind === 'pawn')).toHaveLength(1)
  })

  it('rewinds to milestone checkpoint when failing above it', () => {
    const store = useGameStore()
    store.initGame(0)
    store.currentStage = 12
    store.maxStageReached = 11
    store.waveCheckpointStage = 10
    store.startWave(0)
    const king = store.playerPieces.find((p) => p.kind === 'king')!
    king.stats.hp = 0
    store.evaluateWaveOutcome()
    expect(store.isWavePrep).toBe(true)
    expect(store.currentStage).toBe(10)
    expect(store.lastFailRewindToStage).toBe(10)
    expect(store.failCountThisStage).toBe(0)
    expect(store.enemyHpScale).toBe(1)
  })

  it('fails wave when king HP hits zero and softens enemies at checkpoint', () => {
    const store = useGameStore()
    store.initGame(0)
    store.currentStage = 10
    store.maxStageReached = 11
    store.waveCheckpointStage = 10
    store.startWave(0)
    const king = store.playerPieces.find((p) => p.kind === 'king')!
    king.stats.hp = 0
    store.evaluateWaveOutcome()
    expect(store.isWavePrep).toBe(true)
    expect(store.currentStage).toBe(10)
    expect(store.enemyHpScale).toBeCloseTo(0.8)
    expect(store.failCountThisStage).toBe(1)
    expect(store.lastWaveFailReason).toBe('king-fallen')
    expect(store.lastKingFailDetail).toBe('defeated')
    expect(store.showWaveOutcomeModal).toBe(true)
    expect(store.waveOutcomeReport?.kind).toBe('defeat')
    expect(store.showKingFallOverlay).toBe(false)
    const restored = store.playerPieces.find((p) => p.kind === 'king')!
    expect(restored.stats.hp).toBe(restored.stats.maxHp)
    expect(restored.position).toEqual({ file: 4, rank: 0 })
  })

  it('fails wave when enemy captures the king and restores him in prep', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    const king = store.playerPieces.find((p) => p.kind === 'king')!
    const enemy = store.enemyPieces[0]!
    king.stats.hp = 1
    store.playerPieces = [king]
    store.enemyPieces = [
      {
        ...enemy,
        position: { file: 4, rank: 1 },
        kind: 'pawn',
      },
    ]
    store.resolveEnemyMove({
      from: { file: 4, rank: 1 },
      to: { file: 4, rank: 0 },
      pieceId: enemy.id,
      kind: 'pawn',
      side: 'enemy',
      isCapture: true,
      capturedPieceId: king.id,
      isExtendedStep: false,
    })
    expect(store.isWavePrep).toBe(true)
    expect(store.lastWaveFailReason).toBe('king-fallen')
    expect(store.lastKingFailDetail).toBe('missing')
    const restored = store.playerPieces.find((p) => p.kind === 'king')!
    expect(restored.stats.hp).toBe(restored.stats.maxHp)
    expect(restored.position).toEqual({ file: 4, rank: 0 })
    expect(store.lastKingFailAttribution?.source).toBe('capture')
    expect(store.kingFallTelegraph).toContain('Enemy Pawn')
  })

  it('auto mode uses interleaved turn order — one actor per tick', () => {
    const store = useGameStore()
    store.initGame(0)
    store.setAutoPlay(true)
    store.startWave(0)
    const king = store.playerPieces.find((p) => p.kind === 'king')!
    const enemy = store.enemyPieces[0]!
    store.playerPieces = [
      {
        ...king,
        initiative: { ...king.initiative, nextActionAtMs: 5000 },
      },
    ]
    store.enemyPieces = [
      {
        ...enemy,
        initiative: { ...enemy.initiative, nextActionAtMs: 1000 },
      },
    ]
    store.startCombatLoop(0)

    const result = store.tickCombat(2000)
    expect(result.enemyActedCount).toBe(1)
    expect(result.actedCount).toBe(0)
  })

  it('manual mode uses global turn order and assigns player turn', () => {
    const store = useGameStore()
    store.initGame(0)
    store.setAutoPlay(false)
    store.startWave(0)
    store.enemyPieces = store.enemyPieces.map((enemy) => ({
      ...enemy,
      initiative: { ...enemy.initiative, nextActionAtMs: 99_000 },
    }))

    store.tickCombat(3000)
    expect(store.manualPendingPieceId).toBe('player-king-0')
    expect(store.combatTurnOrder.length).toBeGreaterThan(1)
    expect(store.combatTurnOrder[0]!.side).toBe('player')

    const move = store.manualLegalMoves[0]!
    const gold = store.executePlayerManualMove(move, 3000)
    expect(store.manualPendingPieceId).toBeNull()
    expect(gold).toBeGreaterThanOrEqual(0)
  })

  it('skips manual turn when the active piece has no legal moves', () => {
    const store = useGameStore()
    store.initGame(0)
    store.setAutoPlay(false)
    store.startWave(0)
    const king = store.playerPieces.find((p) => p.kind === 'king')!
    const block = (file: number, rank: number, id: string) =>
      createPiece(id, 'pawn', 'player', { file, rank })
    store.$patch({
      playerPieces: [
        { ...king, position: { file: 4, rank: 0 } },
        block(3, 0, 'b1'),
        block(5, 0, 'b2'),
        block(3, 1, 'b3'),
        block(4, 1, 'b4'),
        block(5, 1, 'b5'),
      ],
      enemyPieces: [],
    })
    store.playerPieces[0]!.initiative.nextActionAtMs = 0

    store.tickCombat(100)
    expect(store.manualPendingPieceId).toBeNull()
    expect(store.canSkipManualTurn).toBe(false)
  })

  it('manual mode executes enemy turns before player when enemy is earlier', () => {
    const store = useGameStore()
    store.initGame(0)
    store.setAutoPlay(false)
    store.startWave(0)
    const enemy = store.enemyPieces[0]!
    store.$patch({
      enemyPieces: [
        {
          ...enemy,
          initiative: { ...enemy.initiative, nextActionAtMs: 0 },
        },
      ],
      playerPieces: store.playerPieces.map((piece) => ({
        ...piece,
        initiative: { ...piece.initiative, nextActionAtMs: 99_000 },
      })),
    })

    store.tickCombat(100)
    expect(store.manualPendingPieceId).toBeNull()
    expect(store.combatTurnOrder[0]!.side).toBe('enemy')
  })

  it('enemy pawns act on initiative and advance toward the player', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)

    const startRank = store.enemyPieces[0]!.position.rank
    const enemyActed = store.tickEnemyInitiative(2500)

    expect(enemyActed.length).toBeGreaterThanOrEqual(1)
    const after = store.enemyPieces[0]
    expect(after).toBeDefined()
    expect(after!.position.rank).toBeLessThan(startRank)
  })

  it('tickCombat includes enemy actions during auto wave', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)

    const result = store.tickCombat(3000)
    expect(result.enemyActedCount).toBeGreaterThanOrEqual(0)
    const totalInitiative = result.actedCount + result.enemyActedCount
    expect(totalInitiative).toBeGreaterThanOrEqual(1)
  })

  it('auto mode does not set manual pending piece', () => {
    const store = useGameStore()
    store.initGame(0)
    store.setAutoPlay(true)
    store.startWave(0)
    store.tickCombat(3000)
    expect(store.manualPendingPieceId).toBeNull()
  })

  it('advanceStage requires WAVE_COMPLETE and resets per-stage counters', () => {
    const store = useGameStore()
    store.initGame(0)
    store.friendlyActionsThisStage = 10
    store.promotion.streak = 3

    expect(store.advanceStage(0)).toBe(false)

    store.startWave(0)
    store.enemyPieces = []
    store.evaluateWaveOutcome()
    expect(store.isWavePrep).toBe(true)

    expect(store.advanceStage(0)).toBe(false)
    expect(store.currentStage).toBe(2)
    expect(store.isWavePrep).toBe(true)
    expect(store.friendlyActionsThisStage).toBe(0)
    expect(store.promotion.streak).toBe(0)

    store.$patch({ wavePhase: 'WAVE_COMPLETE', currentStage: PRESTIGE_UNLOCK_STAGE - 1 })
    store.advanceStage()
    expect(store.canPrestige).toBe(true)
    expect(store.prestigeAvailable).toBe(true)
  })

  it('repositions player pieces during prep', () => {
    const store = useGameStore()
    store.initGame(0)
    store.deployPawn(0, 1, 'prep-pawn', 0)
    const startFile = store.playerPieces.find((p) => p.id === 'prep-pawn')!.position.file

    expect(store.selectPrepPiece('prep-pawn')).toBe(true)
    const move = store.prepLegalMoves.find((m) => m.to.file !== startFile)!
    expect(store.executePrepMove(move)).toBe(true)
    expect(store.playerPieces.find((p) => p.id === 'prep-pawn')!.position).toEqual(move.to)
  })

  it('auto-advance waits in prep before optional auto-start', () => {
    const store = useGameStore()
    store.initGame(0)
    store.autoAdvanceWavesPurchased = true
    store.autoAdvanceWavesEnabled = true
    store.autoStartWavesEnabled = false
    store.startWave(0)
    store.enemyPieces = []
    store.evaluateWaveOutcome()
    store.waveCompleteAtMs = 0
    store.tickWaveAutomation(2000)
    expect(store.currentStage).toBe(2)
    expect(store.isWavePrep).toBe(true)
  })

  it('regens stamina faster under Royal Decree', () => {
    const store = useGameStore()
    store.initGame(0)
    store.stamina.current = 0

    store.regenStamina(1)
    const decreeRegen = store.stamina.current

    store.deployPawn(3, 1)
    store.stamina.current = 0
    store.regenStamina(1)
    const normalRegen = store.stamina.current

    expect(decreeRegen).toBeGreaterThan(normalRegen)
  })

  it('clickEnemyPiece requires strike focus', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    const enemy = store.enemyPieces[0]!
    store.stamina.current = 100
    store.combatFocus = 'move'
    store.manualPendingPieceId = 'player-king-0'

    expect(store.clickEnemyPiece(enemy.id, 1000)).toBe(0)

    store.setCombatFocus('strike')
    expect(store.clickEnemyPiece(enemy.id, 1000)).toBeGreaterThan(0)
  })

  it('clickEnemyPiece damages enemy and spends stamina during wave', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    const enemy = store.enemyPieces[0]!
    const hpBefore = enemy.stats.hp
    store.stamina.current = 100
    store.combatFocus = 'strike'

    const damage = store.clickEnemyPiece(enemy.id, 1000)

    expect(damage).toBeGreaterThan(0)
    expect(store.staminaCurrent).toBe(95)
    const after = store.enemyPieces.find((p) => p.id === enemy.id)
    if (after) {
      expect(after.stats.hp).toBeLessThan(hpBefore)
    } else {
      expect(store.gold).toBeGreaterThan(0)
    }
  })

  it('clickEnemyPiece respects cooldown between strikes', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    const enemy = store.enemyPieces[0]!
    store.stamina.current = 100
    store.lastSimulatedMs = 5000
    store.combatFocus = 'strike'

    store.clickEnemyPiece(enemy.id, 5000)
    const hpAfterFirst =
      store.enemyPieces.find((p) => p.id === enemy.id)?.stats.hp ?? 0

    store.lastSimulatedMs = 5001
    const second = store.clickEnemyPiece(enemy.id, 5001)
    expect(second).toBe(0)
    expect(store.staminaCurrent).toBe(95)

    store.lastSimulatedMs = 7500
    const third = store.clickEnemyPiece(enemy.id, 7500)
    expect(third).toBeGreaterThan(0)
    const hpAfterThird =
      store.enemyPieces.find((p) => p.id === enemy.id)?.stats.hp ?? 0
    expect(hpAfterThird).toBeLessThanOrEqual(hpAfterFirst)
  })

  it('click cooldown does not advance while manual player turn is paused', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    const enemy = store.enemyPieces[0]!
    store.autoMode = false
    store.stamina.current = 100
    store.lastSimulatedMs = 10_000
    store.clickCombatReadyAtMs = 10_000
    store.manualPendingPieceId = 'player-king-0'
    store.combatFocus = 'strike'

    store.clickEnemyPiece(enemy.id, 10_000)
    expect(store.clickCombatReadyAtMs).toBe(12_500)

    const second = store.clickEnemyPiece(enemy.id, 999_999)
    expect(second).toBe(0)

    store.manualPendingPieceId = null
    store.lastSimulatedMs = 12_500
    const third = store.clickEnemyPiece(enemy.id, 12_500)
    expect(third).toBeGreaterThan(0)
  })

  it('spendStaminaForClick respects STAMINA_CLICK_COST', () => {
    const store = useGameStore()
    store.stamina.current = 4
    expect(store.spendStaminaForClick()).toBe(false)

    store.stamina.current = 100
    expect(store.spendStaminaForClick()).toBe(true)
    expect(store.staminaCurrent).toBe(95)
  })

  it('keeps super-promotion across stage clear', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    let pawn = store.playerPieces.find((p) => p.kind === 'pawn')
    if (!pawn) {
      pawn = createPiece('extra-pawn', 'pawn', 'player', { file: 2, rank: 7 })
      store.playerPieces = [...store.playerPieces, pawn]
    }
    pawn = { ...pawn, position: { file: 3, rank: 7 } }
    store.playerPieces = store.playerPieces.map((p) =>
      p.id === pawn!.id ? applySuperPromotion(pawn!, 'super-queen', 0) : p,
    )

    store.enemyPieces = []
    store.completeWave(0)

    expect(store.waveOutcomeReport?.kind).toBe('victory')
    expect(store.waveOutcomeReport?.foughtStage).toBe(1)
    expect(store.waveOutcomeReport?.nextStage).toBe(2)
    expect(store.showWaveOutcomeModal).toBe(true)

    const after = store.playerPieces.find((p) => p.id === pawn!.id)
    expect(after?.superPromotion?.form).toBe('super-queen')
    expect(after?.position.rank).toBeLessThanOrEqual(1)
  })

  it('dismisses wave outcome modal and hides overlay', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    store.enemyPieces = []
    store.completeWave(0)
    expect(store.showWaveOutcomeModal).toBe(true)
    store.dismissWaveOutcome()
    expect(store.showWaveOutcomeModal).toBe(false)
  })

  it('processes back-rank promotion in auto mode', () => {
    const store = useGameStore()
    store.initGame(0)
    const pawn = createPiece('promo-pawn', 'pawn', 'player', { file: 4, rank: 7 })
    store.playerPieces = [store.playerPieces[0]!, pawn]

    const fanfare = store.processPromotionForPiece('promo-pawn')
    const promoted = store.playerPieces.find((p) => p.id === 'promo-pawn')

    expect(fanfare).toBeGreaterThan(0)
    expect(promoted?.superPromotion?.form).toBeDefined()
    expect(store.promotion.streak).toBe(1)
  })

  it('purchases best ROI upgrade when affordable', () => {
    const store = useGameStore()
    store.initGame(0)
    store.addGold(50_000)
    const beforeGold = store.gold
    const best = store.upgradeOffers.find((o) => o.isBestRoi)
    expect(best).toBeDefined()
    expect(store.purchaseBestRoiUpgrade()).toBe(true)
    expect(store.gold).toBeLessThan(beforeGold)
  })

  it('passes bundled headless sanity check', () => {
    const result = runGameStoreSanityCheck(0)
    expect(result.passed).toBe(true)
  })

  it('tracks lifetime gold and preserves it through prestige', () => {
    const store = useGameStore()
    store.initGame(0)
    store.addGold(500)
    expect(store.lifetime.lifetimeGoldEarned).toBe(500)
    store.$patch({
      maxStageReached: PRESTIGE_UNLOCK_STAGE,
      currentStage: PRESTIGE_UNLOCK_STAGE,
      lifetime: {
        ...store.lifetime,
        maxStageEverReached: PRESTIGE_UNLOCK_STAGE,
      },
    })
    store.performPrestige(0)
    expect(store.lifetime.lifetimeGoldEarned).toBe(500)
    expect(store.lifetime.totalPrestiges).toBe(1)
    expect(store.currencies.gold).toBe(0)
  })

  it('equips unlocked cosmetic theme', () => {
    const store = useGameStore()
    store.initGame(0)
    store.$patch({
      lifetime: {
        maxStageEverReached: 50,
        lifetimeGoldEarned: 0,
        totalUpgradesBought: 0,
        totalPrestiges: 0,
      },
    })
    expect(store.equipCosmetic('board-obsidian')).toBe(true)
    expect(store.equippedCosmetics.boardThemeId).toBe('board-obsidian')
    expect(store.cosmeticTheme.boardDark).toContain('black')
    expect(store.equipCosmetic('board-obsidian')).toBe(true)
    expect(store.equipCosmetic('board-nonexistent')).toBe(false)
  })

  it('performPrestige resets run and awards elo at stage 20+', () => {
    const store = useGameStore()
    store.initGame(0)
    store.$patch({
      maxStageReached: PRESTIGE_UNLOCK_STAGE,
      currentStage: PRESTIGE_UNLOCK_STAGE,
      currencies: {
        gold: 99_999,
        eloShards: 2,
        trophies: 1,
        totalGoldEarned: 1_500_000,
      },
    })
    store.metaUpgrades.openingTheory = 1

    expect(store.performPrestige(100)).toBe(true)
    expect(store.currentStage).toBe(1)
    expect(store.gold).toBe(0)
    expect(store.eloShards).toBeGreaterThan(2)
    expect(store.hasPrestigedOnce).toBe(true)
    expect(store.metaTreeUnlocked).toBe(true)
    expect(store.prestigeGoldMult).toBeCloseTo(1.05, 5)
  })

  it('purchases meta upgrade with elo shards', () => {
    const store = useGameStore()
    store.initGame(0)
    store.hasPrestigedOnce = true
    store.currencies.eloShards = 5
    expect(store.purchaseMetaUpgrade('openingTheory')).toBe(true)
    expect(store.metaUpgrades.openingTheory).toBe(1)
    expect(store.currencies.eloShards).toBe(4)
  })

  it('awards trophy on first boss clear', () => {
    const store = useGameStore()
    store.initGame(0)
    store.$patch({ currentStage: 10, wavePhase: 'WAVE_ACTIVE' })
    store.enemyPieces = []
    store.evaluateWaveOutcome()
    expect(store.isWavePrep).toBe(true)
    expect(store.currentStage).toBe(11)
    expect(store.trophies).toBe(1)
    expect(store.bossTrophiesClaimed).toContain(10)
    expect(store.lastTrophyEarned).toBe('Phantom Trophy')
  })

  it('pawn leak damages king when enemy pawn reaches back rank', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    const king = store.playerPieces.find((p) => p.kind === 'king')!
    const leakPawn = {
      ...createPiece('leak', 'pawn', 'enemy', { file: 2, rank: 0 }),
      stats: { ...createPiece('x', 'pawn', 'enemy', { file: 0, rank: 6 }).stats },
    }
    store.$patch({
      playerPieces: [{ ...king, stats: { ...king.stats, hp: 40 } }],
      enemyPieces: [leakPawn],
    })
    store.processEnemyPawnLeaks()
    expect(store.lastPawnLeakDamage).toBeGreaterThan(0)
    expect(store.enemyPieces).toHaveLength(0)
    expect(store.isWavePrep).toBe(true)
    expect(store.playerPieces[0]?.stats.hp).toBe(store.playerPieces[0]?.stats.maxHp)
  })

  it('emits combat feedback on chip damage', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    const enemy = store.enemyPieces[0]
    if (!enemy) return
    const king = store.playerPieces.find((p) => p.kind === 'king')!
    store.$patch({
      playerPieces: [
        {
          ...king,
          position: { file: 4, rank: 0 },
          stats: { ...king.stats, ap: 8 },
          initiative: { ...king.initiative, nextActionAtMs: 0 },
        },
      ],
      enemyPieces: [
        {
          ...enemy,
          position: { file: 4, rank: 1 },
          stats: { ...enemy.stats, hp: 50, maxHp: 50, def: 2 },
        },
      ],
    })
    store.executePlayerAutoMove(king.id, 5000)
    expect(store.combatFeedbackEvents.length).toBeGreaterThan(0)
  })

  it('tickExhibitions grants gold when exhibitions meta is active', () => {
    const store = useGameStore()
    store.initGame(0)
    store.metaUpgrades.simultaneousExhibitions = 1
    store.exhibitionLastTickMs = 0
    const granted = store.tickExhibitions(10_000)
    expect(granted).toBeGreaterThan(0)
    expect(store.gold).toBeGreaterThan(0)
  })

  it('applies Grandmaster Phase III modifiers via store getters and combat tick', () => {
    const store = useGameStore()
    store.initGame(0)
    store.$patch({ currentStage: 50, maxStageReached: 50 })

    const boss = createPiece('gm', 'king', 'enemy', { file: 4, rank: 7 })
    boss.isBoss = true
    boss.stats.maxHp = 300
    boss.stats.hp = 50

    const nowMs = Date.now()
    store.$patch({
      wavePhase: 'WAVE_ACTIVE',
      enemyPieces: [boss],
      bossCombat: createBossCombatRuntime(50, [boss]),
      bossWaveDeadlineMs: nowMs + 180_000,
    })

    const mods = store.grandmasterCombatModifiers
    expect(mods.phase).toBe(3)
    expect(mods.playerInitiativeMult).toBe(GRANDMASTER_PHASE3_INITIATIVE_MULT)
    expect(mods.clickDamageMult).toBe(GRANDMASTER_PHASE3_CLICK_MULT)
    expect(store.effectivePlayerSpeedMult).toBeCloseTo(
      store.globalSpeedMult * GRANDMASTER_PHASE3_INITIATIVE_MULT,
    )
    expect(store.bossTimeRemainingMs).toBeGreaterThan(0)
  })

  it('fails wave when combat stalls without eliminating enemies', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    store.combatActionsSinceEnemyKill = 72
    store.syncCombatPacingAfterAction(store.enemyPieces, 1000)
    expect(store.isWavePrep).toBe(true)
    expect(store.lastKingFailAttribution?.source).toBe('stall')
    expect(store.waveOutcomeReport?.kind).toBe('defeat')
  })

  it('fails wave on boss timer timeout with attribution', () => {
    const store = useGameStore()
    store.initGame(0)
    store.startWave(0)
    store.$patch({
      currentStage: 10,
      bossWaveDeadlineMs: 1000,
    })

    store.checkBossWaveTimeout(2000)
    expect(store.isWavePrep).toBe(true)
    expect(store.lastKingFailAttribution?.source).toBe('timeout')
  })

  it('saveArenaLoadout writes ghost snapshot via exportArmySnapshotFromPieces', () => {
    const store = useGameStore()
    store.initGame(0)
    const before = listGhostArmies().length

    const id = store.saveArenaLoadout(store.unlockedPieces)
    expect(id).toBeTruthy()

    const bag = listGhostArmies()
    expect(bag.length).toBe(before + 1)
    const saved = bag.find((record) => record.id === id)
    expect(saved?.snapshot.pieces.some((row) => row.kind === 'king')).toBe(true)
    expect(saved?.snapshot.powerScore).toBeGreaterThan(0)
  })
})

describe('store scaling getters', () => {
  beforeEach(() => {
    createPiniaForTest()
  })

  it('projects increasing gold per action as stage rises', () => {
    const store = useGameStore()
    store.initGame(0)

    const stage1 = store.projectedGoldPerAction
    store.$patch({ currentStage: 10 })
    const stage10 = store.projectedGoldPerAction

    expect(stage10).toBeGreaterThan(stage1)
    expect(Number.isFinite(stage10)).toBe(true)
  })
})
