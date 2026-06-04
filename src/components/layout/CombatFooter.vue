<script setup lang="ts">
import { useGameStore } from '@/store'
import type { AutoAiPersonality } from '@/types/game'

const store = useGameStore()

const strategies: { id: AutoAiPersonality; label: string }[] = [
  { id: 'defensive', label: 'Defensive' },
  { id: 'aggressive', label: 'Aggressive' },
  { id: 'protectKing', label: 'Protect King' },
]

function onStrategyChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value as AutoAiPersonality
  store.setAutoAiPersonality(value)
}

const staminaPct = (): number =>
  store.staminaMax > 0 ? (store.staminaCurrent / store.staminaMax) * 100 : 0
</script>

<template>
  <footer
    class="border-t border-slate-800 bg-slate-950/95 px-3 py-2 safe-bottom sm:px-4"
  >
    <div class="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3 text-xs text-slate-400">
        <label class="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            class="size-4 rounded border-slate-600 bg-slate-800 text-emerald-500"
            :checked="store.autoPlay"
            @change="store.setAutoPlay(($event.target as HTMLInputElement).checked)"
          />
          Auto-play
        </label>
        <span :class="store.isCombatLoopRunning ? 'text-emerald-400' : 'text-slate-500'">
          {{ store.isCombatLoopRunning ? 'Loop ON' : 'Loop OFF' }}
        </span>
        <label
          v-if="store.autoPlay && store.isWaveActive"
          class="flex items-center gap-1.5 text-[10px] text-slate-400"
        >
          <span class="uppercase tracking-wide">Strategy</span>
          <select
            class="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200"
            :value="store.autoAiPersonality"
            @change="onStrategyChange"
          >
            <option v-for="s in strategies" :key="s.id" :value="s.id">
              {{ s.label }}
            </option>
          </select>
        </label>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-[10px] uppercase text-slate-500">Stamina</span>
        <div class="h-2 w-32 overflow-hidden rounded-full bg-slate-800">
          <div
            class="h-full rounded-full bg-sky-500 transition-all"
            :style="{ width: `${staminaPct()}%` }"
          />
        </div>
        <span class="text-xs font-mono text-slate-300">
          {{ store.staminaCurrent }}/{{ store.staminaMax }}
        </span>
      </div>
    </div>
  </footer>
</template>
