import { onMounted, onUnmounted } from 'vue'
import { DEV_MODE_HOTKEY } from '@/config/devMode'
import { useDevStore } from '@/store/devStore'

export function useDevModeHotkeys(): void {
  const dev = useDevStore()

  function onKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey && event.shiftKey && event.code === DEV_MODE_HOTKEY)) return
    event.preventDefault()
    dev.togglePanel()
  }

  onMounted(() => {
    dev.syncGodModeToEngine()
    window.addEventListener('keydown', onKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
  })
}
