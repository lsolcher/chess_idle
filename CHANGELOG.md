# Changelog

All notable changes to Idle Chess RPG are documented here ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)).

## [Unreleased]

### Added

- _(v0.4.0 cycle — High-Fantasy Art Pipeline + Ghost Matchmaking UI.)_

## [0.3.0] - 1.0 RC — 2026-06-09

*Locked release-candidate milestone. Client targets 1.0; save schema remains `0.3.0`.*

### Added

- **Dev mode:** Ctrl+Shift+D cheat panel (gold/Elo, stage jump, heal, roster unlock, max upgrades, clear wave, god mode, free stamina clicks); persisted separately from campaign save (`devStore`).
- **P0 launch sprint:** Enemy HP soft-cap after stage 50; collision-free wave spawn; Intent Ribbon onboarding overlay; wave lifecycle extracted to `waveLifecycle.ts`; Exhibition boards + Wardrobe UI removed; chess board combat strings i18n (`en`/`de`).
- **Fantasy Sprite Engine (prep):** `ChessPieceRenderer.vue`, `fantasySprites.ts` 6×2 grid spec, `docs/FANTASY_SPRITE_PIPELINE.md`; glyph fallback via `CHESS_PIECE_RENDER_MODE`.
- **Chess-first visual lock:** `chessIdentity.ts` silhouette QA; stone checkerboard + piece glide in `fantasy-theme.css`.
- **Ludological Unification:** Enemy Intent Ribbon, Tempo Bonus, Royal Decree Last Stand, wave tactical patterns, Adaptive AI auto-profile.
- **Symphonic polish:** Dynamic music layer mixing by stage/prestige; 2s ambient↔boss crossfade; pitch-mapped combat SFX; Grandmaster Phase III tension drone; meta/supporter purchase chimes; prestige chime; tab blur suspends `AudioContext`.

### Fixed

- **Startup board:** Pieces invisible when sprite sheet missing — reverted to Unicode glyphs (`CHESS_PIECE_RENDER_MODE = 'glyph'`).
- **Onboarding Arm Move:** Hydrate-safe `armOnboardingMove()`; modal dismisses after arming so board stays clickable.
- **Pawn stare-down:** Head-on pawn vs pawn capture; king flanks behind friendly pawn screen.
- **Board UI:** Enemy initiative pies; pies hidden in wave prep; selected-piece ring; attackable-enemy pulse; enemy click shows red move dots.

### Changed

- **Store refactor:** `combatStore.ts` + `economyStore.ts`; `gameStore.ts` persistence hub (~1,580 lines, down from ~2,600).
- **Board pieces:** Unicode chess symbols on 8×8 board (`chessGlyphs.ts`) for stable 1.0 RC play.
- **Victory glow:** Win-streak CSS glow/sparkle; burst on wave clear; aura banner.
- **Balance:** Player army HP/AP stage scaling; faster roster milestones; Stage 20 ~34.2 min (headless model).
- **Docs:** `gdd.md`, `tasks.md`, `README.md` synced for 1.0 RC scope (modular stores, Intent Ribbon, no Exhibition/Wardrobe).
- **Juice & polish:** Board evolution materials, power auras, parallax shell, impact frames, clash VFX, `btn-juice` micro-interactions.

### Tests

- **378** Vitest tests passing (73 files).

---

## [0.3.0] — 2026-06-04 — *Arena & Dojo*

### Added

- **Phase 9 — PvP prep:** `pvpMath.ts` point-cost engine, `pvpNormalization.ts` arena stat clamping, `ChessPiece.pvpValue` / `arenaBaseline` fields.
- **Phase 9 — Arena Loadout:** `ArenaLoadout.vue` army builder (1000 PC cap), `arenaLoadout.ts`, ghost export via `exportArmySnapshotFromPieces`, Upgrades → **Arena** tab.
- **Phase 9.5 — Chess Dojo:** `chessDojo.ts` (Easy/Medium/Hard AI), `metaStore` skill points & Dojo upgrades, `ChessDojo.vue`, `ChessBoard` dojo overlay mode.
- **Phase 10 — Supporter's Club:** `SupporterStore.vue`, convenience QoL in `metaStore` (offline gold ×1.5, auto-shop in prep, advanced wave log), `supporterQoL.ts`.
- **Combat:** Wave stall forfeit (`waveCombatPacing.ts`), wave outcome modal + i18n (`en`/`de`).
- **Versioning:** `src/version.ts` single source of truth; `persistMigration.ts` copies v0.2 localStorage keys to v0.3.

### Changed

- Game save key: `idle-chess-rpg-v0.3-save` (migrated from v0.2 on boot).
- Meta persist key: `idle-chess-rpg-meta-v2` (migrated from v1).
- Audio persist key: `idle-chess-rpg-v0.3-audio`.
- `GAME_SCHEMA_VERSION` → `0.3.0`.
- Upgrade panel tabs: **Dojo**, **Arena**, **Club** (Supporter).

### Added

- **Phase 11 — Chess Town:** `townStore.ts` + `townBuildings.ts` with Barracks (AP), Academy (initiative speed), Treasury (gold); `ChessTown.vue` top-down town grid; **Town** tab in Upgrades; persists via `idle-chess-rpg-town-v1`.
- **Final balance pass:** `balanceConstants.ts`, `balanceSimulation.ts`, `docs/BALANCE_PASS.md` — prestige pacing, Arena PC, Dojo/Town tuning, ghost variety.

### Changed

- Economy: stage gold mult **1.14 → 1.12**; enemy HP scaling **1.08 → 1.114** (time-to-prestige ≥30m in headless model).
- Arena PC: queen-heavy armies cost significantly more than pawn swarms (`ARENA_BASE_PC`).
- Dojo Hard AI: **3-ply** base search; skill rewards **2 / 3 / 5** per difficulty.
- Chess Town: **~1% / 1.2%** per-level bonuses (mid-level ≈5–10%, not runaway).
- Ghost matchmaking prefers mixed unit types when power scores tie.

### Fixed

- **Piece shop balance:** Board slot purchases capped by milestone roster size; pawns listed first.
- **Prep recovery:** army heals **50% of missing HP** between waves; King respawn after fail restores full HP.
- **Board occupancy:** duplicate coordinates reconciled; Grandmaster spawns respect player squares.
- Wave prep no longer auto-starts combat while clear modal is open.
- **Buy Best ROI** unified DPS/gold scale across prep purchases.

### Tests

- **317** Vitest tests passing (`vue-tsc -b` green).

---

## [0.2.1] — prior client

Manual/auto combat focus, click damage, combat movement, wave spawn fixes, army prep persistence, Grandmaster boss hooks, procedural audio, cosmetics, offline progression (8h/12h cap).

## [0.2.0] — GDD v0.2 baseline

Royal Decree, per-piece initiative, wave loop, piece shop, prestige, meta tree, exhibitions, endless `stageManager` scaling.
