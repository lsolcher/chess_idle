import { describe, expect, it } from 'vitest'
import { getBuildingVisualLabel, getBuildingVisualTier } from '@/engine/aestheticProgression'
import {
  createDefaultTownBuildings,
  getBuildingUpgradeCost,
  getConstructionProgressForBuilding,
  getTownBonuses,
  mergeTownBonuses,
  runTownBuildingsSanityCheck,
  startBuildingUpgrade,
  tickTownConstruction,
  TOWN_BUILDING_DEFINITIONS,
} from '@/engine/townBuildings'
import { calculateMetaModifiers } from '@/engine/metaUpgrades'
import { createDefaultMetaUpgrades } from '@/types/game'

describe('townBuildings', () => {
  it('passes sanity check', () => {
    expect(runTownBuildingsSanityCheck().passed).toBe(true)
  })

  it('scales barracks AP bonus by level', () => {
    const buildings = createDefaultTownBuildings()
    buildings.barracks.level = 5
    expect(getTownBonuses(buildings).apMult).toBeCloseTo(1.1, 5)
  })

  it('merges town bonuses into meta modifiers', () => {
    const meta = calculateMetaModifiers(createDefaultMetaUpgrades())
    const town = getTownBonuses({
      ...createDefaultTownBuildings(),
      treasury: { level: 4, upgradeCompleteAtMs: null },
    })
    const merged = mergeTownBonuses(meta, town)
    expect(merged.goldMult).toBeGreaterThan(meta.goldMult)
  })

  it('runs construction timer then levels up', () => {
    const started = startBuildingUpgrade('academy', createDefaultTownBuildings(), 1_000)!
    const completeAt = started.academy.upgradeCompleteAtMs!
    expect(getConstructionProgressForBuilding('academy', started.academy, 1_000)).toBe(0)
    expect(getConstructionProgressForBuilding('academy', started.academy, completeAt - 1)).toBeLessThan(
      1,
    )
    const ticked = tickTownConstruction(started, completeAt)
    expect(ticked.buildings.academy.level).toBe(1)
    expect(ticked.completed).toHaveLength(1)
  })

  it('maps building levels to aesthetic visual tiers', () => {
    expect(getBuildingVisualTier(1)).toBe(1)
    expect(getBuildingVisualLabel(getBuildingVisualTier(8))).toBe('House')
    expect(getBuildingVisualLabel(getBuildingVisualTier(15))).toBe('Tower')
  })

  it('charges elo for treasury and skill points for barracks', () => {
    expect(TOWN_BUILDING_DEFINITIONS.barracks.currency).toBe('skillPoints')
    expect(TOWN_BUILDING_DEFINITIONS.treasury.currency).toBe('eloShards')
    expect(getBuildingUpgradeCost('treasury', 0)).toBe(1)
    expect(getBuildingUpgradeCost('barracks', 2)).toBeGreaterThan(1)
  })
})
