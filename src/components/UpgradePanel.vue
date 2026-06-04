<script setup lang="ts">
import { computed, ref } from 'vue'
import AudioSettingsPanel from '@/components/AudioSettingsPanel.vue'
import CosmeticsPanel from '@/components/CosmeticsPanel.vue'
import ArenaLoadout from '@/components/ArenaLoadout.vue'
import SupporterStore from '@/components/SupporterStore.vue'
import ChessDojo from '@/components/ChessDojo.vue'
import ChessTown from '@/components/ChessTown.vue'
import MetaUpgradePanel from '@/components/MetaUpgradePanel.vue'
import PieceShopPanel from '@/components/PieceShopPanel.vue'
import { useGameStore } from '@/store'
import { useAudioStore } from '@/store/audioStore'
import type { UpgradeTrackId } from '@/engine/upgrades'

type UpgradeTab =
  | 'shop'
  | 'army'
  | 'click'
  | 'meta'
  | 'dojo'
  | 'town'
  | 'arena'
  | 'supporter'
  | 'wardrobe'
  | 'audio'

const store = useGameStore()
const audio = useAudioStore()
const activeTab = ref<UpgradeTab>('shop')

const tabs: { id: UpgradeTab; label: string; disabled?: boolean }[] = [
  { id: 'shop', label: 'Shop' },
  { id: 'army', label: 'Upgrades' },
  { id: 'click', label: 'Click' },
  { id: 'meta', label: 'Meta' },
  { id: 'dojo', label: 'Dojo' },
  { id: 'town', label: 'Town' },
  { id: 'arena', label: 'Arena' },
  { id: 'supporter', label: 'Club' },
  { id: 'wardrobe', label: 'Themes' },
  { id: 'audio', label: 'Audio' },
]

const armyTracks: UpgradeTrackId[] = ['ap', 'hp', 'def', 'initiative']
const clickTracks: UpgradeTrackId[] = ['clickPower', 'promotionMastery']

const filteredOffers = computed(() => {
  const offers = store.upgradeOffers
  if (activeTab.value === 'army') {
    return offers.filter((o) => armyTracks.includes(o.track))
  }
  if (activeTab.value === 'click') {
    return offers.filter((o) => clickTracks.includes(o.track))
  }
  return []
})

function formatCost(cost: number): string {
  return cost >= 1_000 ? `${(cost / 1_000).toFixed(1)}K` : cost.toFixed(0)
}

function onPurchase(id: string): void {
  store.purchaseUpgradeOffer(id)
}

function onBuyBest(): void {
  store.purchaseBestRoiUpgrade()
}

function onTabSelect(tabId: UpgradeTab): void {
  activeTab.value = tabId
  void audio.unlockFromGesture()
  audio.playSfx('uiClick')
}
</script>

<template>
  <section class="rounded-xl border border-slate-800 bg-slate-900/60">
    <div class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">Upgrades</h2>
      <button
        type="button"
        class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        :disabled="!store.bestRoiUpgradeId"
        @click="onBuyBest"
      >
        Buy Best ROI
      </button>
    </div>

    <div class="flex border-b border-slate-800 px-2" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        class="px-4 py-2 text-xs font-medium uppercase tracking-wide transition"
        :class="
          activeTab === tab.id
            ? 'border-b-2 border-emerald-400 text-emerald-300'
            : 'text-slate-500 hover:text-slate-300'
        "
        :disabled="tab.disabled"
        @click="!tab.disabled && onTabSelect(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <PieceShopPanel v-if="activeTab === 'shop'" class="border-0 bg-transparent" />

    <MetaUpgradePanel v-else-if="activeTab === 'meta'" />

    <ChessDojo v-else-if="activeTab === 'dojo'" class="border-0 bg-transparent" />

    <ChessTown v-else-if="activeTab === 'town'" class="border-0 bg-transparent" />

    <ArenaLoadout v-else-if="activeTab === 'arena'" class="border-0 bg-transparent" />

    <SupporterStore v-else-if="activeTab === 'supporter'" class="border-0 bg-transparent" />

    <CosmeticsPanel v-else-if="activeTab === 'wardrobe'" />

    <AudioSettingsPanel v-else-if="activeTab === 'audio'" />

    <ul
      v-else-if="activeTab === 'army' || activeTab === 'click'"
      class="max-h-[min(60vh,520px)] divide-y divide-slate-800 overflow-y-auto"
    >
      <li v-if="filteredOffers.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">
        No upgrades in this tab yet.
      </li>
      <li
        v-for="offer in filteredOffers"
        :key="offer.id"
        class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        :class="offer.isBestRoi ? 'bg-emerald-500/5' : ''"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium capitalize text-slate-100">{{ offer.label }}</span>
            <span
              v-if="offer.isBestRoi"
              class="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300"
            >
              Best ROI
            </span>
          </div>
          <p class="text-xs text-slate-500">{{ offer.preview }}</p>
          <p class="text-[10px] text-slate-600">
            Lv {{ offer.currentLevel }}/{{ offer.maxLevel }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-[0.98]"
          :class="
            offer.affordable
              ? offer.isBestRoi
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
              : 'cursor-not-allowed bg-slate-800 text-slate-500'
          "
          :disabled="!offer.affordable"
          @click="onPurchase(offer.id)"
        >
          {{ formatCost(offer.cost) }} G
        </button>
      </li>
    </ul>

  </section>
</template>
