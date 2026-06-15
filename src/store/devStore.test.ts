import { beforeEach, describe, expect, it } from 'vitest'
import { isDevGodModeActive, setDevGodModeActive } from '@/engine/devGodMode'
import { isDevModeRuntimeEnabled } from '@/engine/devModeRuntime'
import { createPiniaForTest, useGameStore } from './gameStore'
import { useDevStore } from './devStore'

describe('useDevStore', () => {
  beforeEach(() => {
    setDevGodModeActive(false)
    createPiniaForTest()
  })

  it('grants gold via cheat dispatch', () => {
    const game = useGameStore()
    game.initGame(0)
    const dev = useDevStore()
    dev.enableDevMode()
    dev.runCheat('addGold10k')
    expect(game.gold).toBe(10_000)
  })

  it('syncs god mode runtime flags', () => {
    const dev = useDevStore()
    dev.enableDevMode()
    dev.toggleGodMode()
    expect(dev.godMode).toBe(true)
    expect(isDevGodModeActive()).toBe(true)
    expect(isDevModeRuntimeEnabled()).toBe(true)
    dev.disableDevMode()
    expect(isDevGodModeActive()).toBe(false)
    expect(isDevModeRuntimeEnabled()).toBe(false)
  })
})
