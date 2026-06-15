# Version 0.3.0 Plan — *Arena & Dojo*

**Status:** Shipped (2026-06-04)  
**Codename:** Arena & Dojo  
**Package:** `0.3.0` · **Save schema:** `0.3.0`

## Shipped scope

### Phase 9 — Multiplayer prep

- `pvpMath.ts` / `pvpNormalization.ts` + tests
- `ArenaLoadout.vue` + `arenaLoadout.ts`
- Ghost export `exportArmySnapshotFromPieces`

### Phase 9.5 — Chess Dojo

- `chessDojo.ts` + `dojoSession.ts` + tests
- `metaStore` Dojo progression
- `ChessDojo.vue` + `ChessBoard` overlay modes

### Phase 10 — Supporter QoL

- `SupporterStore.vue`
- `purchaseConvenienceUpgrade` + offline / auto-shop / combat log wiring
- `supporterQoL.ts` + `persistMetaReader` (no `metaStore` ↔ `persistConfig` cycle)

### Versioning & docs

- `src/version.ts`, `CHANGELOG.md`, `README.md`, `persistMigration.ts`
- UI header shows `v0.3.0 (Arena & Dojo)`

## Post-ship polish (living board)

- **Dev mode** — `devStore` + `DevModePanel.vue`; Ctrl+Shift+D; cheats persisted under `idle-chess-rpg-dev-v1` (not campaign save).
- **Chess-first** — `chessIdentity.ts` + `ChessPieceRenderer.vue` (Unicode silhouettes); fantasy board frame defers to 8×8 grid; no faction sprites on board.
- Board evolution materials + piece power auras (`aestheticProgression.ts`, `ChessBoard.vue`)
- Shell parallax / music-layer atmosphere (`GameShell.vue`, `musicLayers.ts`)
- Impact frames + clash VFX (`combatFeedback.ts`, combat loop freeze)
- Strategy-suite UI + `btn-juice` (`cosmetics.ts`, Arena/Dojo/Upgrade/Supporter)

## Next (0.4+ roadmap)

- Phase 11: Chess Town (`townStore`, `ChessTown.vue`) — **shipped in 0.3**
- Phase 12: Visual Identity: Optional theme overlays with stripes
- Live PvP / ghost matchmaking UI (beyond local DB)
- Optional real payment bridge for Supporter Club (currently ethical unlock stub)

