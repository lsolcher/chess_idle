<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/store'
import { getPieceVictoryGlowClasses } from '@/engine/aestheticProgression'
import ChessPieceRenderer from '@/components/ChessPieceRenderer.vue'
import type { PieceKind, PieceSide } from '@/types/game'

const store = useGameStore()

const queue = computed(() => store.combatTurnOrder)
const activeId = computed(() => store.activeTurnPieceId)

function playerVictoryGlowClass(kind: PieceKind): string {
  const tier = store.aestheticProgress.victoryGlowTier
  if (tier <= 0) return ''
  return getPieceVictoryGlowClasses(tier, kind)
}

const kindLabel: Record<PieceKind, string> = {
  king: 'King',
  pawn: 'Pawn',
  knight: 'Knight',
  bishop: 'Bishop',
  rook: 'Rook',
  queen: 'Queen',
}

function ringStyle(progress: number, isActive: boolean, side: PieceSide): Record<string, string> {
  const pct = Math.round(progress * 100)
  const color = isActive
    ? side === 'player'
      ? '#38bdf8'
      : '#fb7185'
    : side === 'player'
      ? '#64748b'
      : '#7f1d1d'
  return {
    background: `conic-gradient(${color} ${pct}%, #1e293b ${pct}%)`,
  }
}
</script>

<template>
  <section class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Turn order
      </h2>
      <span
        v-if="store.isWaveActive"
        class="text-[10px] font-medium uppercase tracking-wide"
        :class="
          store.autoPlay
            ? 'text-emerald-400'
            : store.isAwaitingManualMove
              ? 'text-sky-300'
              : store.activeTurnSide === 'enemy'
                ? 'text-rose-400'
                : 'text-slate-500'
        "
      >
        {{
          store.autoPlay
            ? 'Auto batch'
            : store.isAwaitingManualMove
              ? 'Your move'
              : store.activeTurnSide === 'enemy'
                ? 'Enemy acting'
                : 'Filling initiative'
        }}
      </span>
    </div>

    <p v-if="!store.isWaveActive" class="mt-3 text-sm text-slate-500">
      Turn queue appears during combat.
    </p>

    <ul v-else-if="queue.length" class="mt-3 max-h-[min(50vh,420px)] space-y-2 overflow-y-auto">
      <li
        v-for="entry in queue"
        :key="entry.id"
        class="flex items-center gap-3 rounded-lg px-3 py-2"
        :class="[
          entry.id === activeId
            ? entry.side === 'player'
              ? 'bg-sky-950/50 ring-1 ring-sky-500/60'
              : 'bg-rose-950/40 ring-1 ring-rose-500/50'
            : 'bg-slate-950/50',
        ]"
      >
        <span
          class="w-5 shrink-0 text-center text-[10px] font-bold tabular-nums text-slate-500"
        >
          {{ entry.order }}
        </span>
        <div
          class="relative grid h-9 w-9 shrink-0 place-items-center rounded-full p-0.5"
          :style="ringStyle(entry.progress, entry.id === activeId, entry.side)"
        >
          <ChessPieceRenderer
            :kind="entry.kind"
            :side="entry.side"
            class="chess-piece-victory-wrap rounded-full bg-slate-900 text-base"
            :class="[
              entry.side === 'player' ? 'text-sky-200' : 'text-rose-300',
              entry.side === 'player' ? playerVictoryGlowClass(entry.kind) : '',
            ]"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-slate-200">
            {{ kindLabel[entry.kind] }}
            <span
              class="ml-1 text-[10px] font-semibold uppercase"
              :class="entry.side === 'player' ? 'text-sky-400' : 'text-rose-400'"
            >
              {{ entry.side }}
            </span>
            <span
              v-if="entry.isBoss"
              class="ml-1 rounded bg-amber-500/20 px-1 text-[10px] text-amber-300"
            >
              Boss
            </span>
          </p>
          <p class="text-xs text-slate-500">
            {{ (entry.progress * 100).toFixed(0) }}%
            <span v-if="entry.isReady" class="text-emerald-400"> · ready</span>
          </p>
        </div>
        <span
          v-if="entry.id === activeId"
          class="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
          :class="
            entry.side === 'player' ? 'bg-sky-500/20 text-sky-300' : 'bg-rose-500/20 text-rose-300'
          "
        >
          Now
        </span>
      </li>
    </ul>
    <p v-else class="mt-3 text-sm text-slate-500">No combatants on board.</p>
  </section>
</template>
