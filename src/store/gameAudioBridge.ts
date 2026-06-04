/**
 * Thin bridge so gameStore actions can fire SFX without duplicating Pinia guards.
 */
import { useAudioStore } from '@/store/audioStore'
import type { SfxId } from '@/engine/proceduralAudio'

export function playGameSfx(id: SfxId): void {
  try {
    useAudioStore().playSfx(id)
  } catch {
    // Pinia not active (isolated engine tests).
  }
}

export function playCombatFeedbackAudio(kinds: string[]): void {
  try {
    const audio = useAudioStore()
    for (const kind of kinds) {
      audio.playFeedback(kind)
    }
  } catch {
    // Pinia not active.
  }
}
