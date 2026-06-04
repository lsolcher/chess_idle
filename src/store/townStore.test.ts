import { beforeEach, describe, expect, it } from 'vitest'
import { createPiniaForTest, useGameStore } from '@/store/gameStore'
import { useMetaStore } from '@/store/metaStore'
import { useTownStore } from '@/store/townStore'

describe('useTownStore', () => {
  beforeEach(() => {
    createPiniaForTest()
  })

  it('upgrades barracks with skill points after construction', () => {
    const meta = useMetaStore()
    const town = useTownStore()
    meta.skillPoints = 5

    expect(town.upgradeBuilding('barracks', 0)).toBe(true)
    expect(town.buildings.barracks.level).toBe(0)
    expect(town.isUpgrading('barracks', 0)).toBe(true)

    const completeAt = town.buildings.barracks.upgradeCompleteAtMs!
    town.tickTown(completeAt)
    expect(town.buildings.barracks.level).toBe(1)
    expect(town.townBonuses.apMult).toBeGreaterThan(1)
    expect(meta.skillPoints).toBe(4)
  })

  it('upgrades treasury with elo shards', () => {
    const game = useGameStore()
    const town = useTownStore()
    game.initGame(0)
    game.addEloShards(3)

    expect(town.upgradeBuilding('treasury', 0)).toBe(true)
    const completeAt = town.buildings.treasury.upgradeCompleteAtMs!
    town.tickTown(completeAt)

    expect(town.buildings.treasury.level).toBe(1)
    expect(game.eloShards).toBe(2)
    expect(town.townBonuses.goldMult).toBeGreaterThan(1)
  })

  it('applies town bonuses to game store meta modifiers', () => {
    const game = useGameStore()
    const town = useTownStore()
    game.initGame(0)

    town.buildings.barracks.level = 10
    town.buildings.academy.level = 5
    town.buildings.treasury.level = 4
    game.applyMetaModifiers()

    expect(game.prestigeGoldMult).toBeGreaterThan(1)
    expect(game.globalSpeedMult).toBeGreaterThan(1)
    expect(game.metaModifiers.apMult).toBeGreaterThan(1)
  })
})
