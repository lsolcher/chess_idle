import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createInitialGameState, createPiece } from '@/types/game'
import {
  bootstrapPersistedRosters,
  GAME_SAVE_STORAGE_KEY,
  gameStorePersistConfig,
  restorePersistedSession,
  resolvePersistStorage,
} from './persistConfig'
function mockLocalStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key)
    },
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}

describe('game store persistence', () => {
  beforeEach(() => {
    const storage = mockLocalStorage()
    vi.stubGlobal('localStorage', storage)
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    setActivePinia(pinia)
  })

  it('preserves mid-wave board on restore', () => {
    const state = createInitialGameState(0)
    state.wavePhase = 'WAVE_ACTIVE'
    state.enemyPieces = [createPiece('e1', 'pawn', 'enemy', { file: 4, rank: 6 })]

    const patch = restorePersistedSession(state, 1000)
    expect(patch.wavePhase).toBe('WAVE_ACTIVE')
    expect(patch.enemyPieces).toHaveLength(1)
    expect(patch.combatLoopRunning).toBe(false)
  })

  it('still resets prep room enemies to empty', () => {
    const state = createInitialGameState(0)
    state.wavePhase = 'WAVE_PREP'
    state.enemyPieces = [createPiece('e1', 'pawn', 'enemy', { file: 4, rank: 6 })]

    const patch = restorePersistedSession(state, 1000)
    expect(patch.wavePhase).toBe('WAVE_PREP')
    expect(patch.enemyPieces).toEqual([])
  })

  it('memory storage adapter round-trips JSON snapshots', () => {
    const storage = resolvePersistStorage()
    const snapshot = JSON.stringify({ currencies: { gold: 999 }, currentStage: 7 })
    storage.setItem(GAME_SAVE_STORAGE_KEY, snapshot)
    const raw = storage.getItem(GAME_SAVE_STORAGE_KEY)
    expect(raw).toContain('"gold":999')
    expect(raw).toContain('"currentStage":7')
  })

  it('omit list keeps wave board but strips VFX timers', () => {
    expect(gameStorePersistConfig.omit).toContain('combatFeedbackEvents')
    expect(gameStorePersistConfig.omit).not.toContain('enemyPieces')
    expect(gameStorePersistConfig.omit).not.toContain('wavePhase')
  })

  it('bootstrap does not heal roster during active wave', () => {
    const state = createInitialGameState(0)
    const king = state.playerPieces[0]!
    king.stats.hp = 10
    state.wavePhase = 'WAVE_ACTIVE'
    state.enemyPieces = [createPiece('e1', 'pawn', 'enemy', { file: 3, rank: 5 })]

    const rosters = bootstrapPersistedRosters(state, 5000)
    expect(rosters.playerPieces[0]?.stats.hp).toBe(10)
    expect(rosters.enemyPieces).toHaveLength(1)
  })
})
