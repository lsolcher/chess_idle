/** Runtime dev flags read by gameStore without importing devStore (avoids cycles). */
import { setDevGodModeActive } from '@/engine/devGodMode'

let devModeEnabled = false

export function setDevModeRuntimeEnabled(enabled: boolean, godMode: boolean): void {
  devModeEnabled = enabled
  setDevGodModeActive(enabled && godMode)
}

export function isDevModeRuntimeEnabled(): boolean {
  return devModeEnabled
}
