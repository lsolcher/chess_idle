import { beforeEach, describe, expect, it } from 'vitest'
import { migratePersistStorageKeys } from '@/store/persistMigration'
import { resolvePersistStorage } from '@/store/persistStorage'
import {
  GAME_SAVE_STORAGE_KEY,
  LEGACY_GAME_SAVE_STORAGE_KEY,
  META_STORE_PERSIST_KEY,
  LEGACY_META_STORE_PERSIST_KEY,
} from '@/version'

describe('persistMigration', () => {
  beforeEach(() => {
    const storage = resolvePersistStorage()
    storage.clear()
  })

  it('copies legacy game save to v0.3 key', () => {
    const storage = resolvePersistStorage()
    storage.setItem(LEGACY_GAME_SAVE_STORAGE_KEY, '{"test":true}')
    migratePersistStorageKeys()
    expect(storage.getItem(GAME_SAVE_STORAGE_KEY)).toBe('{"test":true}')
  })

  it('copies legacy meta save to v2 key', () => {
    const storage = resolvePersistStorage()
    storage.setItem(LEGACY_META_STORE_PERSIST_KEY, '{"skillPoints":5}')
    migratePersistStorageKeys()
    expect(storage.getItem(META_STORE_PERSIST_KEY)).toBe('{"skillPoints":5}')
  })
})
