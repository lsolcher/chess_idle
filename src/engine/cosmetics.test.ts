import { describe, expect, it } from 'vitest'
import {
  COSMETIC_CATALOG,
  createDefaultLifetimeStats,
  DEFAULT_EQUIPPED_COSMETICS,
  getCosmeticProgress,
  isCosmeticUnlocked,
  resolveCosmeticTheme,
  resolveEquippedCosmetics,
} from './cosmetics'

describe('cosmetics', () => {
  it('unlocks obsidian board at lifetime stage 50', () => {
    const lifetime = createDefaultLifetimeStats(1)
    lifetime.maxStageEverReached = 49
    const obsidian = COSMETIC_CATALOG.find((c) => c.id === 'board-obsidian')!
    expect(isCosmeticUnlocked(obsidian, lifetime)).toBe(false)
    lifetime.maxStageEverReached = 50
    expect(isCosmeticUnlocked(obsidian, lifetime)).toBe(true)
  })

  it('unlocks golden army at 1M lifetime gold', () => {
    const lifetime = createDefaultLifetimeStats(1)
    const golden = COSMETIC_CATALOG.find((c) => c.id === 'skin-golden')!
    lifetime.lifetimeGoldEarned = 999_999
    expect(isCosmeticUnlocked(golden, lifetime)).toBe(false)
    lifetime.lifetimeGoldEarned = 1_000_000
    expect(isCosmeticUnlocked(golden, lifetime)).toBe(true)
    const progress = getCosmeticProgress(golden, lifetime)
    expect(progress?.percent).toBe(100)
  })

  it('resolves theme classes from equipped ids', () => {
    const lifetime = createDefaultLifetimeStats(50)
    lifetime.lifetimeGoldEarned = 2_000_000
    const equipped = {
      ...DEFAULT_EQUIPPED_COSMETICS,
      boardThemeId: 'board-obsidian',
      pieceSkinId: 'skin-golden',
      shellBackgroundId: 'shell-void',
    }
    const theme = resolveCosmeticTheme(equipped, lifetime)
    expect(theme.boardDark).toContain('black')
    expect(theme.playerPiece).toContain('amber')
    expect(theme.shell).toContain('gradient')
  })

  it('falls back when equipped id is locked', () => {
    const lifetime = createDefaultLifetimeStats(1)
    const equipped = {
      ...DEFAULT_EQUIPPED_COSMETICS,
      boardThemeId: 'board-obsidian',
    }
    const safe = resolveEquippedCosmetics(equipped, lifetime)
    expect(safe.boardThemeId).toBe('board-classic')
  })
})
