# Idle Chess RPG — Development Roadmap

**Release:** [v0.3.0 — Arena & Dojo](CHANGELOG.md#030--2026-06-04--arena--dojo) · save schema `0.3.0` · 281 tests

## Phase 1: Core Architecture
- [x] Create `src/types/game.ts` to fully model ChessPiece interfaces, Upgrade tracks, and GameState tracking based on GDD v0.2
- [x] Build the central Pinia store (`src/store/gameStore.ts`) tracking core state variables (gold, elo, currentStage, combo)
- [x] Implement the event-driven Piece Initiative tracking loop inside the store to replace global second ticks
- [x] Implement the 'Royal Decree' active/passive state machine for the solo King start configuration
- [x] Write a headless simulation test to verify the solo King state machine switches off instantly when a second piece is registered

## Phase 2: Board State & Engine Logic
- [x] Implement the grid coordinate state mapping and valid chess move generation algorithm for the King and Pawn
- [x] Build the AI Move Heuristic engine scoring mechanism for individual piece turn execution
- [x] Implement the in-combat Dynamic Pawn Promotion mechanic and its corresponding Super-Piece transient state modifiers

## Phase 3: User Interface & Game Feel
- [x] Set up Tailwind configuration and main layout shell (Board area vs Upgrade panel tabs)
- [x] Build the dynamic 8x8 `ChessBoard.vue` grid component with piece initiative progress ring overlays
- [x] Build the Upgrade Panel component reading from the Pinia store with auto-highlighted high-ROI buttons

## Phase 3.5: Discrete Wave States, Auto/Manual Toggle & Combat Loop
- [x] Implement the Wave State Machine in the store (`WAVE_PREP`, `WAVE_ACTIVE`, `WAVE_COMPLETE`).
- [x] Implement an `autoPlay` Boolean toggle in the store and UI.
- [x] Implement Wave Spawning & Scaling.
- [x] Implement the Combat Loop & Capture mechanics.
- [x] Implement Wave Clear / Fail Conditions (King HP 0 or capture → prep, King restore, 80% enemy HP).

## Phase 3.8: Full Roster & Persistence (NEW)
- [x] Implement valid chess move generation algorithms for the remaining pieces: Knight, Bishop, Rook, and Queen. Update the AI so it knows how to use them.
- [x] Implement `pinia-plugin-persistedstate` to automatically save the player's GameState to `localStorage` so progress is retained on browser refresh.
## Phase 3.9: The Piece Shop & Army Deployment (NEW)
- [x] Implement Piece Unlocks & Shop UI: Wire up the Stage milestone logic (e.g., Stage 1 unlocks Pawn, Stage 10 unlocks Knight) so the player can purchase new pieces with Gold in the Upgrade Panel.
- [x] Implement Army Deployment: Update the `WAVE_PREP` state so that when a player buys a new piece, it is automatically spawned onto a valid empty square on their starting ranks (Ranks 1 & 2) for the next combat run.
- [x] Implement Board Slot Limits: Enforce a maximum number of pieces on the board, and add a buyable "Global Board Slot" upgrade in the shop to expand the army size.
## Phase 3.10: Endless Procedural Wave Scaling (NEW)
- [x] Refactor `StageManager` wave generation from hardcoded Stage bands to an algorithmic endless system.
- [x] Implement endless stat math: Enemy HP scales continuously by `1.08^(stage-1)` and Enemy AP by `1.06^(stage-1)` indefinitely.
- [x] Implement procedural composition: Cap maximum enemy wave size at 16 pieces. As the stage number increases, shift the spawn weights so basic Pawns are gradually replaced by higher-tier pieces (Knights, Rooks, Queens) based on a formula like `currentStage / 10`.
- [x] Implement Endless Boss Loop: Every 10th stage (10, 20... 60, 70, 1000) automatically spawns a "Boss Wave" containing an enemy King with a 5x HP multiplier, guarding higher stage clear rewards.
## Phase 4: Meta Systems & Progression
- [x] Implement the Prestige logic (Elo Shards calculation and state reset mechanism)
- [x] Build the Meta-Upgrade tree store and node allocation unlock requirements
- [x] Implement the Multi-Board "Simultaneous Exhibitions" system running simplified background auto-farming loops

## Phase 5: Gameplay Polish & Automation (Beta)
- [x] Implement the "Auto-Advance Waves" UI toggle: Allow players to buy an upgrade that automatically clicks "Next Wave" after `WAVE_COMPLETE`, creating a true idle experience.
- [x] Complete the Meta-Upgrades: Wire up the "En Passant Economy" (Super-piece stat persistence across stages) and the "Immortal Game" (revival flash granting +50% AP for 3 actions).
- [x] Implement Boss Identities & Trophies: Wire up the signature boss mechanics (e.g., Phase Shifts, En Passant Phantom teleport) and make bosses drop Trophy currency upon first clear.
- [x] Implement "Enemy Pawn Leak" behavior: If an enemy pawn reaches Rank 1, it sacrifices itself to deal direct, unblockable damage to the King's HP.
- [x] Fix the Wave Flow: Ensure `advanceStage()` properly transitions through the `WAVE_COMPLETE` state so rewards and UI triggers fire correctly before the next wave spawns.

## Phase 3.11: Army Buildup & Promotion AI (DONE)
- [x] Persist super-promotions across wave/stage clears (death/prestige only reset).
- [x] Relocate promoted pawns to deploy ranks between waves so they keep fighting.
- [x] Auto-promotion: queen-favored, wave-aware scoring; En Passant `fromForm` respected.
- [x] Auto-AI: super-form move bonuses (queen/rook/knight/bishop) separate from pawn advance weights.

## Phase 3.14: Combat Stall Forfeit (DONE)
- [x] `waveCombatPacing.ts` — forfeit if 72 actions without an enemy kill or 4 min wall-clock (non-boss).
- [x] Punishment: same as wave fail (checkpoint rewind / 80% enemy HP retry) + stall attribution in outcome modal.
- [x] AI: lone-enemy engagement bonus; enemy AI hunts player when not capturing.

## Phase 3.13: Wave Outcome Modal (DONE)
- [x] Per-wave telemetry (`waveCombatStats`): damage dealt/taken, gold breakdown, captures, actions.
- [x] Modular `WaveOutcomeModal.vue` — victory (green) / defeat (rose) with stats grid and Continue / Start next wave.
- [x] i18n strings in `src/locales/en.json` + `de.json`; `src/i18n/index.ts` `t()` helper.
- [x] King-fallen inline banner suppressed while modal is open.

## Phase 3.12: Combat UX, Movement & Wave Fail (DONE)
- [x] **Click combat:** `clickEnemyPiece` wired on board; stamina + gold; damage via `clickCombat` engine.
- [x] **Click cooldown:** 2.5s combat-time gate (`combatTime.ts` + `lastSimulatedMs`); pauses during manual player turns.
- [x] **Strike / Move focus:** `combatFocus` in store + ChessBoard toggle; strikes blocked unless Strike; captures use Move on manual turns.
- [x] **Line combat movement:** `combatMovement.ts` — sliders at range chip/kill then land on square **beside** target; melee/knight/pawn/king adjacent rules; tests in `combatMovement.test.ts`.
- [x] **Spawn occupancy:** `spawnProceduralWave` seeds occupied cells from player roster; boss King no longer forced onto blocked squares; `buildOccupancy` prefers player on duplicate cell.
- [x] **King fail / game over:** `getKingFailReason`, `restorePlayerKingForPrep`, `failWave` + `lastWaveFailReason` / `lastKingFailDetail`; `evaluateWaveOutcome` on all combat paths; **King fallen** banner in `WaveControls`; 194 tests.

## Backlog / Technical Debt
- Serialization: `CombatSnapshot` omits `bossWaveDeadlineMs` and `pendingPromotion` by design (combat-authoritative slice only); extend snapshot when PvP match clock needs network sync.
- `buildTurnOrderQueue` / `getNextReadyActor` use asymmetric speed mults in UI only — ready-actor selection still uses wall-clock `nextActionAtMs` (already scheduled with GM mult in `tickCombat`).

## Phase 6: Game Feel (Juice) & Tech Debt
- [x] Implement Capture VFX & Animations: Add visual feedback (screen shake, CSS flashes, floating gold numbers) when pieces take damage or capture.
- [x] Implement Non-Lethal Combat UX: Since pieces don't die instantly, add a visual indicator (like a tiny sword clash icon or red flash) when pieces chip each other's HP without moving.
- [x] Fix State Persistence: Update `pinia-plugin-persistedstate` to save the mid-wave board state, so refreshing doesn't force a reset to `WAVE_PREP`.
- [x] Resolve Tech Debt: Refactor Pinia getters to not mirror top-level state keys, fix the headless test `nowMs` dependency, scaffold `vue-tsc`, and resolve the npm audit warning.

## Phase 7: Procedural Audio & Music Synthesis
- [x] Setup Procedural Audio Engine: Instead of using external `.mp3` files, utilize the native Web Audio API (or a micro-synthesizer script like ZzFX) to generate sounds entirely through code. Create `src/store/audioStore.ts` + `src/engine/proceduralAudio.ts` to manage this engine.
- [x] Implement UI / System Controls: Add a global Mute toggle and independent volume sliders for Music and SFX in the Upgrade/Settings panel. Ensure audio context only starts after the first player interaction to comply with browser autoplay policies.
- [x] Wire up Procedural Combat SFX: Write functions that generate distinct programmatic tones for events (e.g., a low oscillator thud for damage, a high-pitched frequency sweep for captures, a short blip for UI clicks). Trigger these via `pushCombatFeedback` / `gameAudioBridge` during combat resolution.
- [x] Algorithmic Background Music: Implement a simple, procedurally generated looping melody using Web Audio API oscillators. Create two variations: a relaxed ambient loop for normal waves, and a faster, more intense arpeggio for Boss Waves (milestone + endless ×10 cadence).

## Phase 7.5: Core Trust & Idle Viability (DONE)
- [x] Refactor Auto-Mode Initiative: Auto `tickCombat` uses interleaved `getNextReadyActor` (one actor/tick); `schedulePlayerAfterAction` mirrors enemy reschedule.
- [x] Implement Offline Progression: `offlineProgress.ts` + `lastActiveAtMs`; `afterRestore` grants capped gold (50% combat drip when `WAVE_ACTIVE` + exhibitions).
- [x] UI Telegraphing: `lastKingFailAttribution` + `kingFallTelegraph` on King fallen banner; offline gold toast in `StatsHeader`.

## Phase 8: Cosmetic Achievements & Visual Progression (DONE)
- [x] Lifetime stat tracking (`lifetime` on `GameState`): `maxStageEverReached`, `lifetimeGoldEarned`, `totalUpgradesBought`, `totalPrestiges` — persists through prestige & save.
- [x] Cosmetics catalog (`cosmetics.ts`): board / piece skin / shell themes with GDD thresholds (Obsidian @ stage 50, Golden Army @ 1M gold, etc.).
- [x] **Themes** tab in Upgrade Panel (`CosmeticsPanel.vue`) — progress bars, equip, lifetime stats header.
- [x] Dynamic rendering: `cosmeticTheme` getter → `ChessBoard.vue` squares + pieces, `GameShell.vue` shell backdrop.

## Phase 8.5: Pre-Multiplayer Consolidation & Hardening (DONE)
- [x] Resolve TypeScript Strict Errors: `vue-tsc -b` green; Pinia `PersistenceOptions<GameState>`, getter cross-refs, `@types/node` for Vite/Vitest configs.
- [x] Complete Grandmaster Boss Hooks: Phase III +30% initiative / +50% click via `grandmasterBoss.ts`; checkmate skip + Phase II copy in `bossMechanics.ts`; store getters (`grandmasterCombatModifiers`, `effectivePlayerSpeedMult`, `bossTimeRemainingMs`), `tickCombat` player speed, click strike mult, `checkBossWaveTimeout`, turn-order UI.
- [x] Complete Boss Meta Upgrades: 180s boss timer + `deepClock` +30s; `bossWaveDeadlineMs` persisted on mid-wave restore; `checkBossWaveTimeout`, `bossTimeRemainingMs` getter.
- [x] Dependency Audit: Vitest upgraded to **4.1.8** (resolves GHSA-5xrq-8626); `npm audit` clean for production deps.
- [x] State Serialization Prep: `gameSerialization.ts` round-trip helpers (`combatSnapshotsEqual`, `roundTripCombatSnapshot`); complex `CombatSnapshot` regression test; `exportGameStateJson()`; `ChessPiece.arenaBaseline` / `pvpValue` optional fields for Phase 9.

## Phase 8.6: The Living Board (Exponential Aesthetic Progression) (DONE)

**Visual tier curve:** `S(n) = round(n^1.5)` → tier at stage: 1→1, 2→3, 3→5, 4→8, 5→11, 6→15, 7→20, 8→26, 9→33, 10→40, 11→48, 12→57.

**Board evolution (log):** `min(6, floor(log2(stage+1)×2))` — tiers at stages ~1, 2, 4, 8, 16, 32, 64+.

**Piece aura tiers:** `floor(visualTier / 2)` capped at 4 (CSS box-shadow / ring only).

**Music layers (lifetime `maxStageEver` + prestige):**

| Layer | Stage | Prestige |
|-------|-------|----------|
| base | 0 | 0 |
| synth | 2 | 0 |
| arpeggio | 5 | 0 |
| percussion | 8 | 0 |
| pulse | 12 | 0 |
| harmony | 18 | 0 |
| strings | 25 | 0 |
| choral | 35 | 1 |
| brass | 50 | 1 |
| orchestral | 70 | 2 |
| celestial | 100 | 2 |
| god | 50 | 3 |

**Permanent trophies (prestige-persistent):** `prestige-frame` @ 1 prestige, `veteran-glow` @ 2, `god-crown` @ 3, `century-lattice` @ stage 100 ever.

- [x] Logarithmic aesthetic scaling (`aestheticProgression.ts` — `getVisualTier`, board evolution, aura CSS).
- [x] Layered procedural audio (`musicLayers.ts` + additive `ProceduralMusicLoop`).
- [x] CSS-only piece auras (no combat-loop particle sim).
- [x] Prestige-persistent shell trophies; run-scoped visuals reset on prestige.
- [x] Themes tab toggles: gradual progression, auras, board evolution, music layers.

## Phase 8.8: The Arena & AI Ghost System (PREP DONE)
- [x] Ghost Army serialization: `ghostSystem.ts` — `exportArmySnapshot`, `importArmySnapshot`, `serializeArmySnapshot`, schema `0.8.0`.
- [x] Ghost Database (local): `saveGhostArmy`, `listGhostArmies`, `loadGhostArmy` — `localStorage` key `idle-chess-rpg-ghost-armies-v1` (50 cap).
- [x] Ghost Matchmaking (draft): `selectGhostOpponent(targetPower)` — ±25% power band via `calculateArmyPowerScore`.
- [x] Arena Balancing: `combatMode: 'pvpGhost'` in `aiHeuristic.ts` — `scorePvpGhostModifiers`, King shelter / anti-pawn-march weights.
- [x] Store hooks: `exportGhostArmyJson`, `importGhostArmy`, `saveGhostArmyToDatabase`.

## Phase 9: Multiplayer & Matchmaking (Long-Term Vision)
- [x] Implement Point Cost Engine (`src/engine/pvpMath.ts`): `calculatePvPValue`, `BASE_PC`, `SUPER_FORM_PC_MULT`, `calculateArmyPvPValue`.
- [x] Build "Arena Tactical Loadout" UI (`src/components/ArenaLoadout.vue`): Army builder with `ChessBoard` preview, `unlockedPieces` roster deploy/remove, live `calculateArmyPvPValue` vs 1000 PC cap, `saveArenaLoadout` → `exportArmySnapshotFromPieces` + ghost DB.
- [x] Arena Stat Clamping Logic: `src/engine/pvpNormalization.ts` — `normalizePieceStats` / `normalizeArmyStats` (deep clone, baseline levels, super-form preserved).

## Phase 9.5: The Chess Dojo (AI Training & Meta-Skill)
- [x] Implement Chess Engine Interface: `src/engine/chessDojo.ts` — `getAiMove`, `applyDojoMove`, `evaluateDojoPosition`, tests in `chessDojo.test.ts`.
- [x] Implement AI Difficulty Tiers:
    - [x] Easy: Top-3 heuristic moves, random pick (`scoreAllMoves` / `generateLegalMoves`).
    - [x] Medium: Best single-ply `aiHeuristic` score (`scoreAllMoves`).
    - [x] Hard: 2-ply minimax + heuristic leaf eval (+ meta `deepThought` bonus plies).
- [x] Integrate Skill Points: `src/store/metaStore.ts` — `skillPoints`, `dojoVictory`, Dojo upgrade tree (`deepThought`, `openingRepertoire`, `endgamePrecision`).
- [x] Build Dojo UI (`src/components/ChessDojo.vue`): Training dashboard, difficulty picker, `ChessBoard` dojo mode, skill/Elo header, victories tally.
- [x] Meta-Upgrade Shop: Skill Point purchases via `metaStore.purchaseDojoUpgrade` in Dojo side panel (affordable highlight reactive to `skillPoints`).

## Phase 10: Ethical Hybrid Monetization
- [x] Implement Convenience Store Storefront: `src/components/SupporterStore.vue` — Offline Gold Multiplier, Auto-Shop Assistant, Advanced Combat Log via `metaStore.purchaseConvenienceUpgrade` (persists in `meta-v2`, no combat stats).
- [x] Wire QoL: `offlineProgress` + `persistConfig` read `hasOfflineGoldMultiplier`; `enterWavePrep` → `runSupporterAutoShopIfEnabled`; `WaveOutcomeModal` advanced log when `hasAdvancedCombatLog`.

## Phase 11: The Chess Town (Persistence & Meta-Base)
- [x] Implement Chess Town Core: Create `src/store/townStore.ts` to track building levels and town production rates.
- [x] Implement Building Logic: Add buildings like "Barracks" (+Piece AP), "Academy" (+Initiative speed), and "Treasury" (+Gold per stage).
- [x] Build Town UI (`src/components/ChessTown.vue`): A top-down, grid-based visual view of the town. Buildings should show "Construction" animations and progress bars.
- [x] Visual Tier Progression: Reuse `aestheticProgression.ts` logic — buildings should visually evolve (e.g., from wooden shack to stone citadel to glowing marble spire) as their levels increase.
- [x] Meta-Currency Sink: Integrate spending "Skill Points" (from Dojo) and "Elo Shards" (from Prestige) to upgrade town buildings, providing permanent account-wide bonuses.