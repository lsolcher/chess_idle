<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ChessBoard, { type ChessBoardArenaBinding } from '@/components/ChessBoard.vue'
import {
  calculateLoadoutPointTotal,
  canSaveArenaLoadout,
  deployPieceAt,
  deployedHasKing,
  findArenaDeploySquare,
  initialArenaDeployedFromRoster,
  listArenaDeployTargetKeys,
  mergeDeployedWithRoster,
  removeDeployedPiece,
} from '@/engine/arenaLoadout'
import { calculatePvPValue } from '@/engine/pvpMath'
import { t } from '@/i18n'
import { useGameStore } from '@/store'
import { useAudioStore } from '@/store/audioStore'
import type { ChessPiece } from '@/types/game'

const store = useGameStore()
const audio = useAudioStore()

const deployed = ref<ChessPiece[]>(initialArenaDeployedFromRoster(store.unlockedPieces))
const selectedRosterId = ref<string | null>(null)
const saveStatus = ref('')

const roster = computed(() => store.unlockedPieces)

const armyPointTotal = computed(() => calculateLoadoutPointTotal(deployed.value))
const pointCap = computed(() => store.arenaPointCap)
const overBudget = computed(() => armyPointTotal.value > pointCap.value)
const missingKing = computed(() => !deployedHasKing(deployed.value))
const canSave = computed(() => canSaveArenaLoadout(deployed.value, pointCap.value))

const deployTargetKeys = computed(() =>
  selectedRosterId.value ? listArenaDeployTargetKeys(deployed.value) : [],
)

const arenaBinding = computed((): ChessBoardArenaBinding => ({
  pieces: deployed.value,
  selectedPieceId: selectedRosterId.value,
  deployTargetKeys: deployTargetKeys.value,
  hint: boardHint.value,
  compact: true,
  readonly: true,
}))

const boardHint = computed(() => {
  if (!selectedRosterId.value) return t('arenaLoadout.boardIdle')
  return t('arenaLoadout.boardDeploy')
})

function isDeployed(pieceId: string): boolean {
  return deployed.value.some((piece) => piece.id === pieceId)
}

function piecePointCost(piece: ChessPiece): number {
  return calculatePvPValue(piece)
}

function selectForDeploy(pieceId: string): void {
  if (isDeployed(pieceId)) return
  selectedRosterId.value = pieceId
  void audio.unlockFromGesture()
  audio.playSfx('uiClick')
}

function deployRosterPiece(piece: ChessPiece): void {
  const square = findArenaDeploySquare(deployed.value, piece.kind)
  if (!square) return
  const next = deployPieceAt(deployed.value, piece, square)
  if (next) {
    deployed.value = next
    selectedRosterId.value = null
    audio.playSfx('uiClick')
  }
}

function removeFromBoard(pieceId: string): void {
  deployed.value = removeDeployedPiece(deployed.value, pieceId)
  if (selectedRosterId.value === pieceId) {
    selectedRosterId.value = null
  }
  audio.playSfx('uiClick')
}

function onArenaCellClick(file: number, rank: number): void {
  if (!selectedRosterId.value) return
  const piece = roster.value.find((entry) => entry.id === selectedRosterId.value)
  if (!piece) return

  const next = deployPieceAt(deployed.value, piece, { file, rank })
  if (next) {
    deployed.value = next
    selectedRosterId.value = null
    audio.playSfx('uiClick')
  }
}

function onSaveLoadout(): void {
  const id = store.saveArenaLoadout(deployed.value)
  if (!id) {
    saveStatus.value = t('arenaLoadout.saveInvalid')
    return
  }
  saveStatus.value = t('arenaLoadout.saveSuccess', { id })
  audio.playSfx('capture')
}

watch(
  roster,
  (nextRoster) => {
    deployed.value = mergeDeployedWithRoster(deployed.value, nextRoster)
  },
  { deep: true },
)
</script>

<template>
  <div class="space-y-4 px-3 py-4 sm:px-4">
    <header
      class="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/70 to-slate-900/90 p-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold uppercase tracking-widest text-cyan-300">
            {{ t('arenaLoadout.title') }}
          </h2>
          <p class="mt-1 text-xs text-slate-400">{{ t('arenaLoadout.subtitle') }}</p>
        </div>
        <div class="text-right">
          <p class="text-[10px] uppercase tracking-wide text-slate-500">
            {{ t('arenaLoadout.pointBudget') }}
          </p>
          <p
            class="font-mono text-lg font-semibold"
            :class="overBudget ? 'text-rose-400' : 'text-cyan-200'"
          >
            {{ t('arenaLoadout.pointLine', { total: armyPointTotal, cap: pointCap }) }}
          </p>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap gap-2 text-[10px]">
        <span
          v-if="missingKing"
          class="rounded bg-rose-500/15 px-2 py-1 text-rose-300"
        >
          {{ t('arenaLoadout.kingRequired') }}
        </span>
        <span
          v-if="overBudget"
          class="rounded bg-rose-500/15 px-2 py-1 text-rose-300"
        >
          {{ t('arenaLoadout.overCap') }}
        </span>
        <span class="rounded bg-slate-800 px-2 py-1 text-slate-400">
          {{ t('arenaLoadout.deployedCount', { count: deployed.length }) }}
        </span>
      </div>
    </header>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div class="min-w-0">
        <ChessBoard :arena="arenaBinding" @arena-cell-click="onArenaCellClick" />
      </div>

      <aside class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {{ t('arenaLoadout.rosterTitle') }}
        </h3>
        <p class="mb-3 text-xs text-slate-500">{{ t('arenaLoadout.rosterHint') }}</p>

        <ul
          class="max-h-[min(50vh,420px)] space-y-2 overflow-y-auto pr-1"
          role="list"
        >
          <li
            v-for="piece in roster"
            :key="piece.id"
            class="flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            :class="
              isDeployed(piece.id)
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : selectedRosterId === piece.id
                  ? 'border-cyan-500/50 bg-cyan-500/10'
                  : 'border-slate-800 bg-slate-900/40'
            "
          >
            <div class="min-w-0">
              <span class="text-sm font-medium capitalize text-slate-100">
                {{ piece.kind }}
              </span>
              <p class="font-mono text-xs text-cyan-300/90">
                {{ piecePointCost(piece) }} PC
              </p>
              <p v-if="isDeployed(piece.id)" class="text-[10px] text-emerald-400/90">
                {{ t('arenaLoadout.onBoard') }}
              </p>
            </div>

            <div class="flex shrink-0 gap-2">
              <button
                v-if="!isDeployed(piece.id)"
                type="button"
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                :class="
                  selectedRosterId === piece.id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
                "
                @click="selectForDeploy(piece.id)"
              >
                {{ t('arenaLoadout.deploy') }}
              </button>
              <button
                v-if="!isDeployed(piece.id)"
                type="button"
                class="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                @click="deployRosterPiece(piece)"
              >
                {{ t('arenaLoadout.autoPlace') }}
              </button>
              <button
                v-else
                type="button"
                class="rounded-lg bg-rose-900/60 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-800/80"
                @click="removeFromBoard(piece.id)"
              >
                {{ t('arenaLoadout.remove') }}
              </button>
            </div>
          </li>
        </ul>

        <div class="mt-4 border-t border-slate-800 pt-4">
          <button
            type="button"
            class="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            :class="
              canSave
                ? 'bg-cyan-600 text-white hover:bg-cyan-500'
                : 'bg-slate-800 text-slate-500'
            "
            :disabled="!canSave"
            @click="onSaveLoadout"
          >
            {{ t('arenaLoadout.save') }}
          </button>
          <p v-if="saveStatus" class="mt-2 text-center text-xs text-emerald-300/90">
            {{ saveStatus }}
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>
