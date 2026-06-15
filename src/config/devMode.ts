/** Dev mode hotkey and feature flags (cheats are not part of campaign saves). */

export const DEV_MODE_HOTKEY = 'KeyD'

export function isViteDevBuild(): boolean {
  return import.meta.env.DEV
}
