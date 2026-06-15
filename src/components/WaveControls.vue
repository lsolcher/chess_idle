<script setup lang="ts">

import { computed } from 'vue'

import { useGameStore } from '@/store'

import { AUTO_ADVANCE_WAVE_COST } from '@/engine/waveAutomation'



const store = useGameStore()



const waveLabel = (): string => {

  switch (store.wavePhase) {

    case 'WAVE_PREP':

      return 'Prep — position army & shop'

    case 'WAVE_ACTIVE':

      return 'Combat'

    default:

      return ''

  }

}



const autoAdvanceOffer = computed(() =>

  store.upgradeOffers.find((o) => o.id === 'global:autoAdvanceWaves'),

)



function onPurchaseAutoAdvance(): void {

  const offer = autoAdvanceOffer.value

  if (!offer) return

  store.purchaseUpgradeOffer(offer.id)

}

</script>



<template>

  <section

    class="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"

  >

    <div class="flex flex-wrap items-center justify-between gap-2">

      <div class="min-w-0">

        <p class="text-[10px] uppercase tracking-wide text-slate-500">Wave</p>

        <p class="text-sm font-medium text-slate-200">{{ waveLabel() }}</p>
        <p class="text-[10px] text-slate-500">
          Stage {{ store.currentStage }} · {{ store.waveCheckpointLabel }}
        </p>

        <p

          v-if="store.isCurrentStageBoss"

          class="text-[10px] font-semibold uppercase tracking-wide text-rose-400"

        >

          {{ store.activeBossLabel ?? 'Boss' }} · {{ store.bossClearGoldMultiplier }}× clear gold

        </p>

        <div
          v-if="store.showKingFallOverlay"
          class="mt-1 rounded-md border border-rose-700/60 bg-rose-950/50 px-2 py-1.5"
          role="alert"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-rose-300">
            King fallen
          </p>
          <p class="text-[11px] text-rose-100/90">{{ store.kingFallMessage }}</p>
          <p
            v-if="store.kingFallTelegraph"
            class="mt-0.5 text-[10px] font-medium text-rose-200/80"
          >
            {{ store.kingFallTelegraph }}
          </p>
        </div>

        <p v-if="store.lastPawnLeakDamage > 0" class="text-[10px] text-rose-300">
          Pawn leak! −{{ store.lastPawnLeakDamage }} King HP
        </p>

        <p v-if="store.failCountThisStage > 0" class="text-[10px] text-amber-500/80">

          Fail ×{{ store.failCountThisStage }} — enemies at

          {{ Math.round(store.enemyHpScale * 100) }}% HP

        </p>

      </div>



      <div class="flex shrink-0 gap-2">

        <button

          v-if="store.canStartWave"

          type="button"

          class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-500"

          @click="store.startWave()"

        >

          Start Wave

        </button>

        <span

          v-if="store.isWaveActive"

          class="rounded-md border border-emerald-700/50 bg-emerald-950/40 px-2 py-1.5 text-xs text-emerald-400"

        >

          {{ store.enemyPieces.length }} enemies

        </span>

      </div>

    </div>



    <div

      v-if="autoAdvanceOffer"

      class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-700/80 bg-slate-950/50 px-2 py-1.5"

    >

      <p class="text-[10px] text-slate-400">Unlock true idle: auto next wave + auto-start</p>

      <button

        type="button"

        class="rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40"

        :disabled="!autoAdvanceOffer.affordable"

        @click="onPurchaseAutoAdvance"

      >

        {{ AUTO_ADVANCE_WAVE_COST }} G

      </button>

    </div>



    <div

      v-else-if="store.autoAdvanceWavesPurchased"

      class="flex flex-wrap items-center gap-3 text-[10px] text-slate-400"

    >

      <label class="flex cursor-pointer items-center gap-1.5">

        <input

          type="checkbox"

          class="rounded border-slate-600 bg-slate-800 text-emerald-500"

          :checked="store.autoAdvanceWavesEnabled"

          @change="store.setAutoAdvanceWavesEnabled(($event.target as HTMLInputElement).checked)"

        />

        Auto-advance waves

      </label>

      <label class="flex cursor-pointer items-center gap-1.5">

        <input

          type="checkbox"

          class="rounded border-slate-600 bg-slate-800 text-sky-500"

          :checked="store.autoStartWavesEnabled"

          @change="store.setAutoStartWavesEnabled(($event.target as HTMLInputElement).checked)"

        />

        Auto-start combat

      </label>

      <span
        v-if="store.isWavePrep && store.waveCompleteAtMs && store.autoAdvanceWavesEnabled && store.autoStartWavesEnabled"
        class="text-emerald-400"
      >
        Auto-starting next wave…
      </span>

    </div>

  </section>

</template>

