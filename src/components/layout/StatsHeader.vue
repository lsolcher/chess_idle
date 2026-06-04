<script setup lang="ts">
import { computed } from 'vue'
import PrestigeBanner from '@/components/PrestigeBanner.vue'
import { useGameStore } from '@/store'
import { APP_RELEASE_CODENAME, APP_VERSION } from '@/version'

const store = useGameStore()

const formattedGold = computed(() =>
  store.gold >= 1_000_000
    ? `${(store.gold / 1_000_000).toFixed(2)}M`
    : store.gold >= 1_000
      ? `${(store.gold / 1_000).toFixed(1)}K`
      : store.gold.toFixed(0),
)

const formattedGoldPerSec = computed(() => store.estimatedGoldPerSec.toFixed(2))
</script>

<template>
  <header
    class="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur sm:px-4 sm:py-3"
  >
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="text-base font-bold tracking-tight sm:text-lg">Idle Chess RPG</h1>
        <p class="text-[10px] text-slate-500 sm:text-xs">
          Stage {{ store.currentStage }} · v{{ APP_VERSION }} ({{ APP_RELEASE_CODENAME }})
        </p>
      </div>
      <div class="flex flex-wrap gap-1.5 text-[10px] font-mono sm:gap-2 sm:text-xs">
        <span class="rounded-md bg-amber-500/15 px-2 py-1 text-amber-300">G {{ formattedGold }}</span>
        <span class="rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-300">
          {{ formattedGoldPerSec }}/s
        </span>
        <span class="rounded-md bg-violet-500/15 px-2 py-1 text-violet-300">
          E {{ store.eloShards }}
        </span>
        <span class="rounded-md bg-rose-500/15 px-2 py-1 text-rose-300">
          ×{{ store.comboCount }}
        </span>
        <span class="rounded-md bg-yellow-500/15 px-2 py-1 text-yellow-200">
          T {{ store.trophies }}
        </span>
      </div>
    </div>
    <div class="mx-auto mt-2 max-w-6xl space-y-2">
      <p
        v-if="store.lastOfflineGoldGranted > 0"
        class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-100"
      >
        <span>While away: +{{ store.lastOfflineGoldGranted.toLocaleString() }} G</span>
        <button
          type="button"
          class="rounded px-2 py-0.5 text-[10px] font-semibold text-sky-200 hover:bg-sky-500/20"
          @click="store.dismissOfflineGoldToast()"
        >
          Dismiss
        </button>
      </p>
      <p
        v-if="store.lastTrophyEarned"
        class="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-200"
      >
        Trophy earned: {{ store.lastTrophyEarned }}
      </p>
      <PrestigeBanner />
    </div>
  </header>
</template>
