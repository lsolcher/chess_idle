/**
 * Bridges game wave state → procedural music mode; unlocks audio on first interaction.
 */
import { onMounted, onUnmounted, watch } from 'vue'
import { useAudioStore } from '@/store/audioStore'
import { useGameStore } from '@/store'

export function useGameAudio(): void {
  const game = useGameStore()
  const audio = useAudioStore()

  function syncMusic(): void {
    audio.syncMusicMode({
      wavePhase: game.wavePhase,
      isBossStage: game.isCurrentStageBoss,
      maxStageEver: game.lifetime.maxStageEverReached,
      totalPrestiges: game.lifetime.totalPrestiges,
      musicLayersEnabled: game.aestheticPreferences.musicLayers,
    })
  }

  watch(
    () => [
      game.wavePhase,
      game.currentStage,
      game.isCurrentStageBoss,
      game.lifetime.maxStageEverReached,
      game.lifetime.totalPrestiges,
      game.aestheticPreferences.musicLayers,
      audio.muted,
      audio.unlocked,
    ],
    syncMusic,
    { immediate: true },
  )

  const onFirstPointer = (): void => {
    void audio.unlockFromGesture()
    syncMusic()
  }

  onMounted(() => {
    window.addEventListener('pointerdown', onFirstPointer, { once: true })
    window.addEventListener('keydown', onFirstPointer, { once: true })
  })

  onUnmounted(() => {
    window.removeEventListener('pointerdown', onFirstPointer)
    window.removeEventListener('keydown', onFirstPointer)
  })
}
