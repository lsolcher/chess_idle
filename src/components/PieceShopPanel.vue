<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/store'

const store = useGameStore()

const offers = computed(() => store.pieceShopOffers)

const slotSummary = computed(
  () => `${store.armySlotsUsed} / ${store.armySlotsMax} board slots`,
)

function formatCost(cost: number): string {
  return cost >= 1_000 ? `${(cost / 1_000).toFixed(1)}K` : cost.toFixed(0)
}

function onPurchase(id: string): void {
  store.purchasePieceShopOffer(id)
}
</script>

<template>
  <section class="rounded-xl border border-slate-800 bg-slate-900/60">
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3"
    >
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">Piece Shop</h2>
        <p class="text-xs text-slate-500">{{ slotSummary }} · prep only</p>
      </div>
      <span
        v-if="!store.isWavePrep"
        class="rounded bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-300"
      >
        Start wave to fight — buy in prep
      </span>
    </div>

    <ul class="max-h-[min(50vh,420px)] divide-y divide-slate-800 overflow-y-auto">
      <li v-if="offers.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">
        No shop offers available.
      </li>
      <li
        v-for="offer in offers"
        :key="offer.id"
        class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0">
          <span class="text-sm font-medium capitalize text-slate-100">{{ offer.label }}</span>
          <p class="text-xs text-slate-500">{{ offer.preview }}</p>
          <p v-if="offer.lockedReason" class="text-[10px] text-amber-500/90">
            {{ offer.lockedReason }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-[0.98]"
          :class="
            offer.purchasable
              ? 'bg-sky-600 text-white hover:bg-sky-500'
              : offer.affordable && !offer.purchasable
                ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                : 'cursor-not-allowed bg-slate-800 text-slate-500'
          "
          :disabled="!offer.purchasable"
          @click="onPurchase(offer.id)"
        >
          {{ formatCost(offer.cost) }} G
        </button>
      </li>
    </ul>
  </section>
</template>
