/**
 * One-time localStorage key migration for v0.3.0 (preserves v0.2 saves).
 */
import { resolvePersistStorage } from '@/store/persistStorage'
import {
  AUDIO_SAVE_STORAGE_KEY,
  GAME_SAVE_STORAGE_KEY,
  LEGACY_AUDIO_SAVE_STORAGE_KEY,
  LEGACY_GAME_SAVE_STORAGE_KEY,
  LEGACY_META_STORE_PERSIST_KEY,
  META_STORE_PERSIST_KEY,
} from '@/version'

function copyKeyIfMissing(storage: Storage, nextKey: string, legacyKey: string): void {
  if (storage.getItem(nextKey)) return
  const legacy = storage.getItem(legacyKey)
  if (legacy) {
    storage.setItem(nextKey, legacy)
  }
}

/** Run before Pinia hydrate so persisted plugins read v0.3 keys. */
export function migratePersistStorageKeys(): void {
  const storage = resolvePersistStorage()
  copyKeyIfMissing(storage, GAME_SAVE_STORAGE_KEY, LEGACY_GAME_SAVE_STORAGE_KEY)
  copyKeyIfMissing(storage, META_STORE_PERSIST_KEY, LEGACY_META_STORE_PERSIST_KEY)
  copyKeyIfMissing(storage, AUDIO_SAVE_STORAGE_KEY, LEGACY_AUDIO_SAVE_STORAGE_KEY)
}
