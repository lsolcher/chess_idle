/**
 * Gradual aesthetic progression — exponential early unlocks, prestige-gated god tier (Phase 8.6).
 *
 * ## Visual tier curve (stage → tier)
 * Unlock stage for tier `n` (n ≥ 1):
 *   `S(n) = round(ANCHOR × n^EXP)` with `ANCHOR = 1`, `EXP = 1.5`
 *
 * Examples: tier 1 @ stage 1, tier 2 @ 3, tier 3 @ 5, tier 4 @ 8, tier 5 @ 11,
 * tier 6 @ 15, tier 7 @ 20 — dense rewards in stages 1–20, then spacing widens (~log-like).
 *
 * `getVisualTier(stage)` returns the highest tier with `stage >= S(n)`.
 *
 * ## Board evolution (slower late-game)
 * `boardTier = min(6, floor(log2(stage + 1) × 2))` — sub-linear in stage.
 *
 * Run-scoped visuals use **currentStage** (resets on prestige). Music layers & trophies use **lifetime** peaks.
 */
import type { MusicLayerId } from '@/engine/musicLayers'
import type { PieceKind, PieceUpgradeLevels } from '@/types/game'

export const VISUAL_TIER_EXPONENT = 1.5
export const VISUAL_TIER_ANCHOR = 1
export const MAX_VISUAL_TIER = 12
export const MAX_BOARD_EVOLUTION_TIER = 6
export const MAX_PIECE_AURA_TIER = 4
/** Victory glow tiers from wave wins (0–6). Unicode glyphs stay; CSS adds glow/sparkle. */
export const MAX_VICTORY_GLOW_TIER = 6

/** Documented unlock stages for tasks.md / UI (tiers 1–8 sample). */
export const VISUAL_TIER_UNLOCK_TABLE: readonly { tier: number; stage: number }[] = Array.from(
  { length: MAX_VISUAL_TIER },
  (_, i) => {
    const tier = i + 1
    return { tier, stage: getVisualTierUnlockStage(tier) }
  },
)

/**
 * Minimum stage to reach visual tier `tier` (1-indexed).
 * Power-law: early tiers cluster in the opening twenty stages.
 */
export function getVisualTierUnlockStage(tier: number): number {
  if (tier <= 0) return 0
  return Math.max(1, Math.round(VISUAL_TIER_ANCHOR * Math.pow(tier, VISUAL_TIER_EXPONENT)))
}

/**
 * Highest visual tier unlocked at this stage (0 = baseline only).
 */
export function getVisualTier(stage: number): number {
  const s = Math.max(0, Math.floor(stage))
  let tier = 0
  while (tier < MAX_VISUAL_TIER && s >= getVisualTierUnlockStage(tier + 1)) {
    tier += 1
  }
  return tier
}

/** Next stage at which visual tier increases (null if at cap). */
export function getNextVisualTierStage(stage: number): number | null {
  const current = getVisualTier(stage)
  if (current >= MAX_VISUAL_TIER) return null
  return getVisualTierUnlockStage(current + 1)
}

/**
 * Board mesh / border complexity tier — logarithmic so late game slows down.
 */
export function getBoardEvolutionTier(stage: number): number {
  if (stage < 1) return 0
  return Math.min(MAX_BOARD_EVOLUTION_TIER, Math.floor(Math.log2(stage + 1) * 2))
}

/**
 * CSS-only piece aura tier (0–4). Derived from run stage; resets on prestige.
 */
export function getPieceAuraTier(stage: number): number {
  return Math.min(MAX_PIECE_AURA_TIER, Math.floor(getVisualTier(stage) / 2))
}

/** God-tier VFX gate — prestige milestones + deep stage (GDD living board). */
export function isGodTierVisualUnlocked(stage: number, totalPrestiges: number): boolean {
  return totalPrestiges >= 3 && stage >= 50
}

export type PermanentVisualTrophyId = 'prestige-frame' | 'veteran-glow' | 'god-crown' | 'century-lattice'

/** Lifetime trophies — never removed on prestige reset. */
export function resolvePermanentVisualTrophies(
  maxStageEver: number,
  totalPrestiges: number,
): PermanentVisualTrophyId[] {
  const trophies: PermanentVisualTrophyId[] = []
  if (totalPrestiges >= 1) trophies.push('prestige-frame')
  if (totalPrestiges >= 2) trophies.push('veteran-glow')
  if (totalPrestiges >= 3) trophies.push('god-crown')
  if (maxStageEver >= 100) trophies.push('century-lattice')
  return trophies
}

/** Board material palette for the living-board shell (wood → obsidian → celestial). */
export type BoardEvolutionMaterial = 'wood' | 'obsidian' | 'celestial'

export function getBoardEvolutionMaterial(tier: number): BoardEvolutionMaterial {
  if (tier <= 2) return 'wood'
  if (tier <= 4) return 'obsidian'
  return 'celestial'
}

/** Outer grid frame — shifts with `getBoardEvolutionTier(currentStage)`. */
export function getBoardEvolutionShellClasses(tier: number): string {
  const material = getBoardEvolutionMaterial(tier)
  if (material === 'wood') {
    return 'board-evolution-wood shadow-[0_8px_32px_rgba(120,53,15,0.25)]'
  }
  if (material === 'obsidian') {
    return 'board-evolution-obsidian shadow-[0_8px_36px_rgba(15,23,42,0.55)]'
  }
  return 'board-evolution-celestial shadow-[0_8px_40px_rgba(56,189,248,0.2)]'
}

/** Per-square gradient overlay (stacked on cosmetic theme squares). */
export function getBoardSquareEvolutionClasses(
  tier: number,
  light: boolean,
): string {
  const material = getBoardEvolutionMaterial(tier)
  if (tier <= 0) return ''
  if (material === 'wood') {
    return light
      ? 'board-square-wood-light'
      : 'board-square-wood-dark'
  }
  if (material === 'obsidian') {
    return light
      ? 'board-square-obsidian-light'
      : 'board-square-obsidian-dark'
  }
  return light
    ? 'board-square-celestial-light'
    : 'board-square-celestial-dark'
}

/** Sum of per-track upgrade levels on a piece (power aura intensity). */
export function sumPieceUpgradeLevels(levels: PieceUpgradeLevels): number {
  return levels.ap + levels.hp + levels.def + levels.initiative
}

/**
 * Maps total upgrade ranks to aura tier 0–4 (independent of run visual tier).
 */
export function getPiecePowerAuraTier(levels: PieceUpgradeLevels): number {
  const total = sumPieceUpgradeLevels(levels)
  if (total <= 4) return 0
  if (total <= 12) return 1
  if (total <= 24) return 2
  if (total <= 40) return 3
  return 4
}

/** Level-based drop-shadow / ring glow for player pieces. */
export function getPiecePowerAuraClasses(
  side: 'player' | 'enemy',
  powerTier: number,
): string {
  if (powerTier <= 0 || side !== 'player') return ''
  const shadows = [
    '',
    'drop-shadow-[0_0_4px_rgba(56,189,248,0.45)]',
    'drop-shadow-[0_0_8px_rgba(56,189,248,0.55)] ring-1 ring-sky-400/35',
    'drop-shadow-[0_0_12px_rgba(167,139,250,0.6)] ring-1 ring-violet-400/45',
    'drop-shadow-[0_0_16px_rgba(250,204,21,0.7)] ring-2 ring-amber-300/50 animate-power-aura-pulse',
  ]
  return shadows[Math.min(powerTier, 4)] ?? ''
}

/** Shell backdrop keyed to lifetime stage peaks + active music layers. */
export function getShellAtmosphereClasses(
  maxStageEver: number,
  musicLayers: readonly MusicLayerId[],
): string {
  const stage = Math.max(0, Math.floor(maxStageEver))
  const parts: string[] = ['shell-atmosphere-base']
  if (stage >= 8) parts.push('shell-atmosphere-mid')
  if (stage >= 25) parts.push('shell-atmosphere-high')
  if (stage >= 50) parts.push('shell-atmosphere-deep')
  if (stage >= 100) parts.push('shell-atmosphere-apex')
  if (musicLayers.includes('strings') || musicLayers.includes('orchestral')) {
    parts.push('shell-atmosphere-strings')
  }
  if (musicLayers.includes('celestial')) parts.push('shell-atmosphere-celestial')
  if (musicLayers.includes('god')) parts.push('shell-atmosphere-god')
  return parts.join(' ')
}

/** Tailwind classes for board square evolution (cheap borders only). */
export function getBoardEvolutionClasses(tier: number): { light: string; dark: string } {
  switch (tier) {
    case 0:
      return { light: '', dark: '' }
    case 1:
      return { light: 'ring-1 ring-inset ring-emerald-900/20', dark: 'ring-1 ring-inset ring-emerald-950/30' }
    case 2:
      return { light: 'ring-1 ring-inset ring-sky-900/25', dark: 'ring-1 ring-inset ring-sky-950/35' }
    case 3:
      return {
        light: 'ring-1 ring-inset ring-violet-800/30 shadow-[inset_0_0_12px_rgba(139,92,246,0.08)]',
        dark: 'ring-1 ring-inset ring-violet-950/40 shadow-[inset_0_0_14px_rgba(88,28,135,0.12)]',
      }
    case 4:
      return {
        light: 'ring-1 ring-inset ring-amber-800/25 shadow-[inset_0_0_16px_rgba(245,158,11,0.06)]',
        dark: 'ring-1 ring-inset ring-amber-950/35 shadow-[inset_0_0_18px_rgba(180,83,9,0.1)]',
      }
    case 5:
      return {
        light: 'ring-2 ring-inset ring-cyan-700/20 shadow-[inset_0_0_20px_rgba(34,211,238,0.07)]',
        dark: 'ring-2 ring-inset ring-cyan-950/30 shadow-[inset_0_0_22px_rgba(8,145,178,0.12)]',
      }
    default:
      return {
        light: 'ring-2 ring-inset ring-fuchsia-600/25 shadow-[inset_0_0_24px_rgba(217,70,239,0.1)]',
        dark: 'ring-2 ring-inset ring-fuchsia-950/35 shadow-[inset_0_0_26px_rgba(112,26,117,0.15)]',
      }
  }
}

/** CSS particle-style aura (no canvas — GPU-friendly box-shadow). */
export function getPieceAuraClasses(
  side: 'player' | 'enemy',
  auraTier: number,
  kind: PieceKind,
): string {
  if (auraTier <= 0) return ''
  const isPlayer = side === 'player'
  const base =
    kind === 'king'
      ? isPlayer
        ? 'shadow-[0_0_10px_rgba(56,189,248,0.45)]'
        : 'shadow-[0_0_8px_rgba(251,191,36,0.35)]'
      : isPlayer
        ? 'shadow-[0_0_6px_rgba(56,189,248,0.3)]'
        : 'shadow-[0_0_4px_rgba(244,63,94,0.25)]'

  if (auraTier === 1) return `${base} animate-pulse`
  if (auraTier === 2) {
    return `${base} animate-pulse ring-1 ${isPlayer ? 'ring-sky-400/40' : 'ring-rose-400/30'}`
  }
  if (auraTier === 3) {
    return `${base} animate-pulse ring-2 ${isPlayer ? 'ring-violet-400/50' : 'ring-orange-400/35'}`
  }
  return `${base} animate-pulse ring-2 ${isPlayer ? 'ring-amber-300/60' : 'ring-yellow-500/40'} shadow-[0_0_14px_rgba(250,204,21,0.35)]`
}

/** Shell frame classes from permanent trophies (prestige-persistent). */
export function getPermanentTrophyShellClasses(
  trophies: readonly PermanentVisualTrophyId[],
): string {
  const parts: string[] = []
  if (trophies.includes('prestige-frame')) {
    parts.push('ring-1 ring-amber-500/20 ring-inset')
  }
  if (trophies.includes('veteran-glow')) {
    parts.push('shadow-[0_0_40px_rgba(139,92,246,0.12)]')
  }
  if (trophies.includes('god-crown')) {
    parts.push('shadow-[0_0_60px_rgba(250,204,21,0.15)]')
  }
  if (trophies.includes('century-lattice')) {
    parts.push('bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_55%)]')
  }
  return parts.join(' ')
}

/** Waves cleared in the current run (stage 1 = 0 wins). */
export function getWavesClearedThisRun(currentStage: number): number {
  return Math.max(0, Math.floor(currentStage) - 1)
}

/**
 * Run streak glow from waves cleared this run (resets on prestige).
 * Thresholds tuned so 1–3 wins in a session are visibly different.
 */
export function getRunVictoryGlowTier(wavesClearedThisRun: number): number {
  const w = Math.max(0, Math.floor(wavesClearedThisRun))
  if (w < 1) return 0
  if (w < 3) return 1
  if (w < 5) return 2
  if (w < 8) return 3
  if (w < 12) return 4
  if (w < 18) return 5
  return 6
}

/** Permanent sparkle bonus from lifetime wave clears. */
export function getLifetimeVictoryGlowBonus(lifetimeWavesCleared: number): number {
  const n = Math.max(0, Math.floor(lifetimeWavesCleared))
  if (n < 10) return 0
  if (n < 40) return 1
  if (n < 120) return 2
  return 3
}

export function getVictoryGlowTier(
  wavesClearedThisRun: number,
  lifetimeWavesCleared: number,
): number {
  const run = getRunVictoryGlowTier(wavesClearedThisRun)
  const bonus = getLifetimeVictoryGlowBonus(lifetimeWavesCleared)
  return Math.min(MAX_VICTORY_GLOW_TIER, run + Math.min(2, bonus))
}

export type VictoryGlowLabelId =
  | 'none'
  | 'warm'
  | 'bright'
  | 'shimmer'
  | 'radiant'
  | 'blazing'
  | 'champion'

/** Run-scoped shell backdrop quality (Unicode pieces unchanged). */
export type VictoryBackgroundTier = 'worn' | 'rising' | 'triumphant'

export function getVictoryBackgroundTier(victoryGlowTier: number): VictoryBackgroundTier {
  const t = Math.max(0, Math.floor(victoryGlowTier))
  if (t >= 5) return 'triumphant'
  if (t >= 2) return 'rising'
  return 'worn'
}

export function getVictoryBackgroundShellClasses(tier: VictoryBackgroundTier): string {
  switch (tier) {
    case 'triumphant':
      return 'shell-victory-bg-triumphant'
    case 'rising':
      return 'shell-victory-bg-rising'
    default:
      return 'shell-victory-bg-worn'
  }
}

export function getVictoryGlowLabelId(tier: number): VictoryGlowLabelId {
  if (tier <= 0) return 'none'
  if (tier === 1) return 'warm'
  if (tier === 2) return 'bright'
  if (tier === 3) return 'shimmer'
  if (tier === 4) return 'radiant'
  if (tier === 5) return 'blazing'
  return 'champion'
}

/** CSS classes for standard chess glyphs — glow/sparkle only, no sprite swap. */
export function getPieceVictoryGlowClasses(
  tier: number,
  kind: PieceKind,
  bursting = false,
): string {
  if (tier <= 0) return bursting ? 'victory-glow-burst' : ''
  const king = kind === 'king' ? ' victory-glow-king' : ''
  const burst = bursting ? ' victory-glow-burst' : ''
  if (tier === 1) return `victory-glow-1${king}${burst}`
  if (tier === 2) return `victory-glow-2${king}${burst}`
  if (tier === 3) return `victory-glow-3 victory-glow-sparkle${king}${burst}`
  if (tier === 4) return `victory-glow-4 victory-glow-sparkle${king}${burst}`
  if (tier === 5) return `victory-glow-5 victory-glow-sparkle victory-glow-sparkle-dense${king}${burst}`
  return `victory-glow-6 victory-glow-sparkle victory-glow-sparkle-dense victory-glow-champion${king}${burst}`
}

export interface AestheticProgressSnapshot {
  visualTier: number
  boardEvolutionTier: number
  pieceAuraTier: number
  victoryGlowTier: number
  victoryBackgroundTier: VictoryBackgroundTier
  wavesClearedThisRun: number
  lifetimeWavesCleared: number
  nextVisualTierStage: number | null
  godTierUnlocked: boolean
  permanentTrophies: PermanentVisualTrophyId[]
}

/** Single read for UI — no combat-loop recomputation beyond one getter call. */
export function buildAestheticProgressSnapshot(
  currentStage: number,
  maxStageEver: number,
  totalPrestiges: number,
  lifetimeWavesCleared = 0,
): AestheticProgressSnapshot {
  const wavesClearedThisRun = getWavesClearedThisRun(currentStage)
  return {
    visualTier: getVisualTier(currentStage),
    boardEvolutionTier: getBoardEvolutionTier(currentStage),
    pieceAuraTier: getPieceAuraTier(currentStage),
    victoryGlowTier: getVictoryGlowTier(wavesClearedThisRun, lifetimeWavesCleared),
    victoryBackgroundTier: getVictoryBackgroundTier(
      getVictoryGlowTier(wavesClearedThisRun, lifetimeWavesCleared),
    ),
    wavesClearedThisRun,
    lifetimeWavesCleared,
    nextVisualTierStage: getNextVisualTierStage(currentStage),
    godTierUnlocked: isGodTierVisualUnlocked(maxStageEver, totalPrestiges),
    permanentTrophies: resolvePermanentVisualTrophies(maxStageEver, totalPrestiges),
  }
}

/** Maps a building level to the same visual tier curve used for the living board. */
export function getBuildingVisualTier(buildingLevel: number): number {
  return getVisualTier(Math.max(1, buildingLevel))
}

/** Human-readable building evolution step for town UI. */
export function getBuildingVisualLabel(tier: number): string {
  if (tier <= 0) return 'Shack'
  if (tier <= 2) return 'Hut'
  if (tier <= 4) return 'House'
  if (tier <= 6) return 'Tower'
  if (tier <= 8) return 'Citadel'
  return 'Spire'
}

/** Tailwind skin classes per visual tier (top-down town sprites). */
export function getBuildingVisualClasses(tier: number): string {
  switch (tier) {
    case 0:
      return 'bg-amber-900/80 border-amber-950/60'
    case 1:
      return 'bg-amber-800/85 border-amber-900/70 shadow-[inset_0_-4px_0_rgba(0,0,0,0.15)]'
    case 2:
      return 'bg-stone-700/90 border-stone-600/70 shadow-[inset_0_-6px_0_rgba(0,0,0,0.2)]'
    case 3:
      return 'bg-stone-600/90 border-stone-500/70 ring-1 ring-stone-400/20'
    case 4:
      return 'bg-slate-600/90 border-slate-500/70 shadow-[0_0_12px_rgba(148,163,184,0.15)]'
    case 5:
      return 'bg-sky-900/80 border-sky-700/60 shadow-[0_0_14px_rgba(56,189,248,0.12)]'
    case 6:
      return 'bg-violet-900/80 border-violet-600/50 shadow-[0_0_16px_rgba(139,92,246,0.18)]'
    case 7:
      return 'bg-amber-950/85 border-amber-500/40 shadow-[0_0_18px_rgba(245,158,11,0.2)]'
    default:
      return 'bg-fuchsia-950/85 border-fuchsia-400/40 shadow-[0_0_22px_rgba(217,70,239,0.25)] ring-1 ring-fuchsia-300/30'
  }
}
