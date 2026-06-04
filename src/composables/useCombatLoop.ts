import { onMounted, onUnmounted } from 'vue'

import { useGameStore } from '@/store'



/**

 * Drives the event-driven initiative loop via requestAnimationFrame.

 * Ticks only during WAVE_ACTIVE — prep and clear phases freeze initiative combat.

 */

export function useCombatLoop(): { start: () => void; stop: () => void } {

  const store = useGameStore()

  let frameId = 0



  const loop = (): void => {
    store.tickExhibitions()
    store.tickWaveAutomation()
    if (store.isWaveActive && store.isCombatLoopRunning) {
      store.tickCombat()
    }
    frameId = requestAnimationFrame(loop)
  }



  const start = (): void => {

    if (frameId) return

    frameId = requestAnimationFrame(loop)

  }



  const stop = (): void => {

    cancelAnimationFrame(frameId)

    frameId = 0

  }



  onMounted(() => {

    start()

  })



  onUnmounted(() => {

    stop()

  })



  return { start, stop }

}

