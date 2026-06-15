import { describe, expect, it } from 'vitest'
import {
  APP_VERSION,
  GAME_SCHEMA_VERSION,
  GAME_SAVE_STORAGE_KEY,
  GHOST_ARMY_SCHEMA_VERSION,
  META_STORE_PERSIST_KEY,
} from '@/version'

describe('version', () => {
  it('bumps client release while save schema stays on 0.3.0 until migration', () => {
    expect(APP_VERSION).toBe('0.4.0')
    expect(GAME_SCHEMA_VERSION).toBe('0.3.0')
  })

  it('uses v0.3 storage keys', () => {
    expect(GAME_SAVE_STORAGE_KEY).toContain('v0.3')
    expect(META_STORE_PERSIST_KEY).toContain('meta-v2')
    expect(GHOST_ARMY_SCHEMA_VERSION).toBe('0.8.0')
  })
})
