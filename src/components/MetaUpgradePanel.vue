<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/store'

const store = useGameStore()

const offers = computed(() => store.metaUpgradeOffers)

function onPurchase(id: string): void {
  store.purchaseMetaUpgrade(id as Parameters<typeof store.purchaseMetaUpgrade>[0])
}
</script>

<template>
  <div class="px-4 py-3">
    <p
      v-if="!store.metaTreeUnlocked"
      class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
    >
      Reach Stage 20 and prestige once to unlock the Elo meta tree.
    </p>

    <p
      v-else-if="store.exhibitionGoldPerSec > 0"
      class="mb-3 text-[10px] text-slate-500"
    >
      Exhibitions: +{{ store.exhibitionGoldPerSec.toFixed(2) }} G/s (background)
    </p>

    <ul class="divide-y divide-slate-800">
      <li
        v-for="offer in offers"
        :key="offer.id"
        class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0">
          <span class="text-sm font-medium text-slate-100">{{ offer.label }}</span>
          <p class="text-xs text-slate-500">{{ offer.effectPreview }}</p>
          <p class="text-[10px] text-slate-600">
            Rank {{ offer.rank }}/{{ offer.maxRank }}
            <span v-if="offer.locked" class="text-amber-400"> · {{ offer.lockReason }}</span>
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          :class="
            offer.affordable
              ? 'bg-violet-600 text-white hover:bg-violet-500'
              : 'bg-slate-800 text-slate-500'
          "
          :disabled="!offer.affordable"
          @click="onPurchase(offer.id)"
        >
          {{ offer.nextCost }} E
        </button>
      </li>
    </ul>
  </div>
</template>
