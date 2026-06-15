# Final Balance Pass (v0.3)

Headless model: `src/engine/balanceSimulation.ts` · tunables: `src/engine/balanceConstants.ts`

Run: `npx vitest run src/engine/balanceSimulation.test.ts -t "writes balance"` → `balance-report.txt`

## Constant changes

| Knob | Before | After |
|------|--------|-------|
| `STAGE_GOLD_MULT_BASE` | 1.14 | **1.12** |
| `ENEMY_HP_STAGE_GROWTH` | 1.08 | **1.114** |
| `ENEMY_AP_STAGE_GROWTH` | 1.06 | **1.055** |
| Arena `BASE_PC` queen / rook / pawn | 320 / 200 / 40 | **480 / 260 / 45** |
| `DOJO_HARD_LOOKAHEAD_PLIES` | 2 | **3** |
| Dojo SP (easy / med / hard) | 1 / 2 / 3 | **2 / 3 / 5** |
| Town AP / speed / gold per level | 2% / 3% / 3% | **1% / 1.2% / 1.2%** |

## Player journey (auto-play model)

| Milestone | Estimated time |
|-----------|----------------|
| Stage 20 (first prestige) | **~34.2 min** (`balance-report.txt`) |
| Stage 50 | **~19 h** (endless curve; upgrades required) |
| Stage 100 | **~109 d** (theoretical idle ceiling) |

- **Prestiges to meaningful meta:** 1 run unlocks prestige; **2–4 runs** fund Opening Theory + first Deep Thought ranks.
- **Dojo:** ~3 Hard wins (15 SP) buys first town Barracks/Academy level; no multi-hour grind on one difficulty.

## Economy snapshots (model)

See generated `balance-report.txt` for live numbers. Stage 50+ GPM spikes are expected (exponential `1.12^stage` without full sink simulation).

**Breakpoint:** Stage **10** (knight unlock + boss cadence) — first major power spike; shop ROI should be checked in playtest.

## AI

- **Hard Dojo:** 3-ply minimax (+ Deep Thought ranks).
- **Ghost matchmaking:** `selectGhostOpponent` tie-breaks toward **unit variety** over pawn-only blobs.

## Tests

374 Vitest tests (73 files; includes `balanceSimulation.test.ts`, `combatRegression.test.ts`, stage/town/pvp/meta tests).
