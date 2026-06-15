<script setup lang="ts">
import { t } from '@/i18n'
import { useGameStore } from '@/store'

const store = useGameStore()

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
        <span
          v-if="store.autoPlay && store.isWaveActive"
          class="text-[10px] text-slate-400"
        >
          {{ t('combatFooter.adaptiveAi', { profile: store.effectiveAutoAiPersonality }) }}
        </span>
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
