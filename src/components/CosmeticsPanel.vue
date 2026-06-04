<script setup lang="ts">

import { computed } from 'vue'

import { VISUAL_TIER_UNLOCK_TABLE } from '@/engine/aestheticProgression'

import { MUSIC_LAYER_UNLOCK_TABLE } from '@/engine/musicLayers'

import {

  listCosmeticsByCategory,

  type CosmeticCategory,

  type CosmeticDefinition,

} from '@/engine/cosmetics'

import type { AestheticPreferences } from '@/types/game'

import { useGameStore } from '@/store'



const store = useGameStore()



const sections: { id: CosmeticCategory; title: string }[] = [

  { id: 'board', title: 'Board themes' },

  { id: 'pieceSkin', title: 'Piece skins' },

  { id: 'shell', title: 'Backgrounds' },

]



const catalog = computed(() => store.cosmeticWardrobe)

const aesthetic = computed(() => store.aestheticProgress)

const prefs = computed(() => store.aestheticPreferences)



const aestheticToggles: {

  key: keyof AestheticPreferences

  label: string

  hint: string

}[] = [

  {

    key: 'gradualProgression',

    label: 'Gradual progression',

    hint: 'Run-scoped board evolution and aura tiers (resets on prestige).',

  },

  {

    key: 'pieceAuras',

    label: 'Piece auras',

    hint: 'CSS glow on your army — no canvas particles.',

  },

  {

    key: 'boardEvolution',

    label: 'Board evolution',

    hint: 'Square borders deepen as you clear stages this run.',

  },

  {

    key: 'musicLayers',

    label: 'Music layers',

    hint: 'Unlock synth stacks by lifetime best stage (base always on).',

  },

]



function itemsForCategory(category: CosmeticCategory): CosmeticDefinition[] {

  return listCosmeticsByCategory(category)

}



function formatMetric(entry: (typeof catalog.value)[0]): string {

  const p = entry.progress

  if (!p) return 'Unlocked'

  if (entry.unlocked) return 'Unlocked'

  return `${p.current.toLocaleString()} / ${p.target.toLocaleString()}`

}



function onEquip(id: string): void {

  store.equipCosmetic(id)

}



function onTogglePref(key: keyof AestheticPreferences): void {

  store.setAestheticPreference(key, !prefs.value[key])

}

</script>



<template>

  <div class="space-y-4 px-4 py-3">

    <div class="rounded-lg border border-violet-800/50 bg-violet-950/30 px-3 py-2">

      <p class="text-xs font-semibold uppercase tracking-wide text-violet-300">Lifetime stats</p>

      <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-300 sm:grid-cols-4">

        <div>

          <dt class="text-slate-500">Best stage</dt>

          <dd class="font-mono font-medium">{{ store.lifetime.maxStageEverReached }}</dd>

        </div>

        <div>

          <dt class="text-slate-500">Lifetime gold</dt>

          <dd class="font-mono font-medium">

            {{ store.lifetime.lifetimeGoldEarned.toLocaleString() }}

          </dd>

        </div>

        <div>

          <dt class="text-slate-500">Upgrades bought</dt>

          <dd class="font-mono font-medium">{{ store.lifetime.totalUpgradesBought }}</dd>

        </div>

        <div>

          <dt class="text-slate-500">Prestiges</dt>

          <dd class="font-mono font-medium">{{ store.lifetime.totalPrestiges }}</dd>

        </div>

      </dl>

    </div>



    <section class="rounded-lg border border-cyan-900/50 bg-cyan-950/20">

      <h3 class="border-b border-cyan-900/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">

        Gradual progression

      </h3>

      <div class="space-y-3 px-3 py-3">

        <p class="text-[11px] text-slate-400">

          Visual tier

          <span class="font-mono text-cyan-200">{{ aesthetic.visualTier }}</span>

          (run stage {{ store.currentStage }})

          <template v-if="aesthetic.nextVisualTierStage">

            — next tier at stage {{ aesthetic.nextVisualTierStage }}

          </template>

          <span

            v-if="aesthetic.godTierUnlocked"

            class="ml-1 rounded bg-amber-500/20 px-1 text-[10px] text-amber-300"

          >

            God-tier

          </span>

        </p>

        <ul class="grid gap-2 sm:grid-cols-2">

          <li

            v-for="toggle in aestheticToggles"

            :key="toggle.key"

            class="flex items-start justify-between gap-2 rounded border border-slate-800 bg-slate-950/50 px-2 py-2"

          >

            <div>

              <p class="text-xs font-medium text-slate-200">{{ toggle.label }}</p>

              <p class="text-[10px] text-slate-500">{{ toggle.hint }}</p>

            </div>

            <button

              type="button"

              role="switch"

              :aria-checked="prefs[toggle.key]"

              class="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase transition"

              :class="

                prefs[toggle.key]

                  ? 'bg-cyan-600 text-white'

                  : 'bg-slate-800 text-slate-500'

              "

              @click="onTogglePref(toggle.key)"

            >

              {{ prefs[toggle.key] ? 'On' : 'Off' }}

            </button>

          </li>

        </ul>

        <details class="text-[10px] text-slate-500">

          <summary class="cursor-pointer text-slate-400">Visual tier unlock table (S(n)=round(n^1.5))</summary>

          <ul class="mt-1 font-mono">

            <li v-for="row in VISUAL_TIER_UNLOCK_TABLE.slice(0, 8)" :key="row.tier">

              Tier {{ row.tier }} → stage {{ row.stage }}

            </li>

          </ul>

        </details>

      </div>

    </section>



    <section class="rounded-lg border border-indigo-900/50 bg-indigo-950/20">

      <h3 class="border-b border-indigo-900/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-300">

        Music layers

      </h3>

      <ul class="divide-y divide-slate-800/80">

        <li

          v-for="entry in store.musicLayerWardrobe"

          :key="entry.definition.id"

          class="flex items-center justify-between gap-2 px-3 py-2"

        >

          <div>

            <span class="text-xs text-slate-200">{{ entry.definition.label }}</span>

            <p class="text-[10px] text-slate-500">

              Stage {{ entry.definition.stage }}

              <template v-if="entry.definition.prestige > 0">

                · Prestige {{ entry.definition.prestige }}+

              </template>

            </p>

          </div>

          <span

            class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"

            :class="entry.unlocked ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'"

          >

            {{ entry.unlocked ? 'Active' : 'Locked' }}

          </span>

        </li>

      </ul>

      <details class="border-t border-slate-800/80 px-3 py-2 text-[10px] text-slate-500">

        <summary class="cursor-pointer text-slate-400">Layer milestone table</summary>

        <ul class="mt-1 font-mono">

          <li v-for="row in MUSIC_LAYER_UNLOCK_TABLE" :key="row.layer">

            {{ row.layer }}: stage {{ row.stage }}, prestige {{ row.prestige }}

          </li>

        </ul>

      </details>

    </section>



    <section

      v-for="section in sections"

      :key="section.id"

      class="rounded-lg border border-slate-800 bg-slate-950/40"

    >

      <h3 class="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">

        {{ section.title }}

      </h3>

      <ul class="divide-y divide-slate-800">

        <li

          v-for="entry in catalog.filter((c) => c.definition.category === section.id)"

          :key="entry.definition.id"

          class="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"

        >

          <div class="min-w-0">

            <div class="flex flex-wrap items-center gap-2">

              <span class="text-sm font-medium text-slate-100">{{ entry.definition.name }}</span>

              <span

                v-if="entry.equipped"

                class="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-300"

              >

                Equipped

              </span>

              <span

                v-else-if="entry.unlocked"

                class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] uppercase text-emerald-400"

              >

                Owned

              </span>

              <span

                v-else

                class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-500"

              >

                Locked

              </span>

            </div>

            <p class="text-[11px] text-slate-500">{{ entry.definition.description }}</p>

            <p class="text-[10px] text-slate-600">{{ formatMetric(entry) }}</p>

            <div

              v-if="entry.progress && !entry.unlocked"

              class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"

            >

              <div

                class="h-full rounded-full bg-violet-500 transition-all"

                :style="{ width: `${entry.progress.percent}%` }"

              />

            </div>

          </div>

          <button

            type="button"

            class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition"

            :class="

              entry.equipped

                ? 'cursor-default bg-slate-800 text-slate-500'

                : entry.unlocked

                  ? 'bg-violet-600 text-white hover:bg-violet-500'

                  : 'cursor-not-allowed bg-slate-800/80 text-slate-600'

            "

            :disabled="!entry.unlocked || entry.equipped"

            @click="onEquip(entry.definition.id)"

          >

            {{ entry.equipped ? 'Active' : 'Equip' }}

          </button>

        </li>

      </ul>

      <p

        v-if="itemsForCategory(section.id).length === 0"

        class="px-3 py-4 text-center text-xs text-slate-500"

      >

        No cosmetics in this category.

      </p>

    </section>

  </div>

</template>

