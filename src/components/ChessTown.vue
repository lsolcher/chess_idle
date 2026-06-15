<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  getBuildingVisualClasses,
  getBuildingVisualTier,
} from '@/engine/aestheticProgression'
import type { TownBuildingId } from '@/engine/townBuildings'
import { canUpgradeBuilding } from '@/engine/townBuildings'
import { t } from '@/i18n'
import { useGameStore } from '@/store'
import { useMetaStore } from '@/store/metaStore'
import { useTownStore } from '@/store/townStore'
import { useAudioStore } from '@/store/audioStore'

const game = useGameStore()
const meta = useMetaStore()
const town = useTownStore()
const audio = useAudioStore()

const nowMs = ref(Date.now())
let timerId = 0

const bonuses = computed(() => town.townBonuses)

const gridSlots = computed(() =>
  town.buildingCards.map((card, index) => ({
    ...card,
    gridClass: index === 0 ? 'col-start-1 row-start-2' : index === 1 ? 'col-start-3 row-start-1' : 'col-start-3 row-start-3',
    visualClasses: getBuildingVisualClasses(getBuildingVisualTier(card.level)),
  })),
)

function currencyLabel(currency: 'skillPoints' | 'eloShards'): string {
  return currency === 'skillPoints' ? t('chessTown.skillPoints') : t('chessTown.eloShards')
}

function canUpgrade(id: TownBuildingId): boolean {
  return (
    canUpgradeBuilding(id, town.buildings, nowMs.value) &&
    town.canAffordUpgrade(id)
  )
}

function onUpgrade(id: TownBuildingId): void {
  void audio.unlockFromGesture()
  audio.playSfx('uiClick')
  town.upgradeBuilding(id, nowMs.value)
}

onMounted(() => {
  timerId = window.setInterval(() => {
    nowMs.value = Date.now()
    town.tickTown(nowMs.value)
  }, 200)
})

onUnmounted(() => {
  window.clearInterval(timerId)
})
</script>

<template>
  <section class="stone-panel flex flex-col gap-4 p-4">
    <header class="flex flex-col gap-1">
      <h3 class="fantasy-heading text-sm font-semibold uppercase tracking-wide">
        {{ t('chessTown.title') }}
      </h3>
      <p class="text-xs text-slate-400">{{ t('chessTown.subtitle') }}</p>
      <p class="text-[10px] text-slate-500">{{ t('chessTown.persistNotice') }}</p>
    </header>

    <dl
      class="grid grid-cols-3 gap-2 rounded-lg border-2 border-[var(--color-iron)] bg-[rgba(15,23,42,0.5)] px-3 py-2 text-[10px]"
    >
      <div>
        <dt class="text-slate-500">{{ t('chessTown.bonusAp') }}</dt>
        <dd class="font-semibold text-rose-200">×{{ bonuses.apMult.toFixed(2) }}</dd>
      </div>
      <div>
        <dt class="text-slate-500">{{ t('chessTown.bonusSpeed') }}</dt>
        <dd class="font-semibold text-sky-200">×{{ bonuses.globalSpeedMult.toFixed(2) }}</dd>
      </div>
      <div>
        <dt class="text-slate-500">{{ t('chessTown.bonusGold') }}</dt>
        <dd class="font-semibold text-amber-200">×{{ bonuses.goldMult.toFixed(2) }}</dd>
      </div>
    </dl>

    <div class="flex flex-wrap gap-3 text-xs text-slate-400">
      <span>{{ t('chessTown.skillPoints') }}: {{ meta.skillPoints }}</span>
      <span>{{ t('chessTown.eloShards') }}: {{ game.eloShards }}</span>
    </div>

    <div
      class="relative grid min-h-[280px] grid-cols-3 grid-rows-3 gap-2 rounded-xl border border-emerald-900/40 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08),transparent_65%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.95))] p-3"
      role="img"
      :aria-label="t('chessTown.townView')"
    >
      <div
        class="pointer-events-none col-span-3 row-span-3 rounded-lg border border-dashed border-emerald-800/30 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[24px_24px]"
      />

      <article
        v-for="slot in gridSlots"
        :key="slot.id"
        class="relative z-10 flex flex-col gap-2 rounded-lg border p-3 shadow-lg backdrop-blur-sm"
        :class="[slot.gridClass, slot.visualClasses]"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="text-sm font-semibold capitalize text-slate-100">
              {{ t(`chessTown.buildings.${slot.id}.label`) }}
            </h4>
            <p class="text-[10px] uppercase tracking-wide text-slate-300/80">
              {{ slot.visualLabel }} · {{ t('chessTown.level', { level: slot.level, max: slot.maxLevel }) }}
            </p>
          </div>
          <span
            class="rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-emerald-200"
          >
            Lv {{ slot.level }}
          </span>
        </div>

        <p class="text-[11px] text-slate-200/90">{{ slot.preview }}</p>

        <div v-if="town.isUpgrading(slot.id, nowMs)" class="space-y-1">
          <div class="h-2 overflow-hidden rounded-full bg-black/30">
            <div
              class="h-full rounded-full bg-emerald-400 transition-[width] duration-200"
              :style="{ width: `${Math.round(town.constructionProgress(slot.id, nowMs) * 100)}%` }"
            />
          </div>
          <p class="text-[10px] text-emerald-200">{{ t('chessTown.constructing') }}</p>
        </div>

        <button
          v-else
          type="button"
          class="mt-auto rounded-md px-3 py-2 text-xs font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          :class="
            canUpgrade(slot.id)
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-slate-800 text-slate-500'
          "
          :disabled="!canUpgrade(slot.id)"
          @click="onUpgrade(slot.id)"
        >
          <template v-if="slot.maxed">{{ t('chessTown.maxed') }}</template>
          <template v-else>
            {{ t('chessTown.upgrade') }} · {{ slot.cost }}
            {{ currencyLabel(slot.currency) }}
          </template>
        </button>
      </article>
    </div>
  </section>
</template>
