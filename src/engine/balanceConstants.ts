/**
 * Central balance knobs for the v0.3 final tuning pass.
 * Economy helpers in `types/game.ts` import stage gold values from here.
 */

/** GDD §2.2 — `stageMult = STAGE_GOLD_MULT_BASE ^ (stage - 1)`. */
export const STAGE_GOLD_MULT_BASE = 1.12

/** Procedural enemy HP scaling per stage (see `stageManager.ts`). */
export const ENEMY_HP_STAGE_GROWTH = 1.114

/** Procedural enemy AP scaling per stage. */
export const ENEMY_AP_STAGE_GROWTH = 1.055

/**
 * Player army scaling per stage (slightly below enemy curves so upgrades still matter).
 * Applied on wave start / meta refresh — keeps pieces near enemy counterparts.
 */
export const PLAYER_HP_STAGE_GROWTH = 1.112
export const PLAYER_AP_STAGE_GROWTH = 1.054

/** Design target minutes to reach prestige unlock (stage 20) for a fresh auto-play run. */
export const TARGET_MINUTES_TO_PRESTIGE = 40

/** Minimum acceptable minutes before we slow the curve further. */
export const MIN_MINUTES_TO_PRESTIGE = 30

/** Arena draft — BasePC table (GDD §9.1). */
export const ARENA_BASE_PC = {
  pawn: 45,
  knight: 140,
  bishop: 140,
  rook: 260,
  queen: 480,
  king: 160,
} as const

/**
 * Roster unlock milestones (maxStageReached). Tuned ~2–4 stages earlier than GDD v1 table.
 * @see resolveUnlockedSlotsFromMilestones
 */
export const ROSTER_PAWN_SLOTS = { second: 4, third: 17, fourth: 23 } as const
export const ROSTER_KNIGHT_SLOTS = { first: 8, second: 34 } as const
export const ROSTER_BISHOP_SLOTS = { first: 12, second: 34 } as const
export const ROSTER_ROOK_SLOTS = { first: 24, second: 42 } as const
export const ROSTER_QUEEN_SLOT = 38

/** Piece shop “unlocks at stage X” labels — align with roster gates. */
export const PIECE_SHOP_UNLOCK_STAGE = {
  pawn: 1,
  knight: ROSTER_KNIGHT_SLOTS.first,
  bishop: ROSTER_BISHOP_SLOTS.first,
  rook: ROSTER_ROOK_SLOTS.first,
  queen: ROSTER_QUEEN_SLOT,
} as const

/** Free deploy slots granted by wave milestones (within roster cap). */
export const DEPLOY_SLOT_MILESTONES = [
  { stage: 4, slots: 3 },
  { stage: 8, slots: 4 },
  { stage: 18, slots: 5 },
  { stage: 30, slots: 6 },
] as const

/** Chess Dojo — base minimax plies for Hard (before Deep Thought meta). */
export const DOJO_HARD_LOOKAHEAD_PLIES = 3

/** Dojo skill point rewards per win. */
export const DOJO_SKILL_REWARD = {
  easy: 2,
  medium: 3,
  hard: 5,
} as const

/** Chess Town — per-building level bonuses (mid-level ≈ 5–10%). */
export const TOWN_BARRACKS_AP_PER_LEVEL = 0.01
export const TOWN_ACADEMY_SPEED_PER_LEVEL = 0.012
export const TOWN_TREASURY_GOLD_PER_LEVEL = 0.012
