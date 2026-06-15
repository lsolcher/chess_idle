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
      currentStage: game.currentStage,
      maxStageEver: game.lifetime.maxStageEverReached,
      totalPrestiges: game.lifetime.totalPrestiges,
      musicLayersEnabled: game.aestheticPreferences.musicLayers,
    })
  }

  function syncGrandmasterDrone(): void {
    const mods = game.grandmasterCombatModifiers
    const bossAlive = game.enemyPieces.some(
      (p) => p.isBoss && p.kind === 'king' && p.stats.hp > 0,
    )
    audio.syncGrandmasterTension(
      bossAlive && mods.phase === 3 && game.wavePhase === 'WAVE_ACTIVE',
    )
  }

  watch(
    () => [
      game.wavePhase,
      game.currentStage,
      game.isCurrentStageBoss,
      game.lifetime.maxStageEverReached,
      game.lifetime.totalPrestiges,
      game.aestheticPreferences.musicLayers,
      game.grandmasterCombatModifiers.phase,
      game.enemyPieces.map((p) => `${p.id}:${p.stats.hp}`).join('|'),
      audio.muted,
      audio.unlocked,
    ],
    () => {
      syncMusic()
      syncGrandmasterDrone()
    },
    { immediate: true },
  )

  const onFirstPointer = (): void => {
    void audio.unlockFromGesture()
    syncMusic()
    syncGrandmasterDrone()
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
