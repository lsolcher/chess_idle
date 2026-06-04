<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/store'

const store = useGameStore()
const visible = computed(() => store.isRoyalDecreeActive)
</script>

<template>
  <div
    v-if="visible"
    class="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
    role="status"
    aria-live="polite"
  >
    <span class="text-lg leading-none" aria-hidden="true">♔</span>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold text-amber-200">Royal Decree Active</p>
      <p class="text-xs text-amber-200/70">
        2× strikes · 2× capture gold · double stamina regen
      </p>
    </div>
    <span
      class="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400"
      aria-hidden="true"
    />
  </div>
</template>
