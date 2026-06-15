/**
 * Dev cheat actions — pure helpers + store mutators for QA and balance testing.
 */
import {
  applyDeploySlotMilestones,
  clampDeploySlotsToRoster,
  computeMaxDeploySlotsFromRoster,
  resolveUnlockedSlotsFromMilestones,
} from '@/engine/pieceShop'
import { healPlayerPiecesForPrep } from '@/engine/waveState'
import {
  INITIATIVE_UPGRADE_CONFIG,
  STAT_UPGRADE_CONFIG,
  type ChessPiece,
  type PieceUpgradeLevels,
} from '@/types/game'

export type DevCheatId =
  | 'addGold10k'
  | 'addGold100k'
  | 'addElo100'
  | 'healArmy'
  | 'refillStamina'
  | 'maxUpgrades'
  | 'maxClickPower'
  | 'unlockRoster'
  | 'advanceStage'
  | 'completeWave'
  | 'clearEnemies'
  | 'enterPrep'
  | 'startWave'

export const DEV_CHEAT_MAX_STAGE = 999

export interface DevCheatGameActions {
  wavePhase: string
  currentStage: number
  maxStageReached: number
  playerPieces: ChessPiece[]
  deploySlots: number
  unlockedSlots: ReturnType<typeof resolveUnlockedSlotsFromMilestones>
  clickPowerLevel: number
  stamina: { current: number; max: number }
  addGold(amount: number): void
  addEloShards(amount: number): void
  syncMilestoneUnlocks(): void
  syncPlayerArmyCombatStats(preserveHpRatio?: boolean): void
  enterWavePrep(nowMs?: number): void
  startWave(nowMs?: number): void
  completeWave(nowMs?: number): void
  dismissWaveOutcome(nowMs?: number): void
  evaluateWaveOutcome(): void
}

export function maxPieceUpgradeLevels(): PieceUpgradeLevels {
  return {
    ap: STAT_UPGRADE_CONFIG.maxLevel,
    hp: STAT_UPGRADE_CONFIG.maxLevel,
    def: STAT_UPGRADE_CONFIG.maxLevel,
    initiative: INITIATIVE_UPGRADE_CONFIG.maxLevel,
  }
}

export function applyMaxUpgradeLevelsToArmy(pieces: ChessPiece[]): ChessPiece[] {
  const levels = maxPieceUpgradeLevels()
  return pieces.map((piece) => {
    if (piece.side !== 'player') return piece
    return {
      ...piece,
      upgradeLevels: { ...levels },
      initiative: {
        ...piece.initiative,
        iniLevel: levels.initiative,
      },
    }
  })
}

export function devSetStageTarget(stage: number): number {
  return Math.max(1, Math.min(DEV_CHEAT_MAX_STAGE, Math.floor(stage)))
}

export function applyDevSetStage(store: DevCheatGameActions, stage: number, nowMs = Date.now()): void {
  const target = devSetStageTarget(stage)
  if (store.wavePhase === 'WAVE_ACTIVE') {
    store.enterWavePrep(nowMs)
  }
  if (store.wavePhase === 'WAVE_COMPLETE') {
    store.dismissWaveOutcome(nowMs)
  }
  store.currentStage = target
  store.maxStageReached = Math.max(store.maxStageReached, target)
  store.syncMilestoneUnlocks()
  store.syncPlayerArmyCombatStats(true)
}

export function applyDevUnlockRoster(store: DevCheatGameActions): void {
  store.maxStageReached = Math.max(store.maxStageReached, DEV_CHEAT_MAX_STAGE)
  store.syncMilestoneUnlocks()
  const cap = computeMaxDeploySlotsFromRoster(store.unlockedSlots)
  store.deploySlots = clampDeploySlotsToRoster(
    applyDeploySlotMilestones(store.maxStageReached, cap, store.unlockedSlots),
    store.unlockedSlots,
  )
}

export function applyDevHealArmy(store: DevCheatGameActions): void {
  store.playerPieces = healPlayerPiecesForPrep(store.playerPieces, {
    missingHpRecoveryFraction: 1,
  })
  store.syncPlayerArmyCombatStats(true)
}

export function applyDevMaxUpgrades(store: DevCheatGameActions): void {
  store.playerPieces = applyMaxUpgradeLevelsToArmy(store.playerPieces)
  store.syncPlayerArmyCombatStats(false)
}

export function applyDevClearEnemies(store: DevCheatGameActions & { enemyPieces: ChessPiece[] }): void {
  if (store.wavePhase !== 'WAVE_ACTIVE') return
  store.enemyPieces = store.enemyPieces.map((enemy) => ({
    ...enemy,
    stats: { ...enemy.stats, hp: 0 },
  }))
  store.evaluateWaveOutcome()
}

export function runDevCheat(
  store: DevCheatGameActions & { enemyPieces: ChessPiece[] },
  cheatId: DevCheatId,
  nowMs = Date.now(),
): void {
  switch (cheatId) {
    case 'addGold10k':
      store.addGold(10_000)
      break
    case 'addGold100k':
      store.addGold(100_000)
      break
    case 'addElo100':
      store.addEloShards(100)
      break
    case 'healArmy':
      applyDevHealArmy(store)
      break
    case 'refillStamina':
      store.stamina.current = store.stamina.max
      break
    case 'maxUpgrades':
      applyDevMaxUpgrades(store)
      break
    case 'maxClickPower':
      store.clickPowerLevel = 30
      break
    case 'unlockRoster':
      applyDevUnlockRoster(store)
      break
    case 'advanceStage':
      applyDevSetStage(store, store.currentStage + 1, nowMs)
      break
    case 'completeWave':
    case 'clearEnemies':
      applyDevClearEnemies(store)
      break
    case 'enterPrep':
      if (store.wavePhase === 'WAVE_COMPLETE') {
        store.dismissWaveOutcome(nowMs)
      } else if (store.wavePhase === 'WAVE_ACTIVE') {
        store.enterWavePrep(nowMs)
      }
      break
    case 'startWave':
      store.startWave(nowMs)
      break
    default:
      break
  }
}
