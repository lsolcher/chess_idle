<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/store'
import { getPieceVictoryGlowClasses } from '@/engine/aestheticProgression'
import ChessPieceRenderer from '@/components/ChessPieceRenderer.vue'
import type { ChessPiece, PieceKind } from '@/types/game'

const store = useGameStore()

const pieces = computed(() => store.playerPiecesWithProgress)
const nextId = computed(() => store.nextActingPieceId)

const kindLabel: Record<PieceKind, string> = {
  king: 'King',
  pawn: 'Pawn',
  knight: 'Knight',
  bishop: 'Bishop',
  rook: 'Rook',
  queen: 'Queen',
}

function ringStyle(piece: ChessPiece): Record<string, string> {
  const pct = Math.round(piece.initiative.progress * 100)
  const color = piece.id === nextId.value ? '#34d399' : '#64748b'
  return {
    background: `conic-gradient(${color} ${pct}%, #1e293b ${pct}%)`,
  }
}
</script>

<template>
  <section class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Initiative
      </h2>
      <span
        class="text-xs"
        :class="store.isCombatLoopRunning ? 'text-emerald-400' : 'text-slate-500'"
      >
        {{ store.isCombatLoopRunning ? 'Loop ON' : 'Loop OFF' }}
      </span>
    </div>

    <ul v-if="pieces.length" class="mt-3 space-y-3">
      <li
        v-for="piece in pieces"
        :key="piece.id"
        class="flex items-center gap-3 rounded-lg bg-slate-950/50 px-3 py-2"
        :class="piece.id === nextId ? 'ring-1 ring-emerald-500/50' : ''"
      >
        <div
          class="relative grid h-10 w-10 shrink-0 place-items-center rounded-full p-0.5"
          :style="ringStyle(piece)"
        >
          <ChessPieceRenderer
            :piece="piece"
            class="chess-piece-victory-wrap rounded-full bg-slate-900 text-lg"
            :class="getPieceVictoryGlowClasses(store.aestheticProgress.victoryGlowTier, piece.kind)"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">{{ kindLabel[piece.kind] }}</p>
          <p class="text-xs text-slate-500">
            {{ (piece.initiative.progress * 100).toFixed(0) }}% ·
            {{ piece.initiative.baseIntervalSec.toFixed(1) }}s base
          </p>
        </div>
        <span
          v-if="piece.id === nextId"
          class="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400"
        >
          Next
        </span>
      </li>
    </ul>
    <p v-else class="mt-3 text-sm text-slate-500">No pieces on board.</p>
  </section>
</template>
