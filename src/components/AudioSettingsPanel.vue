<script setup lang="ts">
import { useAudioStore } from '@/store/audioStore'

const audio = useAudioStore()

function onUnlockClick(): void {
  void audio.unlockFromGesture()
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}
</script>

<template>
  <div class="space-y-4 px-4 py-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold text-slate-200">Audio</h3>
        <p class="text-[10px] text-slate-500">Procedural Web Audio — no downloads</p>
      </div>
      <button
        v-if="!audio.unlocked"
        type="button"
        class="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
        @click="onUnlockClick"
      >
        Enable sound
      </button>
      <span
        v-else
        class="rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-300"
      >
        Active
      </span>
    </div>

    <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
      <input
        type="checkbox"
        class="rounded border-slate-600 bg-slate-800 text-violet-500"
        :checked="audio.muted"
        @change="audio.setMuted(($event.target as HTMLInputElement).checked)"
      />
      Mute all audio
    </label>

    <div class="space-y-3">
      <div>
        <div class="mb-1 flex justify-between text-xs text-slate-400">
          <span>Sound effects</span>
          <span>{{ pct(audio.sfxVolume) }}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          class="h-2 w-full cursor-pointer accent-violet-500"
          :value="Math.round(audio.sfxVolume * 100)"
          :disabled="audio.muted"
          @input="audio.setSfxVolume(Number(($event.target as HTMLInputElement).value) / 100)"
        />
      </div>
      <div>
        <div class="mb-1 flex justify-between text-xs text-slate-400">
          <span>Music</span>
          <span>{{ pct(audio.musicVolume) }}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          class="h-2 w-full cursor-pointer accent-emerald-500"
          :value="Math.round(audio.musicVolume * 100)"
          :disabled="audio.muted"
          @input="audio.setMusicVolume(Number(($event.target as HTMLInputElement).value) / 100)"
        />
      </div>
    </div>

    <p class="text-[10px] leading-relaxed text-slate-500">
      Boss waves use a faster arpeggio. Combat hits, captures, and gold drips are synthesized in real time.
    </p>
  </div>
</template>
