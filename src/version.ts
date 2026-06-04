/**
 * Application release metadata — single source of truth for UI and save schema.
 */
export const APP_VERSION = '0.3.0' as const
export const APP_RELEASE_CODENAME = 'Arena & Dojo' as const

/** Serialized into every `GameState` / save export. */
export const GAME_SCHEMA_VERSION = APP_VERSION

/** Pinia game save blob (`gameStore`). */
export const GAME_SAVE_STORAGE_KEY = 'idle-chess-rpg-v0.3-save' as const
export const LEGACY_GAME_SAVE_STORAGE_KEY = 'idle-chess-rpg-v0.2-save' as const

/** Pinia meta progression (`metaStore` — Dojo, Supporter QoL). */
export const META_STORE_PERSIST_KEY = 'idle-chess-rpg-meta-v2' as const
export const LEGACY_META_STORE_PERSIST_KEY = 'idle-chess-rpg-meta-v1' as const

/** Ghost army snapshots (`ghostSystem`). */
export const GHOST_ARMY_SCHEMA_VERSION = '0.8.0' as const

/** Audio settings (`audioStore`). */
export const AUDIO_SAVE_STORAGE_KEY = 'idle-chess-rpg-v0.3-audio' as const
export const LEGACY_AUDIO_SAVE_STORAGE_KEY = 'idle-chess-rpg-v0.2-audio' as const

/** Chess Town meta-base building levels (`townStore`). */
export const TOWN_STORE_PERSIST_KEY = 'idle-chess-rpg-town-v1' as const
