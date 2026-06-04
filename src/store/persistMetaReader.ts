/**
 * Reads persisted meta-store QoL flags without importing `metaStore` (breaks circular deps).
 */
import { resolvePersistStorage } from '@/store/persistStorage'
import { META_STORE_PERSIST_KEY } from '@/version'

export { META_STORE_PERSIST_KEY } from '@/version'

interface PersistedMetaSlice {
  convenienceUpgrades?: {
    offlineGoldMultiplier?: boolean
  }
}

export function readPersistedSupporterOfflineMultiplier(): boolean {
  try {
    const raw = resolvePersistStorage().getItem(META_STORE_PERSIST_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as PersistedMetaSlice
    return Boolean(parsed.convenienceUpgrades?.offlineGoldMultiplier)
  } catch {
    return false
  }
}
