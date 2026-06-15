<script setup lang="ts">
import { computed } from 'vue'
import { isViteDevBuild } from '@/config/devMode'
import type { DevCheatId } from '@/engine/devCheats'
import { t } from '@/i18n'
import { useDevStore } from '@/store/devStore'
import { useGameStore } from '@/store'

const dev = useDevStore()
const game = useGameStore()

const showPanel = computed(() => dev.enabled && dev.panelOpen)

const cheatButtons: { id: DevCheatId; labelKey: string }[] = [
  { id: 'addGold10k', labelKey: 'devMode.cheats.addGold10k' },
  { id: 'addGold100k', labelKey: 'devMode.cheats.addGold100k' },
  { id: 'addElo100', labelKey: 'devMode.cheats.addElo100' },
  { id: 'healArmy', labelKey: 'devMode.cheats.healArmy' },
  { id: 'refillStamina', labelKey: 'devMode.cheats.refillStamina' },
  { id: 'maxUpgrades', labelKey: 'devMode.cheats.maxUpgrades' },
  { id: 'maxClickPower', labelKey: 'devMode.cheats.maxClickPower' },
  { id: 'unlockRoster', labelKey: 'devMode.cheats.unlockRoster' },
  { id: 'advanceStage', labelKey: 'devMode.cheats.advanceStage' },
  { id: 'completeWave', labelKey: 'devMode.cheats.completeWave' },
  { id: 'enterPrep', labelKey: 'devMode.cheats.enterPrep' },
  { id: 'startWave', labelKey: 'devMode.cheats.startWave' },
]

function runCheat(id: DevCheatId): void {
  dev.runCheat(id)
}
</script>

<template>
  <div
    v-if="showPanel"
    class="dev-mode-panel stone-panel fixed bottom-4 right-4 z-50 w-[min(100vw-1.5rem,22rem)] max-h-[min(70vh,32rem)] overflow-y-auto p-3 shadow-2xl"
    role="dialog"
    :aria-label="t('devMode.title')"
  >
    <header class="mb-3 flex items-start justify-between gap-2">
      <div>
        <h2 class="text-sm font-semibold text-amber-200">{{ t('devMode.title') }}</h2>
        <p class="mt-0.5 text-xs text-slate-400">{{ t('devMode.hint') }}</p>
        <p v-if="!isViteDevBuild()" class="mt-1 text-xs text-amber-400/90">
          {{ t('devMode.prodWarning') }}
        </p>
      </div>
      <button
        type="button"
        class="btn-juice rounded px-2 py-1 text-xs text-slate-300 hover:text-white"
        :aria-label="t('devMode.close')"
        @click="dev.panelOpen = false"
      >
        ✕
      </button>
    </header>

    <p class="mb-2 text-xs text-slate-400">
      {{ t('devMode.status', { stage: game.currentStage, phase: game.wavePhase }) }}
    </p>

    <label class="mb-3 flex flex-col gap-1 text-xs text-slate-300">
      {{ t('devMode.godMode') }}
      <button
        type="button"
        class="btn-juice rounded border px-2 py-1.5 text-left text-sm transition"
        :class="
          dev.godMode
            ? 'border-amber-500/60 bg-amber-900/40 text-amber-100'
            : 'border-slate-700 bg-slate-800/80 text-slate-300'
        "
        @click="dev.toggleGodMode()"
      >
        {{ dev.godMode ? t('devMode.godModeOn') : t('devMode.godModeOff') }}
      </button>
    </label>

    <div class="mb-3 flex gap-2">
      <label class="flex flex-1 flex-col gap-1 text-xs text-slate-300">
        {{ t('devMode.jumpStage') }}
        <input
          v-model.number="dev.stageInput"
          type="number"
          min="1"
          max="999"
          class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
          @change="dev.setStageInput(dev.stageInput)"
        />
      </label>
      <button
        type="button"
        class="btn-juice mt-5 self-end rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600"
        @click="dev.jumpToStageInput()"
      >
        {{ t('devMode.jump') }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-1.5">
      <button
        v-for="cheat in cheatButtons"
        :key="cheat.id"
        type="button"
        class="btn-juice rounded border border-slate-700/80 bg-slate-800/90 px-2 py-1.5 text-left text-xs text-slate-200 hover:border-amber-600/40 hover:text-amber-50"
        @click="runCheat(cheat.id)"
      >
        {{ t(cheat.labelKey) }}
      </button>
    </div>

    <footer class="mt-3 border-t border-slate-700/80 pt-2">
      <button
        type="button"
        class="btn-juice w-full rounded px-2 py-1 text-xs text-slate-400 hover:text-red-300"
        @click="dev.disableDevMode()"
      >
        {{ t('devMode.disable') }}
      </button>
    </footer>
  </div>
</template>
