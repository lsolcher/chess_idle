/**
 * Adaptive AI — single auto-play profile scaled by prestige Elo (replaces 3-way personality picker).
 */
import type { AutoAiPersonality } from '@/types/game'
import type { PersonalityScales } from '@/engine/aiHeuristic'
import { personalityScale } from '@/engine/aiHeuristic'

export const ADAPTIVE_AI_PERSONALITY: AutoAiPersonality = 'adaptive'

/**
 * Resolves which heuristic personality scales to apply from account progression.
 */
export function resolveAdaptiveHeuristicPersonality(
  eloShards: number,
  maxStageReached: number,
): AutoAiPersonality {
  if (maxStageReached < 12) return 'defensive'
  if (eloShards < 8) return 'defensive'
  if (maxStageReached < 35) return 'aggressive'
  if (eloShards < 25) return 'aggressive'
  return 'protectKing'
}

export type EffectiveAiPersonality = 'aggressive' | 'defensive' | 'protectKing'

/** Effective personality for move scoring (adaptive maps to a concrete profile). */
export function resolveEffectiveAutoAiPersonality(
  personality: AutoAiPersonality,
  eloShards: number,
  maxStageReached: number,
): EffectiveAiPersonality {
  if (
    personality === 'aggressive' ||
    personality === 'defensive' ||
    personality === 'protectKing'
  ) {
    return personality
  }
  return resolveAdaptiveHeuristicPersonality(eloShards, maxStageReached)
}

export function getAdaptivePersonalityScales(
  eloShards: number,
  maxStageReached: number,
): PersonalityScales {
  const resolved = resolveAdaptiveHeuristicPersonality(eloShards, maxStageReached)
  return personalityScale(resolved)
}
