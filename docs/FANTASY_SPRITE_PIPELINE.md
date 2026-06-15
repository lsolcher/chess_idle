# Fantasy Sprite Pipeline — Elves vs. Dwarves

## Sprite sheet dimensions

| Setting | Value |
|---------|--------|
| **Cell size** | **64 × 64 px** (recommended; 50×50 works if you update `SPRITE_CELL_WIDTH` / `HEIGHT` in `src/ui/fantasySprites.ts`) |
| **Columns** | 6 |
| **Rows** | 2 |
| **Total sheet** | **384 × 128 px** minimum |

## Grid layout (pixels)

Background position uses **negative** offsets: `-(column × cellWidth)px -(row × cellHeight)px`.

| Column | Piece | X offset (64px cells) |
|--------|--------|------------------------|
| 0 | King | `0px` |
| 1 | Queen | `-64px` |
| 2 | Rook | `-128px` |
| 3 | Bishop | `-192px` |
| 4 | Knight | `-256px` |
| 5 | Pawn | `-320px` |

| Row | Faction | Y offset |
|-----|---------|----------|
| 0 | **Elf** (player / friendly) | `0px` |
| 1 | **Dwarf** (enemy) | `-64px` |

Example (64px cells): Elf King = `0px 0px`, Dwarf Queen = `-64px -64px`.

## Export frame naming

Use chess-first names so tooling and QA stay aligned:

```
chess-silhouette-king-elf-v1.png
chess-silhouette-queen-elf-v1.png
chess-silhouette-rook-elf-v1.png
chess-silhouette-bishop-elf-v1.png
chess-silhouette-knight-elf-v1.png
chess-silhouette-pawn-elf-v1.png
chess-silhouette-king-dwarf-v1.png
… (same pattern for dwarf row)
```

Pack the 6×2 grid left-to-right, top row Elf then bottom row Dwarf.

## Install in the game

1. Export combined PNG as `fantasy-chess-sprites.png`.
2. Place it in the project **`public/`** folder (served at `/fantasy-chess-sprites.png`).
3. Optional: copy `assets/sprites_1.png` → `public/fantasy-chess-sprites.png`.
4. Set `CHESS_PIECE_RENDER_MODE = 'sprite'` in `src/ui/chessIdentity.ts` (default after this feature).

Glyphs remain the fallback when `fallbackGlyph` is enabled or render mode is `glyph`.

## Silhouette rules (chess-first)

Each cell must read as a **standard chess piece** (horse, mitre, turret, coronet, pawn stub) — not a generic elf/dwarf character. Faction shows in palette/trim on the same silhouette.
