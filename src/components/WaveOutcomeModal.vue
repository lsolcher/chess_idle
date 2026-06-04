<script setup lang="ts">
import { computed } from 'vue'
import { totalWaveGold, type WaveOutcomeReport } from '@/engine/waveOutcome'
import { t } from '@/i18n'
import { useGameStore } from '@/store'
import { useMetaStore } from '@/store/metaStore'

const store = useGameStore()
const meta = useMetaStore()

const showAdvancedLog = computed(() => meta.hasAdvancedCombatLog)

const report = computed((): WaveOutcomeReport | null => store.waveOutcomeReport)

const visible = computed(() => report.value !== null)

const title = computed(() => {
  const r = report.value
  if (!r) return ''
  if (r.kind === 'victory') return t('waveOutcome.victoryTitle')
  if (r.kind === 'defeat') return t('waveOutcome.defeatTitle')
  return t('waveOutcome.prepTitle')
})

const subtitle = computed(() => {
  const r = report.value
  if (!r) return ''
  if (r.kind === 'victory' || r.kind === 'prep') {
    return `${t('waveOutcome.stageCleared', { stage: r.foughtStage })} · ${t('waveOutcome.nextPhase', { stage: r.nextStage })}`
  }
  return t('waveOutcome.stageFailed', { stage: r.foughtStage })
})

const goldTotal = computed(() => (report.value ? totalWaveGold(report.value.stats) : 0))

const advancedMetrics = computed(() => {
  const r = report.value
  if (!r || r.stats.friendlyActions <= 0) return null
  const actions = r.stats.friendlyActions
  return {
    goldPerAction: totalWaveGold(r.stats) / actions,
    damagePerAction: r.stats.damageDealt / actions,
    captureRate: (r.stats.captures / actions) * 100,
  }
})

const themeClass = computed(() => {
  const kind = report.value?.kind
  if (kind === 'victory' || kind === 'prep') {
    return 'border-emerald-500/40 bg-gradient-to-b from-emerald-950/90 to-slate-900'
  }
  return 'border-rose-500/40 bg-gradient-to-b from-rose-950/90 to-slate-900'
})

function formatNum(n: number): string {
  return Math.round(n).toLocaleString()
}

function onPrimary(): void {
  store.dismissWaveOutcome()
}

function onStartWave(): void {
  store.dismissWaveOutcome()
  store.startWave()
}
</script>

<template>
  <div
    v-if="visible && report"
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="'wave-outcome-title'"
  >
    <div
      class="flex w-full max-w-md flex-col gap-4 rounded-2xl border p-5 shadow-2xl"
      :class="themeClass"
    >
      <header class="text-center">
        <p
          class="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400"
        >
          {{ t('waveOutcome.statsHeading') }}
        </p>
        <h2
          id="wave-outcome-title"
          class="mt-1 text-xl font-bold"
          :class="report.kind === 'defeat' ? 'text-rose-200' : 'text-emerald-200'"
        >
          {{ title }}
        </h2>
        <p class="mt-1 text-sm text-slate-300">{{ subtitle }}</p>
        <p
          v-if="report.kind === 'defeat' && report.kingFallTelegraph"
          class="mt-2 text-xs text-rose-100/90"
        >
          {{ report.kingFallTelegraph }}
        </p>
        <p
          v-if="report.kind === 'defeat' && report.kingFallMessage"
          class="mt-1 text-[11px] text-slate-400"
        >
          {{ report.kingFallMessage }}
        </p>
      </header>

      <dl
        class="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-3 text-sm"
      >
        <div class="col-span-2 flex items-baseline justify-between border-b border-slate-700/50 pb-2">
          <dt class="font-medium text-amber-200">{{ t('waveOutcome.goldTotal') }}</dt>
          <dd class="text-lg font-bold tabular-nums text-amber-100">
            +{{ formatNum(goldTotal) }} G
          </dd>
        </div>

        <template v-if="report.stats.goldFromClear > 0">
          <dt class="text-slate-500">{{ t('waveOutcome.goldClear') }}</dt>
          <dd class="tabular-nums text-slate-200">+{{ formatNum(report.stats.goldFromClear) }}</dd>
        </template>
        <template v-if="report.stats.goldFromCaptures > 0">
          <dt class="text-slate-500">{{ t('waveOutcome.goldCaptures') }}</dt>
          <dd class="tabular-nums text-slate-200">
            +{{ formatNum(report.stats.goldFromCaptures) }}
          </dd>
        </template>
        <template v-if="report.stats.goldFromActions > 0">
          <dt class="text-slate-500">{{ t('waveOutcome.goldActions') }}</dt>
          <dd class="tabular-nums text-slate-200">
            +{{ formatNum(report.stats.goldFromActions) }}
          </dd>
        </template>
        <template v-if="report.stats.goldFromPromotion > 0">
          <dt class="text-slate-500">{{ t('waveOutcome.goldPromotion') }}</dt>
          <dd class="tabular-nums text-slate-200">
            +{{ formatNum(report.stats.goldFromPromotion) }}
          </dd>
        </template>

        <dt class="text-slate-500">{{ t('waveOutcome.damageDealt') }}</dt>
        <dd class="tabular-nums text-emerald-300">{{ formatNum(report.stats.damageDealt) }}</dd>

        <dt class="text-slate-500">{{ t('waveOutcome.damageTaken') }}</dt>
        <dd class="tabular-nums text-rose-300">{{ formatNum(report.stats.damageTaken) }}</dd>

        <dt class="text-slate-500">{{ t('waveOutcome.captures') }}</dt>
        <dd class="tabular-nums text-slate-200">{{ report.stats.captures }}</dd>

        <dt class="text-slate-500">{{ t('waveOutcome.actions') }}</dt>
        <dd class="tabular-nums text-slate-200">{{ report.stats.friendlyActions }}</dd>
      </dl>

      <dl
        v-if="showAdvancedLog && advancedMetrics"
        class="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/30 px-3 py-3 text-xs"
      >
        <dt class="col-span-2 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-300/90">
          {{ t('supporterStore.advancedLogHeading') }}
        </dt>
        <dt class="text-slate-500">{{ t('supporterStore.goldPerAction') }}</dt>
        <dd class="tabular-nums text-amber-200">
          {{ advancedMetrics.goldPerAction.toFixed(1) }} G
        </dd>
        <dt class="text-slate-500">{{ t('supporterStore.damagePerAction') }}</dt>
        <dd class="tabular-nums text-emerald-300">
          {{ advancedMetrics.damagePerAction.toFixed(1) }}
        </dd>
        <dt class="text-slate-500">{{ t('supporterStore.captureRate') }}</dt>
        <dd class="tabular-nums text-slate-200">
          {{ advancedMetrics.captureRate.toFixed(1) }}%
        </dd>
      </dl>

      <p
        v-if="report.trophyName"
        class="text-center text-xs font-semibold text-amber-300"
      >
        {{ t('waveOutcome.trophy', { name: report.trophyName }) }}
      </p>

      <p
        v-if="report.kind === 'defeat' && report.failRewindToStage !== null"
        class="text-center text-xs text-amber-400/90"
      >
        {{ t('waveOutcome.failRewind', { stage: report.failRewindToStage }) }}
      </p>
      <p
        v-else-if="report.kind === 'defeat' && report.failCountThisStage > 0"
        class="text-center text-xs text-amber-400/90"
      >
        {{
          t('waveOutcome.failSoft', {
            pct: Math.round(report.enemyHpScale * 100),
            count: report.failCountThisStage,
          })
        }}
      </p>

      <p class="text-center text-[10px] text-slate-500">
        {{ t('waveOutcome.checkpoint', { stage: report.checkpointStage }) }}
      </p>

      <div class="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          class="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow transition"
          :class="
            report.kind === 'defeat'
              ? 'bg-rose-600 hover:bg-rose-500'
              : 'bg-emerald-600 hover:bg-emerald-500'
          "
          @click="onPrimary"
        >
          {{ t('waveOutcome.continuePrep') }}
        </button>
        <button
          v-if="report.kind === 'victory' && store.canStartWave"
          type="button"
          class="flex-1 rounded-lg border border-emerald-600/50 bg-slate-950/80 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-slate-800"
          @click="onStartWave"
        >
          {{ t('waveOutcome.startNextWave') }}
        </button>
      </div>
    </div>
  </div>
</template>
