/**
 * Staged procedural music layers — unlocked by lifetime stage & prestige (Phase 8.6).
 *
 * Base layer always plays when music is on. Additional layers stack additively on each tick.
 * Early layers target stages 2–18 (first ~30 minutes); god layer needs prestige ≥ 3 & stage ≥ 50.
 */
import type { LifetimeStats } from '@/types/game'

/** All stackable music layers (12 total — matches roadmap). */
export type MusicLayerId =
  | 'base'
  | 'synth'
  | 'arpeggio'
  | 'percussion'
  | 'pulse'
  | 'harmony'
  | 'strings'
  | 'choral'
  | 'brass'
  | 'orchestral'
  | 'celestial'
  | 'god'

/** Layers with explicit symphonic mix profiles (dynamic balance pass). */
export const DYNAMIC_MIX_LAYER_IDS = [
  'base',
  'synth',
  'arpeggio',
  'choral',
  'orchestral',
] as const satisfies readonly MusicLayerId[]

export type DynamicMixLayerId = (typeof DYNAMIC_MIX_LAYER_IDS)[number]

export interface MusicLayerDefinition {
  id: MusicLayerId
  label: string
  /** Lifetime best stage required (maxStageEverReached). */
  stage: number
  /** Lifetime prestige count required. */
  prestige: number
}

/**
 * Unlock table — documented in tasks.md.
 * First three melodic layers: stages 2, 5, 8 (rapid early dopamine).
 */
export const MUSIC_LAYER_DEFINITIONS: readonly MusicLayerDefinition[] = [
  { id: 'base', label: 'Foundation pad', stage: 0, prestige: 0 },
  { id: 'synth', label: 'Warm synth', stage: 2, prestige: 0 },
  { id: 'arpeggio', label: 'Melodic arpeggio', stage: 5, prestige: 0 },
  { id: 'percussion', label: 'Soft percussion', stage: 8, prestige: 0 },
  { id: 'pulse', label: 'Rhythm pulse', stage: 12, prestige: 0 },
  { id: 'harmony', label: 'Harmony bed', stage: 18, prestige: 0 },
  { id: 'strings', label: 'String pad', stage: 25, prestige: 0 },
  { id: 'choral', label: 'Choral wash', stage: 35, prestige: 1 },
  { id: 'brass', label: 'Brass accent', stage: 50, prestige: 1 },
  { id: 'orchestral', label: 'Orchestral swell', stage: 70, prestige: 2 },
  { id: 'celestial', label: 'Celestial bells', stage: 100, prestige: 2 },
  { id: 'god', label: 'God-tier choir', stage: 50, prestige: 3 },
] as const

export const MUSIC_LAYER_UNLOCK_TABLE: readonly {
  layer: MusicLayerId
  stage: number
  prestige: number
}[] = MUSIC_LAYER_DEFINITIONS.map((d) => ({
  layer: d.id,
  stage: d.stage,
  prestige: d.prestige,
}))

/** Per-layer mix bias: early-run vs late-run emphasis (0–1 stage curve anchor). */
const DYNAMIC_MIX_PROFILE: Record<
  DynamicMixLayerId,
  { earlyBoost: number; lateBoost: number; prestigeBias: number }
> = {
  base: { earlyBoost: 1.12, lateBoost: 0.88, prestigeBias: 0.02 },
  synth: { earlyBoost: 1.18, lateBoost: 0.82, prestigeBias: 0.04 },
  arpeggio: { earlyBoost: 1.15, lateBoost: 0.9, prestigeBias: 0.03 },
  choral: { earlyBoost: 0.75, lateBoost: 1.22, prestigeBias: 0.12 },
  orchestral: { earlyBoost: 0.7, lateBoost: 1.28, prestigeBias: 0.15 },
}

/**
 * Adjusts per-layer gain for the active procedural stack.
 * Early stages emphasize base/synth/arpeggio; high stage + prestige swell choral/orchestral.
 */
export function computeDynamicLayerGain(
  layerId: MusicLayerId,
  currentStage: number,
  prestigeLevel: number,
): number {
  if (!(DYNAMIC_MIX_LAYER_IDS as readonly string[]).includes(layerId)) {
    return 1
  }

  const profile = DYNAMIC_MIX_PROFILE[layerId as DynamicMixLayerId]
  const stage = Math.max(1, Math.floor(currentStage))
  const prestiges = Math.max(0, Math.floor(prestigeLevel))

  const stageT = Math.min(1, Math.log10(stage + 1) / Math.log10(101))
  const earlyWeight = 1 - stageT
  const lateWeight = stageT
  const prestigeLift = Math.min(0.35, prestiges * profile.prestigeBias)

  const blend =
    profile.earlyBoost * earlyWeight +
    profile.lateBoost * lateWeight +
    prestigeLift

  return Math.max(0.55, Math.min(1.45, blend))
}

/** Layers unlocked for this lifetime profile (always includes base when music enabled). */
export function getUnlockedMusicLayers(
  maxStageEver: number,
  totalPrestiges: number,
): MusicLayerId[] {
  const stage = Math.max(0, Math.floor(maxStageEver))
  const prestiges = Math.max(0, Math.floor(totalPrestiges))
  return MUSIC_LAYER_DEFINITIONS.filter(
    (layer) => stage >= layer.stage && prestiges >= layer.prestige,
  ).map((layer) => layer.id)
}

export function isMusicLayerUnlocked(
  layerId: MusicLayerId,
  lifetime: Pick<LifetimeStats, 'maxStageEverReached' | 'totalPrestiges'>,
): boolean {
  const def = MUSIC_LAYER_DEFINITIONS.find((d) => d.id === layerId)
  if (!def) return false
  return (
    lifetime.maxStageEverReached >= def.stage &&
    lifetime.totalPrestiges >= def.prestige
  )
}

export function getMusicLayerProgress(
  layer: MusicLayerDefinition,
  lifetime: Pick<LifetimeStats, 'maxStageEverReached' | 'totalPrestiges'>,
): { unlocked: boolean; stagePct: number; prestigeMet: boolean } {
  const stagePct =
    layer.stage <= 0
      ? 100
      : Math.min(100, Math.round((lifetime.maxStageEverReached / layer.stage) * 100))
  const prestigeMet = lifetime.totalPrestiges >= layer.prestige
  const unlocked =
    lifetime.maxStageEverReached >= layer.stage && prestigeMet
  return { unlocked, stagePct, prestigeMet }
}
