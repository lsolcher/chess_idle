/**
 * Idle Chess RPG v0.3 — core domain types, balance constants, and pure helpers.
 * All numeric formulas mirror gdd.md; stores and components import from here.
 */
import type { BossCombatRuntime } from '@/engine/bossMechanics'
import type { WaveCombatStats, WaveOutcomeReport } from '@/engine/waveOutcome'
import { createEmptyWaveCombatStats } from '@/engine/waveOutcome'
import {
  createDefaultEquippedCosmetics,
  createDefaultLifetimeStats,
} from '@/engine/cosmetics'
import type { EquippedCosmetics } from '@/engine/cosmetics'
import type { CombatFeedbackEvent } from '@/engine/combatFeedback'
import { GAME_SCHEMA_VERSION } from '@/version'

/** Standard chess piece kinds (includes King as deployable roster member). */
export type PieceKind = 'king' | 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen'

/** Transient super-forms granted by back-rank pawn promotion (stage-scoped). */
export type SuperPromotionForm =
  | 'super-knight'
  | 'super-bishop'
  | 'super-rook'
  | 'super-queen'

export type PieceSide = 'player' | 'enemy'

/** Per-piece permanent upgrade tracks (Gold-spent, persist until prestige). */
export type StatUpgradeTrack = 'ap' | 'hp' | 'def'

/** Global upgrade tracks not tied to a single piece instance. */
export type GlobalUpgradeTrack =
  | 'clickPower'
  | 'autoAiTier'
  | 'promotionMastery'
  | 'boardSlot'

/** Elo meta-tree node identifiers from GDD §2.5. */
export type MetaUpgradeId =
  | 'openingTheory'
  | 'endgameTechnique'
  | 'timeControl'
  | 'tablebaseMemory'
  | 'grandmasterInstinct'
  | 'boardExpansion'
  | 'simultaneousExhibitions'
  | 'immortalGame'
  | 'enPassantEconomy'
  | 'deepClock'

/** Discrete wave lifecycle (Phase 3.5). */
export type WavePhase = 'WAVE_PREP' | 'WAVE_ACTIVE' | 'WAVE_COMPLETE'

/** Why the last wave ended in failure (UI + prep recovery). */
export type WaveFailReason = 'king-fallen'

/** How the King was lost before prep restore (overlay copy). */
export type KingFailDetail = 'missing' | 'defeated'

/** Persisted telegraph for the King fallen banner (Phase 7.5). */
export interface KingFailAttribution {
  source: 'capture' | 'damage' | 'leak' | 'timeout' | 'stall'
  attackerKind?: PieceKind
  attackerSide?: ChessPiece['side']
  attackerPieceId?: string
  leakDamage?: number
}

/** Board input mode during combat — strike (click damage) vs move (piece actions). */
export type CombatFocus = 'strike' | 'move'

/** @deprecated Use WavePhase — kept for save migration if needed. */
export type StagePhase = 'deploy' | 'combat' | 'clear' | 'fail'

/** Player auto-play strategy (GDD §1.6 / §1.4). */
export type AutoAiPersonality = 'aggressive' | 'defensive' | 'protectKing'

/** Maps legacy save values to current strategies. */
export function normalizeAutoAiPersonality(
  value: string | undefined | null,
): AutoAiPersonality {
  if (value === 'aggressive' || value === 'defensive' || value === 'protectKing') {
    return value
  }
  if (value === 'farmer') return 'aggressive'
  return 'defensive'
}

export function normalizeCombatFocus(
  value: string | undefined | null,
  autoMode: boolean,
): CombatFocus {
  if (value === 'strike' || value === 'move') {
    return value
  }
  return autoMode ? 'strike' : 'move'
}

export type MoveTypeMult = 'normal' | 'capture' | 'check' | 'checkmate'

/** File/rank on 8×8 board — both axes 0–7 (a1 = {0,0}). */
export interface BoardCoord {
  file: number
  rank: number
}

export interface CombatStats {
  hp: number
  maxHp: number
  ap: number
  def: number
}

/**
 * Initiative bar state for event-driven turn resolution (GDD §1.5).
 * `progress` is 0–1 fill; when it reaches 1 the piece may act once.
 */
export interface InitiativeState {
  iniLevel: number
  baseIntervalSec: number
  progress: number
  /** Absolute timestamp (ms) when this piece will act if progress hits 1. */
  nextActionAtMs: number
}

/** Levels for each upgrade track on a single piece instance. */
export interface PieceUpgradeLevels {
  ap: number
  hp: number
  def: number
  initiative: number
}

/** Active super-promotion overlay on a pawn that reached the enemy back rank. */
export interface SuperPromotionState {
  form: SuperPromotionForm
  sourcePawnId: string
  /** Multipliers applied on top of computed pawn stats for this stage. */
  apMult: number
  hpMult: number
  /** Optional pierce / slam flags for AI weight overrides. */
  traits: SuperPromotionTraits
}

export interface SuperPromotionTraits {
  backRankBonus?: boolean
  pierceSplashPct?: number
  lineSlam?: boolean
}

export interface ChessPiece {
  id: string
  kind: PieceKind
  side: PieceSide
  position: BoardCoord
  stats: CombatStats
  initiative: InitiativeState
  upgradeLevels: PieceUpgradeLevels
  /** Present while pawn is promoted into a super-piece for the current stage. */
  superPromotion?: SuperPromotionState
  isBoss?: boolean
  /** Signature boss ruleset id (GDD §3.2) — see `BossIdentityId` in bossIdentity.ts. */
  bossId?: string
  slotIndex?: number
  /** Waiting one action on a promotion-block square before super-promotion (GDD §1.3). */
  promotionHold?: boolean
  /** Immortal Game Revival Flash — +50% AP for N actions (GDD §2.5). */
  revivalFlash?: { actionsRemaining: number }
  /** Timestamp (ms) until which lethal capture is waived once per revive. */
  invulnerableUntilMs?: number
  /**
   * Arena season baseline combat stats (Phase 9 `pvpNormalization`).
   * Omitted in campaign combat; set when exporting ghost / arena loadouts.
   */
  arenaBaseline?: Partial<CombatStats>
  /**
   * Cached deterministic PvP point cost (`pvpMath.calculatePvPValue`).
   * Optional cache — engine may recompute when undefined.
   */
  pvpValue?: number
}

/**
 * Royal Decree solo-King rule (GDD §1.2).
 * `permanentlyExpired` latches true once a second friendly piece is deployed.
 */
export interface RoyalDecreeState {
  isActive: boolean
  permanentlyExpired: boolean
}

export interface CurrencyState {
  gold: number
  eloShards: number
  trophies: number
  /** Lifetime gold this run — used for prestige Elo formula. */
  totalGoldEarned: number
}

export interface ComboState {
  count: number
  /** Timestamp of last combo increment; decay after 5s idle (GDD §1.4). */
  lastActionAtMs: number
}

export interface StaminaState {
  current: number
  max: number
}

export interface PromotionRunState {
  /** Stacks up to 5 per stage (+5% stage gold each). */
  streak: number
  masteryLevel: number
}

/** Rank allocated per meta node (0 = locked). */
export type MetaUpgradeState = Record<MetaUpgradeId, number>

export interface AchievementFlags {
  scholarsMate: boolean
  promotedProphet: boolean
  idleGrandmaster: boolean
  exchangeArtist: boolean
  tempoTyrant: boolean
}

export interface UnlockedSlotsState {
  pawn: number
  knight: boolean
  bishop: boolean
  rook: boolean
  queen: boolean
}

export interface PendingPromotionState {
  pieceId: string
  availableForms: SuperPromotionForm[]
}

/** Lifetime metrics — survive prestige resets (Phase 8). */
export interface LifetimeStats {
  maxStageEverReached: number
  lifetimeGoldEarned: number
  totalUpgradesBought: number
  totalPrestiges: number
}

/** Cosmetic-only gradual progression toggles (Themes tab — Phase 8.6). */
export interface AestheticPreferences {
  /** Master switch for run-scoped visuals + board evolution. */
  gradualProgression: boolean
  pieceAuras: boolean
  boardEvolution: boolean
  /** Stacked procedural music layers (lifetime unlocks). */
  musicLayers: boolean
}

export function createDefaultAestheticPreferences(): AestheticPreferences {
  return {
    gradualProgression: true,
    pieceAuras: true,
    boardEvolution: true,
    musicLayers: true,
  }
}

/**
 * Root game snapshot persisted by Pinia and save/load.
 * Separates run-scoped vs meta-scoped fields per GDD prestige rules.
 */
export type GameSchemaVersion = typeof GAME_SCHEMA_VERSION

export interface GameState {
  schemaVersion: GameSchemaVersion
  currentStage: number
  maxStageReached: number
  wavePhase: WavePhase
  /** Set when the King is lost; cleared on Start Wave (prep overlay). */
  lastWaveFailReason: WaveFailReason | null
  /** Captured vs HP depleted; cleared with lastWaveFailReason. */
  lastKingFailDetail: KingFailDetail | null
  /** Human-readable fail cause; cleared with lastWaveFailReason. */
  lastKingFailAttribution: KingFailAttribution | null
  /** Wall-clock ms when the save was last active (offline progression). */
  lastActiveAtMs: number
  /** Piece waiting for manual move selection when autoPlay is off. */
  manualPendingPieceId: string | null
  /** Piece selected for between-wave repositioning during WAVE_PREP. */
  prepPendingPieceId: string | null
  currencies: CurrencyState
  combo: ComboState
  stamina: StaminaState
  promotion: PromotionRunState
  royalDecree: RoyalDecreeState
  playerPieces: ChessPiece[]
  enemyPieces: ChessPiece[]
  unlockedSlots: UnlockedSlotsState
  deploySlots: number
  metaUpgrades: MetaUpgradeState
  achievements: AchievementFlags
  autoMode: boolean
  /** Armed board input: strike enemies or move the active friendly piece. */
  combatFocus: CombatFocus
  friendlyActionsThisStage: number
  stageStartedAtMs: number
  /** Combat actions since the last enemy was removed (stall-forfeit guard). */
  combatActionsSinceEnemyKill: number
  prestigeAvailable: boolean
  /** Product of Time Control and Tempo Tyrant meta/achievement mods. */
  globalSpeedMult: number
  prestigeGoldMult: number
  clickPowerLevel: number
  autoAiTier: number
  autoAiPersonality: AutoAiPersonality
  studyPackActive: boolean
  immortalGameUsedThisStage: boolean
  enPassantEconomyRank: number
  failCountThisStage: number
  /** Last secured wave milestone — respawn here after fail (GDD §1.8). */
  waveCheckpointStage: number
  /** Set when a fail rewinds `currentStage` to a checkpoint (UI copy). */
  lastFailRewindToStage: number | null
  enemyHpScale: number
  /** Wall-clock ms of last combat loop tick (initiative + stamina). */
  lastSimulatedMs: number
  /** Combat-time ms when the next click strike is allowed (GDD §1.4; uses lastSimulatedMs). */
  clickCombatReadyAtMs: number
  /** Wall-clock ms of last exhibition background tick (GDD §2.5). */
  exhibitionLastTickMs: number
  /** Lifetime exhibition gold this session (UI telemetry). */
  exhibitionGoldEarned: number
  /** Latches true after first prestige — unlocks meta tree UI. */
  hasPrestigedOnce: boolean
  /** Whether the event-driven combat loop is running. */
  combatLoopRunning: boolean
  /** Active player choice prompt when a pawn hits the back rank (non-auto mode). */
  pendingPromotion: PendingPromotionState | null
  /** One-time purchase: auto-proceed after wave clear (Phase 5). */
  autoAdvanceWavesPurchased: boolean
  /** Player toggle for wave automation after purchase. */
  autoAdvanceWavesEnabled: boolean
  /** Auto-chain Start Wave after proceeding (true idle loop). */
  autoStartWavesEnabled: boolean
  /** Prep timestamp after a clear — delays auto-start when automation is enabled. */
  waveCompleteAtMs: number | null
  /** En Passant Economy carry keyed by pawn id — persists until death/prestige. */
  enPassantCarryByPieceId: Record<string, { apBonus: number; hpBonus: number; fromForm?: SuperPromotionForm }>
  /** Boss stages cleared for trophy awards (lifetime per save). */
  bossTrophiesClaimed: number[]
  /** Wall-clock ms when the active boss wave times out (null if not a boss wave). */
  bossWaveDeadlineMs: number | null
  /** Active boss mechanics snapshot during WAVE_ACTIVE. */
  bossCombat: BossCombatRuntime | null
  /** Last pawn leak damage for combat UI feedback. */
  lastPawnLeakDamage: number
  /** Recent trophy name for header toast. */
  lastTrophyEarned: string | null
  /** Accumulated combat telemetry for the active wave (reset on Start Wave). */
  waveCombatStats: WaveCombatStats
  /** Modal report after victory/defeat; cleared on dismiss or new wave. */
  waveOutcomeReport: WaveOutcomeReport | null
  /** Short-lived board VFX queue (not persisted). */
  combatFeedbackEvents: CombatFeedbackEvent[]
  /** Wall-clock ms until screen shake CSS stops. */
  screenShakeUntilMs: number
  /** One-shot toast after offline catch-up (session only). */
  lastOfflineGoldGranted: number
  /** Cross-run progression for cosmetics & achievements. */
  lifetime: LifetimeStats
  /** Equipped visual theme ids (wardrobe). */
  equippedCosmetics: EquippedCosmetics
  /** Gradual aesthetic / music layer toggles (persisted). */
  aestheticPreferences: AestheticPreferences
}

/** Config row for a piece kind at upgrade level 1 (GDD §1.7). */
export interface PieceDefinition {
  kind: PieceKind
  unlockStage: number
  tier: number
  baseHp: number
  baseAp: number
  baseDef: number
  baseIntervalSec: number
  captureValue: number
}

/** Upgrade track exponential cost config (GDD §2.3). */
export interface UpgradeTrackConfig {
  track: StatUpgradeTrack | 'initiative'
  baseCost: number
  growth: number
  maxLevel: number
}

export interface MetaUpgradeDefinition {
  id: MetaUpgradeId
  eloCostPerRank: number
  maxRank: number
  label: string
}

// ---------------------------------------------------------------------------
// GDD balance constants
// ---------------------------------------------------------------------------

export { GAME_SCHEMA_VERSION } from '@/version'

export const COMBO_DECAY_MS = 5_000
export const COMBO_CAP = 15
export const ACTIVE_MULT_BASE = 1.5
export const ACTIVE_MULT_PER_COMBO = 0.1
export const ACTIVE_MULT_MAX = 3.0

export const STAMINA_MAX = 100
export const STAMINA_CLICK_COST = 5
export const STAMINA_REGEN_PER_SEC = 10

export const PROMOTION_STREAK_CAP = 5
export const PROMOTION_STREAK_GOLD_BONUS = 0.05
export const PROMOTION_FANFARE_CAPTURE_MULT = 3
export const PROMOTION_MASTERY_STAT_BONUS = 0.1
export const QUEEN_PROMOTION_UNLOCK_STAGE = 45
export const PROMOTION_BLOCK_MIN_STAGE = 11
export const INI_REDUCTION_PER_LEVEL = 0.08
export const INI_MAX_REDUCTION = 0.6

export const STAT_LEVEL_GROWTH = 1.12

export const MOVE_TYPE_MULTIPLIERS: Record<MoveTypeMult, number> = {
  normal: 0,
  capture: 1,
  check: 1.25,
  checkmate: 3,
}

export const PIECE_DEFINITIONS: Record<PieceKind, PieceDefinition> = {
  king: {
    kind: 'king',
    unlockStage: 0,
    tier: 0,
    baseHp: 50,
    baseAp: 8,
    baseDef: 2,
    baseIntervalSec: 3.0,
    captureValue: 200,
  },
  pawn: {
    kind: 'pawn',
    unlockStage: 1,
    tier: 1,
    baseHp: 30,
    baseAp: 6,
    baseDef: 1,
    baseIntervalSec: 2.4,
    captureValue: 5,
  },
  knight: {
    kind: 'knight',
    unlockStage: 10,
    tier: 2,
    baseHp: 45,
    baseAp: 12,
    baseDef: 2,
    baseIntervalSec: 2.0,
    captureValue: 15,
  },
  bishop: {
    kind: 'bishop',
    unlockStage: 15,
    tier: 2,
    baseHp: 40,
    baseAp: 11,
    baseDef: 1,
    baseIntervalSec: 2.1,
    captureValue: 15,
  },
  rook: {
    kind: 'rook',
    unlockStage: 30,
    tier: 3,
    baseHp: 70,
    baseAp: 18,
    baseDef: 4,
    baseIntervalSec: 2.8,
    captureValue: 30,
  },
  queen: {
    kind: 'queen',
    unlockStage: 45,
    tier: 4,
    baseHp: 55,
    baseAp: 22,
    baseDef: 3,
    baseIntervalSec: 1.8,
    captureValue: 50,
  },
}

export const PROMOTION_MULTIPLIERS: Record<
  SuperPromotionForm,
  { apMult: number; hpMult: number; traits: SuperPromotionTraits }
> = {
  'super-knight': { apMult: 2.5, hpMult: 2.0, traits: { backRankBonus: true } },
  'super-bishop': { apMult: 2.2, hpMult: 1.8, traits: { pierceSplashPct: 0.15 } },
  'super-rook': { apMult: 2.8, hpMult: 3.0, traits: { lineSlam: true } },
  'super-queen': { apMult: 3.5, hpMult: 2.5, traits: {} },
}

export const STAT_UPGRADE_CONFIG: UpgradeTrackConfig = {
  track: 'ap',
  baseCost: 100,
  growth: 1.15,
  maxLevel: 50,
}

export const INITIATIVE_UPGRADE_CONFIG: UpgradeTrackConfig = {
  track: 'initiative',
  baseCost: 80,
  growth: 1.16,
  maxLevel: 10,
}

export const META_UPGRADE_DEFINITIONS: MetaUpgradeDefinition[] = [
  { id: 'openingTheory', eloCostPerRank: 1, maxRank: 20, label: 'Opening Theory' },
  { id: 'endgameTechnique', eloCostPerRank: 2, maxRank: 15, label: 'Endgame Technique' },
  { id: 'timeControl', eloCostPerRank: 3, maxRank: 10, label: 'Time Control' },
  { id: 'tablebaseMemory', eloCostPerRank: 2, maxRank: 10, label: 'Tablebase Memory' },
  { id: 'grandmasterInstinct', eloCostPerRank: 5, maxRank: 3, label: 'Grandmaster Instinct' },
  { id: 'boardExpansion', eloCostPerRank: 8, maxRank: 2, label: 'Board Expansion' },
  {
    id: 'simultaneousExhibitions',
    eloCostPerRank: 12,
    maxRank: 3,
    label: 'Simultaneous Exhibitions',
  },
  { id: 'immortalGame', eloCostPerRank: 15, maxRank: 1, label: 'Immortal Game' },
  { id: 'enPassantEconomy', eloCostPerRank: 10, maxRank: 5, label: 'En Passant Economy' },
  { id: 'deepClock', eloCostPerRank: 6, maxRank: 1, label: 'Deep Clock (+30s boss)' },
]

// ---------------------------------------------------------------------------
// Pure helpers (TSDoc documents GDD formulas for store/UI reuse)
// ---------------------------------------------------------------------------

/**
 * Exponential upgrade cost: `Cost(L) = base × growth^(L-1)` (GDD §2.3).
 * Level 1 purchase uses L=1 → cost = base.
 */
export function calculateUpgradeCost(
  baseCost: number,
  growth: number,
  targetLevel: number,
): number {
  if (targetLevel < 1) return 0
  if (baseCost <= 0 || growth <= 0) return 0
  return baseCost * growth ** (targetLevel - 1)
}

/**
 * Piece-tier-adjusted upgrade base: `100 × tier²` for stat tracks (GDD §2.3).
 */
export function getStatUpgradeBaseCost(kind: PieceKind): number {
  const tier = Math.max(1, PIECE_DEFINITIONS[kind].tier)
  return 100 * tier ** 2
}

/**
 * Initiative track base: `80 × tier²` (GDD §2.3).
 */
export function getInitiativeUpgradeBaseCost(kind: PieceKind): number {
  const tier = Math.max(1, PIECE_DEFINITIONS[kind].tier || 1)
  return 80 * tier ** 2
}

/**
 * Scaled combat stat at upgrade level L: `Base × 1.12^(L-1)` (GDD §1.7).
 */
export function calculateStatAtLevel(baseStat: number, level: number): number {
  if (level < 1) return baseStat
  return baseStat * STAT_LEVEL_GROWTH ** (level - 1)
}

/**
 * Initiative interval in seconds (GDD §1.5).
 * Capped at 60% reduction at INI level 10 before global speed mods.
 */
export function calculateActionIntervalSec(
  baseIntervalSec: number,
  iniLevel: number,
  globalSpeedMult = 1,
): number {
  const clampedLevel = Math.max(0, Math.min(iniLevel, INITIATIVE_UPGRADE_CONFIG.maxLevel))
  const rawReduction = clampedLevel * INI_REDUCTION_PER_LEVEL
  const reduction = Math.min(rawReduction, INI_MAX_REDUCTION)
  const safeGlobal = globalSpeedMult > 0 ? globalSpeedMult : 1
  return baseIntervalSec / (1 + reduction) / safeGlobal
}

/**
 * Active play multiplier from combo stack (GDD §1.4).
 */
export function calculateActiveMult(comboCount: number): number {
  const clamped = Math.max(0, Math.min(comboCount, COMBO_CAP))
  return Math.min(
    ACTIVE_MULT_MAX,
    ACTIVE_MULT_BASE + ACTIVE_MULT_PER_COMBO * clamped,
  )
}

/** Stage gold multiplier: `1.14^(stage - 1)` (GDD §2.2). */
export function calculateStageGoldMult(stage: number): number {
  const safeStage = Math.max(1, stage)
  return 1.14 ** (safeStage - 1)
}

/**
 * Per-action gold drip (GDD §2.2).
 */
export function calculateGoldAction(
  stage: number,
  prestigeGoldMult: number,
  activeMult: number,
  friendlyActionsThisStage: number,
): number {
  const baseDrip = 2 + stage * 0.15
  const stageMult = calculateStageGoldMult(stage)
  const actionBonus = 1 + 0.02 * Math.max(0, friendlyActionsThisStage)
  return baseDrip * stageMult * prestigeGoldMult * activeMult * actionBonus
}

/**
 * Stage clear lump sum (GDD §2.2).
 * `GoldClear = 50 × Stage^1.35 × (1 + 0.05 × piecesOwned)`
 */
export function calculateGoldClear(stage: number, piecesOwned: number): number {
  const safeStage = Math.max(1, stage)
  const ownedBonus = 1 + 0.05 * Math.max(0, piecesOwned)
  return 50 * safeStage ** 1.35 * ownedBonus
}

/**
 * Capture burst gold (GDD §2.2).
 */
export function calculateGoldCapture(
  kind: PieceKind,
  stage: number,
  activeMult: number,
  royalDecreeActive = false,
): number {
  const base = PIECE_DEFINITIONS[kind].captureValue
  const decreeMult = royalDecreeActive ? 2 : 1
  return base * calculateStageGoldMult(stage) * activeMult * decreeMult
}

/**
 * Prestige Elo shards (GDD §2.4).
 */
export function calculateEloShardsEarned(
  maxStageReached: number,
  totalGoldEarned: number,
  prestigeMultBonus = 1,
): number {
  if (maxStageReached < 20) return 0
  const raw = Math.sqrt((maxStageReached * totalGoldEarned) / 1_000_000) * prestigeMultBonus
  return Math.max(1, Math.floor(raw))
}

/**
 * Damage resolution (GDD §1.1): `max(1, AP - DEF)` before HP subtraction.
 */
export function calculateDamageDealt(ap: number, def: number, moveMult = 1): number {
  const raw = ap * moveMult
  return Math.max(1, raw - Math.max(0, def))
}

/** Count player pieces excluding transient enemy captures. */
export function countPlayerPieces(pieces: ChessPiece[]): number {
  return pieces.filter((p) => p.side === 'player').length
}

/**
 * Royal Decree eligibility (GDD §1.2):
 * active when exactly one friendly piece exists (the King), and not permanently expired.
 */
export function evaluateRoyalDecree(playerPieces: ChessPiece[], decree: RoyalDecreeState): RoyalDecreeState {
  if (decree.permanentlyExpired) {
    return { isActive: false, permanentlyExpired: true }
  }
  const playerCount = countPlayerPieces(playerPieces)
  const soloKing =
    playerCount === 1 && playerPieces.some((p) => p.side === 'player' && p.kind === 'king')
  return {
    isActive: soloKing,
    permanentlyExpired: false,
  }
}

/**
 * Latches Royal Decree off permanently when a second friendly piece is deployed.
 */
export function registerPlayerPiece(
  playerPieces: ChessPiece[],
  decree: RoyalDecreeState,
  newPiece: ChessPiece,
): { pieces: ChessPiece[]; decree: RoyalDecreeState } {
  const pieces = [...playerPieces, newPiece]
  if (countPlayerPieces(pieces) > 1 && !decree.permanentlyExpired) {
    return {
      pieces,
      decree: { isActive: false, permanentlyExpired: true },
    }
  }
  return { pieces, decree: evaluateRoyalDecree(pieces, decree) }
}

/** Stamina regen per second; doubled under Royal Decree (GDD §1.2). */
export function calculateStaminaRegenPerSec(royalDecreeActive: boolean): number {
  return royalDecreeActive ? STAMINA_REGEN_PER_SEC * 2 : STAMINA_REGEN_PER_SEC
}

export function createDefaultMetaUpgrades(): MetaUpgradeState {
  return META_UPGRADE_DEFINITIONS.reduce((acc, def) => {
    acc[def.id] = 0
    return acc
  }, {} as MetaUpgradeState)
}

export function createDefaultUpgradeLevels(): PieceUpgradeLevels {
  return { ap: 1, hp: 1, def: 1, initiative: 0 }
}

/**
 * Builds combat stats for a piece kind at given upgrade levels.
 */
export function buildPieceStats(kind: PieceKind, levels: PieceUpgradeLevels): CombatStats {
  const def = PIECE_DEFINITIONS[kind]
  const maxHp = calculateStatAtLevel(def.baseHp, levels.hp)
  const ap = calculateStatAtLevel(def.baseAp, levels.ap)
  const defStat = calculateStatAtLevel(def.baseDef, levels.def)
  return { hp: maxHp, maxHp, ap, def: defStat }
}

export function createPiece(
  id: string,
  kind: PieceKind,
  side: PieceSide,
  position: BoardCoord,
  levels: PieceUpgradeLevels = createDefaultUpgradeLevels(),
): ChessPiece {
  const definition = PIECE_DEFINITIONS[kind]
  const stats = buildPieceStats(kind, levels)
  const interval = calculateActionIntervalSec(definition.baseIntervalSec, levels.initiative)
  return {
    id,
    kind,
    side,
    position,
    stats,
    upgradeLevels: { ...levels },
    initiative: {
      iniLevel: levels.initiative,
      baseIntervalSec: definition.baseIntervalSec,
      progress: 0,
      nextActionAtMs: Date.now() + interval * 1000,
    },
  }
}

/** Factory for a fresh run — solo King at e1 (file 4, rank 0). */
export function createInitialGameState(nowMs = Date.now()): GameState {
  const king = createPiece('player-king-0', 'king', 'player', { file: 4, rank: 0 })
  return {
    schemaVersion: GAME_SCHEMA_VERSION,
    currentStage: 1,
    maxStageReached: 1,
    wavePhase: 'WAVE_PREP',
    lastWaveFailReason: null,
    lastKingFailDetail: null,
    lastKingFailAttribution: null,
    lastActiveAtMs: nowMs,
    manualPendingPieceId: null,
    prepPendingPieceId: null,
    currencies: { gold: 0, eloShards: 0, trophies: 0, totalGoldEarned: 0 },
    combo: { count: 0, lastActionAtMs: nowMs },
    stamina: { current: STAMINA_MAX, max: STAMINA_MAX },
    promotion: { streak: 0, masteryLevel: 0 },
    royalDecree: { isActive: true, permanentlyExpired: false },
    playerPieces: [king],
    enemyPieces: [],
    unlockedSlots: { pawn: 1, knight: false, bishop: false, rook: false, queen: false },
    deploySlots: 2,
    metaUpgrades: createDefaultMetaUpgrades(),
    achievements: {
      scholarsMate: false,
      promotedProphet: false,
      idleGrandmaster: false,
      exchangeArtist: false,
      tempoTyrant: false,
    },
    autoMode: true,
    combatFocus: 'strike',
    friendlyActionsThisStage: 0,
    stageStartedAtMs: nowMs,
    combatActionsSinceEnemyKill: 0,
    prestigeAvailable: false,
    globalSpeedMult: 1,
    prestigeGoldMult: 1,
    clickPowerLevel: 1,
    autoAiTier: 0,
    autoAiPersonality: 'defensive',
    studyPackActive: false,
    immortalGameUsedThisStage: false,
    enPassantEconomyRank: 0,
    failCountThisStage: 0,
    waveCheckpointStage: 1,
    lastFailRewindToStage: null,
    enemyHpScale: 1,
    lastSimulatedMs: nowMs,
    clickCombatReadyAtMs: nowMs,
    exhibitionLastTickMs: nowMs,
    exhibitionGoldEarned: 0,
    hasPrestigedOnce: false,
    combatLoopRunning: false,
    pendingPromotion: null,
    autoAdvanceWavesPurchased: false,
    autoAdvanceWavesEnabled: false,
    autoStartWavesEnabled: true,
    waveCompleteAtMs: null,
    enPassantCarryByPieceId: {},
    bossTrophiesClaimed: [],
    bossWaveDeadlineMs: null,
    bossCombat: null,
    lastPawnLeakDamage: 0,
    lastTrophyEarned: null,
    waveCombatStats: createEmptyWaveCombatStats(),
    waveOutcomeReport: null,
    combatFeedbackEvents: [],
    screenShakeUntilMs: 0,
    lastOfflineGoldGranted: 0,
    lifetime: createDefaultLifetimeStats(1),
    equippedCosmetics: createDefaultEquippedCosmetics(),
    aestheticPreferences: createDefaultAestheticPreferences(),
  }
}

/** Headless sanity simulation for CI / dev console. */
export function runTypeModelSanityCheck(): { passed: boolean; messages: string[] } {
  const messages: string[] = []
  let passed = true

  const assert = (label: string, ok: boolean) => {
    messages.push(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
    if (!ok) passed = false
  }

  const state = createInitialGameState(0)
  assert('initial solo king activates decree', state.royalDecree.isActive)

  const pawn = createPiece('player-pawn-0', 'pawn', 'player', { file: 4, rank: 1 })
  const registered = registerPlayerPiece(state.playerPieces, state.royalDecree, pawn)
  assert('second piece expires decree permanently', registered.decree.permanentlyExpired)
  assert('decree inactive after deploy', !registered.decree.isActive)

  const intervalL10 = calculateActionIntervalSec(2.4, 10, 1)
  assert('initiative cap ~60% reduction at L10', intervalL10 > 1.4 && intervalL10 < 1.6)

  assert('upgrade cost L10 ~352 for pawn AP', Math.round(calculateUpgradeCost(100, 1.15, 10)) === 352)

  assert('active mult caps at 3', calculateActiveMult(99) === 3)
  assert('elo requires stage 20', calculateEloShardsEarned(19, 1e9) === 0)
  assert('elo minimum 1 at stage 20', calculateEloShardsEarned(20, 1e6) >= 1)

  assert('damage floor is 1', calculateDamageDealt(2, 5) === 1)

  return { passed, messages }
}
