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
