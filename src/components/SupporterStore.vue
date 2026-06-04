<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import { useMetaStore, type ConvenienceUpgradeId } from '@/store/metaStore'
import { useAudioStore } from '@/store/audioStore'

const meta = useMetaStore()
const audio = useAudioStore()

const offers = computed(() => meta.convenienceUpgradeOffers)

const thankYouVisible = computed(() => meta.lastConvenienceThankYouId !== null)

const thankYouMessage = computed(() => {
  const id = meta.lastConvenienceThankYouId
  if (!id) return ''
  return t('supporterStore.thankYou', { item: t(`supporterStore.items.${id}.label`) })
})

function upgradeLabel(id: ConvenienceUpgradeId): string {
  return t(`supporterStore.items.${id}.label`)
}

function upgradeEffect(id: ConvenienceUpgradeId): string {
  return t(`supporterStore.items.${id}.effect`)
}

function onPurchase(id: ConvenienceUpgradeId): void {
  if (meta.purchaseConvenienceUpgrade(id)) {
    void audio.unlockFromGesture()
    audio.playSfx('capture')
  }
}

function dismissThankYou(): void {
  meta.dismissConvenienceThankYou()
}
</script>

<template>
  <div class="space-y-4 px-3 py-4 sm:px-4">
    <header
      class="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/70 to-slate-900/90 p-4"
    >
      <h2 class="text-sm font-bold uppercase tracking-widest text-fuchsia-300">
        {{ t('supporterStore.title') }}
      </h2>
      <p class="mt-1 text-xs text-slate-400">{{ t('supporterStore.subtitle') }}</p>
      <p class="mt-2 text-[10px] text-slate-500">{{ t('supporterStore.qolNotice') }}</p>
    </header>

    <p
      v-if="thankYouVisible"
      class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
      role="status"
    >
      {{ thankYouMessage }}
      <button
        type="button"
        class="mt-2 block text-xs font-semibold text-emerald-300 underline hover:text-emerald-200"
        @click="dismissThankYou"
      >
        {{ t('supporterStore.dismissThanks') }}
      </button>
    </p>

    <ul class="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/60">
      <li
        v-for="offer in offers"
        :key="offer.id"
        class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
        :class="offer.owned ? 'bg-fuchsia-500/5' : ''"
      >
        <div class="min-w-0">
          <span class="text-sm font-medium text-slate-100">{{ upgradeLabel(offer.id) }}</span>
          <p class="text-xs text-slate-500">{{ upgradeEffect(offer.id) }}</p>
        </div>

        <button
          v-if="offer.owned"
          type="button"
          disabled
          class="shrink-0 cursor-default rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-emerald-300/90"
        >
          {{ t('supporterStore.alreadyOwned') }}
        </button>
        <button
          v-else
          type="button"
          class="shrink-0 rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500 active:scale-[0.98]"
          @click="onPurchase(offer.id)"
        >
          {{ t('supporterStore.unlock') }}
        </button>
      </li>
    </ul>
  </div>
</template>
