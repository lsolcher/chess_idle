<script setup lang="ts">
import { ref } from 'vue'
import ChessBoard from '@/components/ChessBoard.vue'
import WaveControls from '@/components/WaveControls.vue'
import TurnOrderPanel from '@/components/TurnOrderPanel.vue'
import RoyalDecreeBanner from '@/components/RoyalDecreeBanner.vue'
import UpgradePanel from '@/components/UpgradePanel.vue'
import CombatFooter from '@/components/layout/CombatFooter.vue'
import StatsHeader from '@/components/layout/StatsHeader.vue'
import PromotionModal from '@/components/PromotionModal.vue'
import WaveOutcomeModal from '@/components/WaveOutcomeModal.vue'
import DevModePanel from '@/components/dev/DevModePanel.vue'
import OnboardingTelegraph from '@/components/OnboardingTelegraph.vue'
import { useCombatLoop } from '@/composables/useCombatLoop'
import { useDevModeHotkeys } from '@/composables/useDevModeHotkeys'
import { useGameAudio } from '@/composables/useGameAudio'
import { useGameStore } from '@/store'

type MainTab = 'battle' | 'upgrades'

const store = useGameStore()
useCombatLoop()
useGameAudio()
useDevModeHotkeys()

const activeTab = ref<MainTab>('battle')

const tabs: { id: MainTab; label: string }[] = [
  { id: 'battle', label: 'Battle' },
  { id: 'upgrades', label: 'Upgrades' },
]
</script>

<template>
  <div
    class="fantasy-tactical relative flex min-h-screen flex-col overflow-x-hidden text-slate-100 transition-colors duration-500"
    :class="[
      store.shellThemeClass,
      store.permanentShellAccentClasses,
      store.shellAtmosphereClass,
      store.isScreenShaking ? 'combat-shake' : '',
      store.isBoardZoomActive ? 'combat-shell-zoom' : '',
    ]"
  >
    <!-- Parallax / atmosphere backdrop (lifetime stage + music layers) -->
    <div
      class="shell-parallax pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    >
      <div
        v-if="store.victoryBackgroundOverlayClass"
        class="shell-parallax-layer"
        :class="store.victoryBackgroundOverlayClass"
        aria-hidden="true"
      />
      <div class="shell-parallax-layer shell-parallax-stars" />
      <div class="shell-parallax-layer shell-parallax-mist" />
      <div
        v-if="store.showMusicLightShafts"
        class="shell-parallax-layer shell-light-shafts"
      />
      <div
        v-if="store.showMusicParticles"
        class="shell-parallax-layer shell-music-particles"
      />
    </div>

    <div class="relative z-10 flex min-h-screen flex-col">
      <StatsHeader />

      <div class="mx-auto w-full max-w-6xl flex-1 px-3 py-3 sm:px-4 sm:py-4">
        <nav
          class="mb-4 flex rounded-lg border border-slate-800 bg-slate-900/80 p-1 backdrop-blur-sm"
          role="tablist"
          aria-label="Main sections"
        >
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            class="btn-juice flex-1 rounded-md px-3 py-2 text-sm font-medium transition"
            :class="
              activeTab === tab.id
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            "
            :aria-selected="activeTab === tab.id"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </nav>

        <div
          v-show="activeTab === 'battle'"
          class="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
          role="tabpanel"
        >
          <div class="space-y-4">
            <WaveControls />
            <RoyalDecreeBanner />
            <ChessBoard />
          </div>
          <TurnOrderPanel />
        </div>

        <div v-show="activeTab === 'upgrades'" role="tabpanel">
          <UpgradePanel />
        </div>
      </div>

      <CombatFooter />
      <PromotionModal />
      <WaveOutcomeModal />
      <OnboardingTelegraph />
      <DevModePanel />
    </div>
  </div>
</template>
