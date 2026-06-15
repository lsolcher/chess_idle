<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ONBOARDING_ROOK_ID } from '@/engine/onboardingTelegraph'
import { t } from '@/i18n'
import { useGameStore } from '@/store'

const store = useGameStore()

/** Modal dismissed after Arm Move so the board stays clickable. */
const moveArmed = ref(false)

watch(
  () => store.showOnboardingTelegraph,
  (show) => {
    if (!show) moveArmed.value = false
  },
)

const showModal = computed(() => store.showOnboardingTelegraph && !moveArmed.value)
const showArmedHint = computed(() => store.showOnboardingTelegraph && moveArmed.value)

const primaryTelegraphed = computed(() =>
  store.enemyIntentTimeline.find((e) => e.pieceId === ONBOARDING_ROOK_ID),
)

function onArmMove(): void {
  if (store.armOnboardingMove()) {
    moveArmed.value = true
  }
}
</script>

<template>
  <div
    v-if="showModal"
    class="onboarding-telegraph fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
    role="dialog"
    :aria-label="t('onboarding.title')"
  >
    <div class="stone-panel max-w-md p-4 shadow-2xl">
      <h2 class="fantasy-heading text-base font-semibold text-amber-200">
        {{ t('onboarding.title') }}
      </h2>
      <p class="mt-2 text-sm text-slate-200">
        {{ t('onboarding.body') }}
      </p>
      <p class="mt-3 text-xs text-amber-100/90">
        {{ t('onboarding.intentHint') }}
      </p>
      <ul
        v-if="primaryTelegraphed"
        class="mt-3 rounded border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-100"
      >
        <li>
          {{ t('onboarding.telegraphedRook', { eta: primaryTelegraphed.isReady ? t('intentRibbon.now') : '…' }) }}
        </li>
      </ul>
      <p class="mt-3 text-xs text-slate-400">
        {{ t('onboarding.actionHint') }}
      </p>
      <button
        type="button"
        class="btn-juice mt-4 w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        @click="onArmMove"
      >
        {{ t('onboarding.armMove') }}
      </button>
    </div>
  </div>

  <p
    v-if="showArmedHint"
    class="pointer-events-none fixed bottom-24 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-lg border border-sky-500/50 bg-sky-950/90 px-4 py-2 text-center text-xs text-sky-100 shadow-lg"
    role="status"
  >
    {{ t('onboarding.armedHint') }}
  </p>
</template>
