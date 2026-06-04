/**
 * Cosmetic unlock catalog and theme resolution (Phase 8 / GDD cosmetics).
 * Thresholds are lifetime metrics — they survive prestige resets.
 */
import type { LifetimeStats } from '@/types/game'

export type CosmeticCategory = 'board' | 'pieceSkin' | 'shell'

export type CosmeticRequirementType = 'maxStageEver' | 'lifetimeGold' | 'totalUpgrades'

export interface CosmeticRequirement {
  type: CosmeticRequirementType
  /** Inclusive threshold — unlock when lifetime metric >= value. */
  value: number
}

/** Tailwind utility classes applied when a cosmetic is equipped. */
export interface CosmeticThemeClasses {
  boardLight?: string
  boardDark?: string
  playerPiece?: string
  enemyPiece?: string
  shell?: string
}

export interface CosmeticDefinition {
  id: string
  category: CosmeticCategory
  name: string
  description: string
  requirement: CosmeticRequirement | null
  classes: CosmeticThemeClasses
}

export interface EquippedCosmetics {
  boardThemeId: string
  pieceSkinId: string
  shellBackgroundId: string
}

export const DEFAULT_EQUIPPED_COSMETICS: EquippedCosmetics = {
  boardThemeId: 'board-classic',
  pieceSkinId: 'skin-classic',
  shellBackgroundId: 'shell-classic',
}

/**
 * Static wardrobe catalog — extend here for new visual rewards.
 */
export const COSMETIC_CATALOG: readonly CosmeticDefinition[] = [
  {
    id: 'board-classic',
    category: 'board',
    name: 'Classic Slate',
    description: 'Default training board.',
    requirement: null,
    classes: {
      boardLight: 'bg-board-light/80',
      boardDark: 'bg-board-dark/90',
    },
  },
  {
    id: 'board-emerald',
    category: 'board',
    name: 'Emerald Court',
    description: 'Reach stage 25 (lifetime best) to unlock.',
    requirement: { type: 'maxStageEver', value: 25 },
    classes: {
      boardLight: 'bg-emerald-800/70',
      boardDark: 'bg-emerald-950/90',
    },
  },
  {
    id: 'board-obsidian',
    category: 'board',
    name: 'Obsidian Grid',
    description: 'Reach stage 50 (lifetime best) to unlock.',
    requirement: { type: 'maxStageEver', value: 50 },
    classes: {
      boardLight: 'bg-zinc-600/75',
      boardDark: 'bg-black/90',
    },
  },
  {
    id: 'skin-classic',
    category: 'pieceSkin',
    name: 'Classic Ivory',
    description: 'Standard piece colors.',
    requirement: null,
    classes: {
      playerPiece: 'text-sky-200 drop-shadow',
      enemyPiece: 'text-rose-300 drop-shadow',
    },
  },
  {
    id: 'skin-golden',
    category: 'pieceSkin',
    name: 'Golden Army',
    description: 'Earn 1,000,000 lifetime gold to unlock.',
    requirement: { type: 'lifetimeGold', value: 1_000_000 },
    classes: {
      playerPiece: 'text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.65)]',
      enemyPiece: 'text-orange-300 drop-shadow-[0_0_4px_rgba(251,146,60,0.5)]',
    },
  },
  {
    id: 'skin-ivory-veteran',
    category: 'pieceSkin',
    name: 'Veteran Ivory',
    description: 'Purchase 50 upgrades (lifetime) to unlock.',
    requirement: { type: 'totalUpgrades', value: 50 },
    classes: {
      playerPiece: 'text-slate-100 drop-shadow-md',
      enemyPiece: 'text-rose-200/90 drop-shadow',
    },
  },
  {
    id: 'shell-classic',
    category: 'shell',
    name: 'Midnight Slate',
    description: 'Default app backdrop.',
    requirement: null,
    classes: {
      shell: 'bg-slate-950',
    },
  },
  {
    id: 'shell-void',
    category: 'shell',
    name: 'Void Nebula',
    description: 'Earn 500,000 lifetime gold to unlock.',
    requirement: { type: 'lifetimeGold', value: 500_000 },
    classes: {
      shell: 'bg-gradient-to-b from-indigo-950 via-slate-950 to-black',
    },
  },
  {
    id: 'shell-royal',
    category: 'shell',
    name: 'Royal Study',
    description: 'Reach stage 40 (lifetime best) to unlock.',
    requirement: { type: 'maxStageEver', value: 40 },
    classes: {
      shell: 'bg-gradient-to-br from-slate-900 via-amber-950/30 to-slate-950',
    },
  },
] as const

export function createDefaultLifetimeStats(
  maxStageReached = 1,
): LifetimeStats {
  return {
    maxStageEverReached: maxStageReached,
    lifetimeGoldEarned: 0,
    totalUpgradesBought: 0,
    totalPrestiges: 0,
  }
}

export function createDefaultEquippedCosmetics(): EquippedCosmetics {
  return { ...DEFAULT_EQUIPPED_COSMETICS }
}

/** Reads the lifetime metric referenced by a cosmetic requirement. */
export function readLifetimeMetric(
  lifetime: LifetimeStats,
  type: CosmeticRequirementType,
): number {
  switch (type) {
    case 'maxStageEver':
      return lifetime.maxStageEverReached
    case 'lifetimeGold':
      return lifetime.lifetimeGoldEarned
    case 'totalUpgrades':
      return lifetime.totalUpgradesBought
    default:
      return 0
  }
}

/** Always-unlocked defaults have `requirement: null`. */
export function isCosmeticUnlocked(
  def: CosmeticDefinition,
  lifetime: LifetimeStats,
): boolean {
  if (!def.requirement) return true
  return readLifetimeMetric(lifetime, def.requirement.type) >= def.requirement.value
}

export interface CosmeticProgress {
  current: number
  target: number
  percent: number
}

export function getCosmeticProgress(
  def: CosmeticDefinition,
  lifetime: LifetimeStats,
): CosmeticProgress | null {
  if (!def.requirement) return null
  const current = readLifetimeMetric(lifetime, def.requirement.type)
  const target = def.requirement.value
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100
  return { current, target, percent }
}

export function findCosmeticById(id: string): CosmeticDefinition | undefined {
  return COSMETIC_CATALOG.find((c) => c.id === id)
}

export function listCosmeticsByCategory(
  category: CosmeticCategory,
): CosmeticDefinition[] {
  return COSMETIC_CATALOG.filter((c) => c.category === category)
}

/**
 * Merges equipped ids with fallbacks when ids are missing or locked after load.
 */
export function resolveEquippedCosmetics(
  equipped: EquippedCosmetics,
  lifetime: LifetimeStats,
): EquippedCosmetics {
  const pick = (category: CosmeticCategory, id: string, fallback: string): string => {
    const def = findCosmeticById(id)
    if (def && def.category === category && isCosmeticUnlocked(def, lifetime)) {
      return id
    }
    const defaultDef = findCosmeticById(fallback)
    if (defaultDef && isCosmeticUnlocked(defaultDef, lifetime)) return fallback
    return listCosmeticsByCategory(category).find((c) => isCosmeticUnlocked(c, lifetime))!
      .id
  }

  return {
    boardThemeId: pick('board', equipped.boardThemeId, DEFAULT_EQUIPPED_COSMETICS.boardThemeId),
    pieceSkinId: pick('pieceSkin', equipped.pieceSkinId, DEFAULT_EQUIPPED_COSMETICS.pieceSkinId),
    shellBackgroundId: pick(
      'shell',
      equipped.shellBackgroundId,
      DEFAULT_EQUIPPED_COSMETICS.shellBackgroundId,
    ),
  }
}

export interface ResolvedCosmeticTheme {
  boardLight: string
  boardDark: string
  playerPiece: string
  enemyPiece: string
  shell: string
}

const FALLBACK_THEME: ResolvedCosmeticTheme = {
  boardLight: 'bg-board-light/80',
  boardDark: 'bg-board-dark/90',
  playerPiece: 'text-sky-200 drop-shadow',
  enemyPiece: 'text-rose-300 drop-shadow',
  shell: 'bg-slate-950',
}

/** Resolves equipped ids into Tailwind class strings for UI binding. */
export function resolveCosmeticTheme(
  equipped: EquippedCosmetics,
  lifetime: LifetimeStats,
): ResolvedCosmeticTheme {
  const safe = resolveEquippedCosmetics(equipped, lifetime)
  const board = findCosmeticById(safe.boardThemeId)
  const skin = findCosmeticById(safe.pieceSkinId)
  const shell = findCosmeticById(safe.shellBackgroundId)

  return {
    boardLight: board?.classes.boardLight ?? FALLBACK_THEME.boardLight,
    boardDark: board?.classes.boardDark ?? FALLBACK_THEME.boardDark,
    playerPiece: skin?.classes.playerPiece ?? FALLBACK_THEME.playerPiece,
    enemyPiece: skin?.classes.enemyPiece ?? FALLBACK_THEME.enemyPiece,
    shell: shell?.classes.shell ?? FALLBACK_THEME.shell,
  }
}

/**
 * Updates lifetime peak stage — called when a run exceeds prior records.
 */
export function bumpLifetimeStage(
  lifetime: LifetimeStats,
  stageReached: number,
): LifetimeStats {
  return {
    ...lifetime,
    maxStageEverReached: Math.max(lifetime.maxStageEverReached, stageReached),
  }
}
