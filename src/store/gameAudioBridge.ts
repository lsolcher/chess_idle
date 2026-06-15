/**
 * Thin bridge so gameStore actions can fire SFX without duplicating Pinia guards.
 */
import type { CombatFeedbackEvent } from '@/engine/combatFeedback'
import { useAudioStore } from '@/store/audioStore'
import type { SfxId } from '@/engine/proceduralAudio'

export function playGameSfx(id: SfxId): void {
  try {
    useAudioStore().playSfx(id)
  } catch {
    // Pinia not active (isolated engine tests).
  }
}

export function playCombatFeedbackAudio(events: CombatFeedbackEvent[]): void {
  try {
    useAudioStore().playCombatFeedbackEvents(events)
  } catch {
    // Pinia not active.
  }
}

export function playPrestigeChimeAudio(): void {
  try {
    useAudioStore().playPrestigeChime()
  } catch {
    // Pinia not active.
  }
}
