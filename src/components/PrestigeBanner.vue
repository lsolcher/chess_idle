<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/store'
import { PRESTIGE_UNLOCK_STAGE } from '@/store/gameStore'

const store = useGameStore()

const canShow = computed(() => store.canPrestige || store.hasPrestigedOnce)

const statusText = computed(() => {
  if (!store.canPrestige) {
    return `Prestige unlocks at Stage ${PRESTIGE_UNLOCK_STAGE}`
  }
  return `Reset run for +${store.projectedEloEarned} Elo (keeps meta & trophies)`
})

function onPrestige(): void {
  if (!store.canPrestige) return
  store.performPrestige()
}
</script>

<template>
  <div
    v-if="canShow"
    class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2"
  >
    <div class="min-w-0">
      <p class="text-xs font-semibold uppercase tracking-wide text-violet-300">Prestige</p>
      <p class="text-[10px] text-slate-400">{{ statusText }}</p>
    </div>
    <button
      type="button"
      class="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-40"
      :disabled="!store.canPrestige"
      @click="onPrestige"
    >
      Prestige (+{{ store.projectedEloEarned }} E)
    </button>
  </div>
</template>
