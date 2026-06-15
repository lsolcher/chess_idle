# Version 0.4.0 Plan — *Visuals & Matchmaking*

**Status:** Active development cycle  
**Package:** `0.4.0` · **Save schema:** `0.3.0` (unchanged until migration)  
**Baseline:** 378 Vitest · 73 files · green at kickoff (2026-06-09)

## Goals

1. **High-Fantasy Art Pipeline** — ship `sprites_1.png` via `fantasySprites.ts` + `ChessPieceRenderer.vue` with mandatory glyph fallback.
2. **Ghost Matchmaking UI** — fight armies from the local ghost DB without live server.

## Out of scope (v0.4)

- Live ranked PvP / server-authoritative matchmaking
- Save schema `0.4.0` migration (deferred until art + matchmaking stabilize)
- Exhibition / Wardrobe revival

## Milestones

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Sprite atlas wired to `assets/sprites_1.png` | Pending |
| 2 | Renderer fallback QA (missing sheet → glyphs, combat loop intact) | Pending |
| 3 | Ghost picker + practice fight UI | Pending |
| 4 | i18n + docs + CHANGELOG | Pending |

## Guardrails

- `npm test` must stay green after each milestone.
- No combat-store changes without regression tests.
- `CHESS_PIECE_RENDER_MODE === 'glyph'` remains safe default until atlas verified in-browser.
