# Idle Chess RPG

**Version 0.4.0** (*Visuals & Matchmaking*) · **Target release:** 1.0 · **Save schema:** `0.3.0`  
Browser idle chess roguelike with wave combat, prestige meta, Chess Dojo training, Chess Town, Arena loadout prep, and ethical QoL monetization hooks.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 374+ Vitest tests
npm run build    # production bundle
node scripts/balance-sim.js   # headless balance report
```

## Technical architecture

**Modularized Pinia state (hub-and-spoke):**

| Store | Role |
|-------|------|
| `gameStore` | Persistence hub — `GameState`, wave orchestration, getters, prestige |
| `combatStore` | Initiative loop, move resolution, wave win/lose |
| `economyStore` | Gold, shop purchases, upgrade catalog |
| `metaStore` | Dojo skill points, Supporter QoL (cross-prestige) |
| `townStore` | Chess Town building levels (cross-prestige) |

UI and tests call `useGameStore()`; combat and economy actions delegate to specialized stores while reactivity stays on the shared `GameState` slice.

## What’s in v1.0 scope

| Area | Highlights |
|------|------------|
| **Campaign** | Endless waves, boss cadence, Royal Decree + Last Stand, super-promotions, Intent Ribbon + Tempo Bonus, wave outcome modal |
| **Arena (Phase 9)** | Point-buy loadout UI, `calculateArmyPvPValue`, ghost army DB (`ghostSystem` schema `0.8.0`) |
| **Chess Dojo (9.5)** | Training AI (easy/medium/hard), skill points, Dojo meta upgrades, wave counter modules |
| **Chess Town (11)** | Barracks / Academy / Treasury meta-sink |
| **Supporter Club (10)** | QoL-only perks in `metaStore` — no combat/PvP stat changes |
| **Tech** | Vue 3 + Pinia + persisted state, procedural audio, i18n EN/DE, 374+ Vitest |

## Project layout

- `src/store/gameStore.ts` — persistence hub (orchestrates combat + economy)
- `src/store/combatStore.ts` — wave combat loop
- `src/store/economyStore.ts` — gold and shop
- `src/store/metaStore.ts` — Dojo + Supporter (persists across prestige)
- `src/store/townStore.ts` — Chess Town (persists across prestige)
- `src/engine/` — chess rules, AI, waves, offline math, PvP math
- `src/components/` — UI shells (`GameShell`, `ChessBoard`, modals, upgrade tabs)
- `src/version.ts` — release + storage key constants
- `gdd.md` / `tasks.md` — design doc and roadmap

## Persistence keys (localStorage)

| Key | Contents |
|-----|----------|
| `idle-chess-rpg-v0.3-save` | Campaign run (`GameState` schema `0.3.0`) |
| `idle-chess-rpg-meta-v2` | Skill points, Dojo ranks, Supporter unlocks |
| `idle-chess-rpg-town-v1` | Chess Town building levels |
| `idle-chess-rpg-v0.3-audio` | Volume / mute |
| `idle-chess-rpg-ghost-armies-v1` | Arena loadout snapshots (max 50) |

v0.2 save/meta/audio keys are **auto-migrated** on first launch (`persistMigration.ts`).

## License

Private / project-local (see repository owner).
