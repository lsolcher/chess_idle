import { describe, expect, it } from 'vitest'
import { createBossCombatRuntime } from '@/engine/bossMechanics'
import {
  combatSnapshotsEqual,
  deserializeGameState,
  EPHEMERAL_STATE_KEYS,
  roundTripCombatSnapshot,
  serializeGameState,
  toCombatSnapshot,
} from '@/engine/gameSerialization'
import { bootstrapPieceInitiative } from '@/engine/initiative'
import {
  createInitialGameState,
  createPiece,
  type GameState,
} from '@/types/game'

function buildComplexCombatState(nowMs = 1_700_000_000_000): GameState {
  const state = createInitialGameState(nowMs)
  state.currentStage = 50
  state.maxStageReached = 50
  state.wavePhase = 'WAVE_ACTIVE'
  state.lastSimulatedMs = nowMs
  state.enemyHpScale = 1.15
  state.failCountThisStage = 2
  state.currencies.gold = 125_000
  state.currencies.trophies = 3

  const king = bootstrapPieceInitiative(
    createPiece('pk', 'king', 'player', { file: 4, rank: 0 }),
    nowMs,
    1,
  )
  king.upgradeLevels = { ap: 4, hp: 2, def: 1, initiative: 1 }
  king.revivalFlash = { actionsRemaining: 2 }

  const superPawn = bootstrapPieceInitiative(
    createPiece('ps', 'pawn', 'player', { file: 2, rank: 6 }),
    nowMs,
    1,
  )
  superPawn.superPromotion = {
    form: 'super-queen',
    sourcePawnId: superPawn.id,
    apMult: 2.5,
    hpMult: 2,
    traits: { lineSlam: true, pierceSplashPct: 0.1 },
  }
  superPawn.pvpValue = 42
  superPawn.arenaBaseline = { ap: 80, hp: 200, def: 12 }

  const boss = bootstrapPieceInitiative(
    createPiece('gm', 'king', 'enemy', { file: 4, rank: 7 }),
    nowMs,
    1,
  )
  boss.isBoss = true
  boss.bossId = 'grandmaster'
  boss.stats.maxHp = 500
  boss.stats.hp = 120

  const enemyPawn = bootstrapPieceInitiative(
    createPiece('ep', 'pawn', 'enemy', { file: 3, rank: 5 }),
    nowMs,
    1,
  )
  enemyPawn.invulnerableUntilMs = nowMs + 60_000

  state.playerPieces = [king, superPawn]
  state.enemyPieces = [boss, enemyPawn]
  state.bossCombat = createBossCombatRuntime(50, state.enemyPieces)
  state.bossWaveDeadlineMs = nowMs + 180_000
  state.pendingPromotion = {
    pieceId: superPawn.id,
    availableForms: ['super-queen', 'super-rook', 'super-bishop', 'super-knight'],
  }
  state.enPassantCarryByPieceId = {
    [superPawn.id]: { apBonus: 5, hpBonus: 10, fromForm: 'super-queen' },
  }
  state.equippedCosmetics = {
    boardThemeId: 'obsidian-lattice',
    pieceSkinId: 'golden-army',
    shellBackgroundId: 'prestige-frame',
  }
  state.aestheticPreferences = {
    gradualProgression: true,
    pieceAuras: true,
    boardEvolution: false,
    musicLayers: true,
  }
  state.combatFeedbackEvents = [
    {
      id: 'fx-1',
      kind: 'chip',
      file: 3,
      rank: 5,
      expiresAtMs: nowMs + 500,
      amount: 12,
    },
  ]
  state.manualPendingPieceId = 'pk'
  state.combatLoopRunning = true

  return state
}

describe('gameSerialization', () => {
  it('round-trips core state without ephemeral keys', () => {
    const state = createInitialGameState()
    state.currencies.gold = 42
    state.currentStage = 12

    const json = serializeGameState(state)
    const parsed = JSON.parse(json) as Record<string, unknown>

    for (const key of EPHEMERAL_STATE_KEYS) {
      expect(parsed[key]).toBeUndefined()
    }

    const restored = deserializeGameState(json)
    expect(restored.currencies.gold).toBe(42)
    expect(restored.currentStage).toBe(12)
    expect(restored.combatFeedbackEvents).toEqual([])
  })

  it('builds combat snapshot from live state', () => {
    const state = createInitialGameState()
    state.wavePhase = 'WAVE_ACTIVE'
    state.currentStage = 20

    const snap = toCombatSnapshot(state)
    expect(snap.wavePhase).toBe('WAVE_ACTIVE')
    expect(snap.currentStage).toBe(20)
    expect(snap.playerPieces.length).toBeGreaterThan(0)
  })

  it('round-trips a complex active wave with identical CombatSnapshot', () => {
    const state = buildComplexCombatState()
    const before = toCombatSnapshot(state)

    expect(roundTripCombatSnapshot(state)).toBe(true)

    const json = serializeGameState(state)
    const restored = deserializeGameState(json)
    const after = toCombatSnapshot(restored)

    expect(combatSnapshotsEqual(before, after)).toBe(true)
    expect(after.currentStage).toBe(50)
    expect(after.bossCombat?.identity).toBe('grandmaster')
    expect(after.playerPieces.find((p) => p.id === 'ps')?.superPromotion?.form).toBe(
      'super-queen',
    )
    expect(after.playerPieces.find((p) => p.id === 'ps')?.pvpValue).toBe(42)
    expect(after.enemyPieces.find((p) => p.id === 'ep')?.invulnerableUntilMs).toBe(
      state.enemyPieces.find((p) => p.id === 'ep')!.invulnerableUntilMs,
    )
    expect(restored.bossWaveDeadlineMs).toBe(state.bossWaveDeadlineMs)
    expect(restored.pendingPromotion?.pieceId).toBe('ps')
    expect(restored.manualPendingPieceId).toBeNull()
    expect(restored.combatLoopRunning).toBe(false)
  })
})
