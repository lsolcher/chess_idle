<script setup lang="ts">
/**
 * Chess-first piece renderer — standard Unicode glyphs (♔♘♖…).
 */
import { computed } from 'vue'
import type { ChessPiece, PieceKind, PieceSide } from '@/types/game'
import {
  chessPieceAriaLabel,
  chessPieceStub,
  resolvePieceDisplayGlyph,
  resolvePieceDisplayGlyphForKind,
} from '@/ui/chessIdentity'
import { normalizePieceKind } from '@/ui/fantasySprites'

const props = defineProps<{
  piece?: ChessPiece
  kind?: PieceKind
  type?: PieceKind | string
  side?: PieceSide
  class?: string
}>()

const displayPiece = computed(() => {
  if (props.piece) return props.piece
  const kind = normalizePieceKind(props.kind ?? props.type)
  const side = props.side ?? 'player'
  return chessPieceStub(kind, side)
})

const resolvedKind = computed((): PieceKind =>
  props.piece?.kind ?? normalizePieceKind(props.kind ?? props.type),
)

const glyph = computed(() =>
  props.piece
    ? resolvePieceDisplayGlyph(props.piece)
    : props.kind || props.type
      ? resolvePieceDisplayGlyphForKind(
          resolvedKind.value,
          props.side ?? displayPiece.value.side,
        )
      : resolvePieceDisplayGlyph(displayPiece.value),
)
</script>

<template>
  <span
    class="chess-piece-renderer chess-piece-glide relative inline-flex items-center justify-center select-none"
    :class="$props.class"
    data-render-mode="glyph"
    :data-piece-kind="resolvedKind"
    role="img"
    :aria-label="chessPieceAriaLabel(displayPiece)"
  >
    <span
      class="chess-piece-glyph flex size-full items-center justify-center text-lg sm:text-xl"
      aria-hidden="true"
    >
      {{ glyph }}
    </span>
  </span>
</template>
