# Idle Chess RPG — Development Roadmap

**Version:** 0.4.0 (*Visuals & Matchmaking*) · **Target release:** 1.0 · **Save schema:** `0.3.0` · **Tests:** 378 Vitest · **Balance:** [docs/BALANCE_PASS.md](docs/BALANCE_PASS.md) · **Design:** [gdd.md](gdd.md)

## Active Phase: v0.4.0 — Visuals & Matchmaking

**Themes:** High-Fantasy Art Pipeline Integration · Ghost Matchmaking UI

### Architectural guardrails

- **Green baseline:** `npm test` — 378 / 378 passing (73 files) at cycle kickoff.
- **Sprite fallback:** `CHESS_PIECE_RENDER_MODE` + `ChessPieceRenderer` must fall back to Unicode glyphs if `assets/sprites_1.png` fails to load — combat loop must never crash on missing art.

### Core objectives

- [ ] Wire `fantasySprites.ts` atlas mapping to `assets/sprites_1.png` (public serve path + frame grid).
- [ ] Restore `ChessPieceRenderer.vue` sprite mode with `CHESS_PIECE_RENDER_MODE` toggle and graceful glyph fallback on load failure.
- [ ] Build **Ghost Matchmaking UI** — browse local ghost DB, select opponent army, launch practice fight against saved snapshot (`ghostSystem.ts` / `ArenaLoadout` integration).
- [ ] Matchmaking combat shell: reuse wave combat loop or isolated board session without corrupting campaign `GameState`.
- [ ] i18n (`en` / `de`) for matchmaking labels and art-pipeline debug strings (if user-visible).
- [ ] Tests: sprite mapping unit tests, renderer fallback test, ghost match flow smoke test.
- [ ] Update `docs/FANTASY_SPRITE_PIPELINE.md` for `sprites_1.png` layout.

## 1.0 Launch Checklist (deferred post-v0.4)

- [ ] Final manual playtest (Stages 40–60)
- [ ] Final Docs/GDD verification
- [ ] Deploy readiness check

## Phases 1–12 — COMPLETE (v0.3.0 → 1.0 RC)

All work through final release prep is shipped. See [CHANGELOG.md](CHANGELOG.md) — **[0.3.0] - 1.0 RC**.

### Phase 1–8.8: Core Engines & Ghost System

- [x] Core wave/combat, persistence, audio, ghost snapshots, Grandmaster boss (Phase 8.8)

### Phase 9: Multiplayer & Matchmaking (prep)

- [x] Point Cost Engine (`src/engine/pvpMath.ts`)
- [x] Arena Tactical Loadout UI (`src/components/ArenaLoadout.vue`)
- [x] Arena Stat Clamping (`src/engine/pvpNormalization.ts`)
- [x] Ghost army export / local DB (`ghostSystem.ts`)

### Phase 9.5: Chess Dojo

- [x] Chess Engine Interface & AI Tiers (Easy/Med/Hard)
- [x] Skill Points & Dojo Upgrade Tree
- [x] Dojo UI (`ChessDojo.vue`) + wave counter modules (`wavePatterns.ts`)

### Phase 10: Ethical Hybrid Monetization

- [x] Supporter Store (`SupporterStore.vue`) — QoL only

### Phase 11: Chess Town

- [x] `townStore.ts`, `townBuildings.ts`, `ChessTown.vue`, balance integration

### Phase 12: Final Release Prep (1.0 RC)

- [x] Intent Ribbon + Tempo Bonus (`enemyIntent.ts`, `tempoBonus.ts`)
- [x] Royal Decree Last Stand (`royalDecree.ts`)
- [x] Wave patterns + Adaptive AI
- [x] Store modularization: `combatStore` + `economyStore` hub (`gameStore`)
- [x] Onboarding telegraph + `armOnboardingMove` hydrate fix
- [x] Pawn head-on clash + king flank AI (`moves.ts`, `aiHeuristic.ts`)
- [x] Board UI: enemy initiative pies, selection rings, attackable pulse, enemy move preview
- [x] Balance: Stage 20 ~34.2 min (`balance-report.txt`)
- [x] **378 Vitest** (73 files)

## Post-1.0 Backlog

- **Live PvP:** Ranked / Unranked queues with server-authoritative Elo pairing
- Optional payment bridge for Supporter Club
- Deploy-phase sync + production hosting
