# Version 0.3.0 Plan — *Arena & Dojo*

**Status:** Shipped (2026-06-04)  
**Codename:** Arena & Dojo  
**Package:** `0.3.0` · **Save schema:** `0.3.0`

## Shipped scope

### Phase 9 — Multiplayer prep
- [x] `pvpMath.ts` / `pvpNormalization.ts` + tests
- [x] `ArenaLoadout.vue` + `arenaLoadout.ts`
- [x] Ghost export `exportArmySnapshotFromPieces`

### Phase 9.5 — Chess Dojo
- [x] `chessDojo.ts` + `dojoSession.ts` + tests
- [x] `metaStore` Dojo progression
- [x] `ChessDojo.vue` + `ChessBoard` overlay modes

### Phase 10 — Supporter QoL
- [x] `SupporterStore.vue`
- [x] `purchaseConvenienceUpgrade` + offline / auto-shop / combat log wiring
- [x] `supporterQoL.ts` + `persistMetaReader` (no `metaStore` ↔ `persistConfig` cycle)

### Versioning & docs
- [x] `src/version.ts`, `CHANGELOG.md`, `README.md`, `persistMigration.ts`
- [x] UI header shows `v0.3.0 (Arena & Dojo)`

## Next (0.4+ roadmap)

- Phase 11: Chess Town (`townStore`, `ChessTown.vue`)
- Live PvP / ghost matchmaking UI (beyond local DB)
- Optional real payment bridge for Supporter Club (currently ethical unlock stub)
