<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/store'
import type { SuperPromotionForm } from '@/types/game'

const store = useGameStore()

const visible = computed(() => store.pendingPromotion !== null)
const forms = computed((): SuperPromotionForm[] => store.pendingPromotion?.availableForms ?? [])

function metaFor(form: SuperPromotionForm) {
  return formMeta[form]
}

const formMeta: Record<
  SuperPromotionForm,
  { label: string; glyph: string; blurb: string }
> = {
  'super-knight': { label: 'Super Knight', glyph: '♘', blurb: '2.5× AP · back-rank hunter' },
  'super-bishop': { label: 'Super Bishop', glyph: '♗', blurb: '2.2× AP · pierce splash' },
  'super-rook': { label: 'Super Rook', glyph: '♖', blurb: '2.8× AP · line slam' },
  'super-queen': { label: 'Super Queen', glyph: '♛', blurb: '3.5× AP · burst carry' },
}

function onChoose(form: SuperPromotionForm): void {
  store.choosePromotionForm(form)
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
    role="dialog"
    aria-modal="true"
    aria-labelledby="promotion-title"
  >
    <div
      class="w-full max-w-md rounded-xl border border-amber-500/30 bg-slate-900 p-4 shadow-2xl"
    >
      <h2 id="promotion-title" class="text-lg font-bold text-amber-200">Pawn Promotion!</h2>
      <p class="mt-1 text-sm text-slate-400">
        Choose a super-form for this stage. Lasts until stage clear or death.
      </p>

      <ul class="mt-4 grid gap-2">
        <li v-for="form in forms" :key="form">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-3 text-left transition hover:border-amber-500/50 hover:bg-slate-800"
            @click="onChoose(form)"
          >
            <span class="text-2xl">{{ metaFor(form).glyph }}</span>
            <span>
              <span class="block text-sm font-semibold text-slate-100">
                {{ metaFor(form).label }}
              </span>
              <span class="block text-xs text-slate-500">{{ metaFor(form).blurb }}</span>
            </span>
          </button>
        </li>
      </ul>

      <p class="mt-3 text-center text-xs text-amber-400/80">
        Promotion Fanfare: 3× capture gold · Streak +5% stage income
      </p>
    </div>
  </div>
</template>
