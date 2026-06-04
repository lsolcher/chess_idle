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
import type { PieceKind } from '@/types/game'

export const VISUAL_TIER_EXPONENT = 1.5
export const VISUAL_TIER_ANCHOR = 1
export const MAX_VISUAL_TIER = 12
export const MAX_BOARD_EVOLUTION_TIER = 6
export const MAX_PIECE_AURA_TIER = 4

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

export interface AestheticProgressSnapshot {
  visualTier: number
  boardEvolutionTier: number
  pieceAuraTier: number
  nextVisualTierStage: number | null
  godTierUnlocked: boolean
  permanentTrophies: PermanentVisualTrophyId[]
}

/** Single read for UI — no combat-loop recomputation beyond one getter call. */
export function buildAestheticProgressSnapshot(
  currentStage: number,
  maxStageEver: number,
  totalPrestiges: number,
): AestheticProgressSnapshot {
  return {
    visualTier: getVisualTier(currentStage),
    boardEvolutionTier: getBoardEvolutionTier(currentStage),
    pieceAuraTier: getPieceAuraTier(currentStage),
    nextVisualTierStage: getNextVisualTierStage(currentStage),
    godTierUnlocked: isGodTierVisualUnlocked(maxStageEver, totalPrestiges),
    permanentTrophies: resolvePermanentVisualTrophies(maxStageEver, totalPrestiges),
  }
}
