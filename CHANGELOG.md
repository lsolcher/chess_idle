# Changelog

All notable changes to Idle Chess RPG are documented here ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)).

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

### Tests

- **281** Vitest tests passing (`vue-tsc -b` green).

---

## [0.2.1] — prior client

Manual/auto combat focus, click damage, combat movement, wave spawn fixes, army prep persistence, Grandmaster boss hooks, procedural audio, cosmetics, offline progression (8h/12h cap).

## [0.2.0] — GDD v0.2 baseline

Royal Decree, per-piece initiative, wave loop, piece shop, prestige, meta tree, exhibitions, endless `stageManager` scaling.
