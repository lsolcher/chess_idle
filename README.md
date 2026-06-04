# Idle Chess RPG

**Version 0.3.0** (*Arena & Dojo*) — browser idle chess roguelike with wave combat, prestige meta, and ethical QoL monetization hooks.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 281 Vitest tests
npm run build    # production bundle
```

## What’s in 0.3.0

| Area | Highlights |
|------|------------|
| **Campaign** | Endless waves, boss cadence, Royal Decree, super-promotions, wave outcome modal, combat stall forfeit |
| **Arena (Phase 9)** | Point-buy loadout UI, `calculateArmyPvPValue`, ghost army DB (`ghostSystem` schema `0.8.0`) |
| **Chess Dojo (9.5)** | Training AI (easy/medium/hard), skill points, Dojo meta upgrades |
| **Supporter Club (10)** | QoL-only perks in isolated `metaStore` — no combat/PvP stat changes |
| **Tech** | Vue 3 + Pinia + persisted state, procedural audio, i18n EN/DE |

## Project layout

- `src/store/gameStore.ts` — run/combat state (prestige resets this)
- `src/store/metaStore.ts` — Dojo + Supporter (persists across prestige)
- `src/engine/` — chess rules, AI, waves, offline math, PvP math
- `src/components/` — UI shells (`GameShell`, `ChessBoard`, modals, upgrade tabs)
- `src/version.ts` — release + storage key constants
- `gdd.md` / `tasks.md` — design doc and roadmap

## Persistence keys (localStorage)

| Key | Contents |
|-----|----------|
| `idle-chess-rpg-v0.3-save` | Campaign run (`GameState` schema `0.3.0`) |
| `idle-chess-rpg-meta-v2` | Skill points, Dojo ranks, Supporter unlocks |
| `idle-chess-rpg-v0.3-audio` | Volume / mute |
| `idle-chess-rpg-ghost-armies-v1` | Arena loadout snapshots (max 50) |

v0.2 save/meta/audio keys are **auto-migrated** on first launch (`persistMigration.ts`).

## License

Private / project-local (see repository owner).
