<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import ChessBoard, { type ChessBoardDojoBinding } from '@/components/ChessBoard.vue'
import {
  applyDojoMove,
  enumerateMovesForSide,
  type Board,
  type DojoDifficulty,
} from '@/engine/chessDojo'
import { checkDojoOutcome, createTrainingBoard } from '@/engine/dojoSession'
import { DOJO_SKILL_REWARD } from '@/store/metaStore'
import type { BoardMove } from '@/engine/moves'
import { t } from '@/i18n'
import { useGameStore } from '@/store'
import { useMetaStore } from '@/store/metaStore'
import { useAudioStore } from '@/store/audioStore'

const game = useGameStore()
const meta = useMetaStore()
const audio = useAudioStore()

const difficulties: DojoDifficulty[] = ['easy', 'medium', 'hard']
const difficulty = ref<DojoDifficulty>('medium')

const board = ref<Board>(createTrainingBoard())
const selectedPieceId = ref<string | null>(null)
const matchActive = ref(true)
const statusMessage = ref('')
const lastReward = ref<number | null>(null)
const aiThinking = ref(false)

const playerLegalMoves = computed((): BoardMove[] => {
  if (!matchActive.value || board.value.sideToMove !== 'player') return []
  return enumerateMovesForSide(board.value, 'player').map((entry) => entry.move)
})

const dojoBinding = computed((): ChessBoardDojoBinding => ({
  pieces: board.value.pieces,
  legalMoves: playerLegalMoves.value,
  selectedPieceId: selectedPieceId.value,
  sideToMove: board.value.sideToMove,
  hint: statusHint.value,
  compact: true,
}))

const statusHint = computed(() => {
  if (!matchActive.value) return statusMessage.value
  if (aiThinking.value) return t('chessDojo.aiThinking')
  if (board.value.sideToMove !== 'player') return t('chessDojo.aiTurn')
  if (selectedPieceId.value) return t('chessDojo.selectTarget')
  return t('chessDojo.yourTurn')
})

const rewardPreview = computed(() => {
  let base = DOJO_SKILL_REWARD[difficulty.value]
  if (difficulty.value === 'easy') {
    base = Math.floor(base * (1 + 0.1 * (meta.dojoUpgrades.openingRepertoire ?? 0)))
  }
  if (difficulty.value === 'medium') {
    base = Math.floor(base * (1 + 0.1 * (meta.dojoUpgrades.endgamePrecision ?? 0)))
  }
  return base
})

const upgradeOffers = computed(() => meta.dojoUpgradeOffers)

function resetMatch(): void {
  board.value = createTrainingBoard()
  selectedPieceId.value = null
  matchActive.value = true
  statusMessage.value = ''
  lastReward.value = null
  aiThinking.value = false
}

function onDifficultyChange(next: DojoDifficulty): void {
  difficulty.value = next
  resetMatch()
  void audio.unlockFromGesture()
  audio.playSfx('uiClick')
}

function handleOutcome(outcome: 'player-win' | 'ai-win'): void {
  matchActive.value = false
  selectedPieceId.value = null
  if (outcome === 'player-win') {
    const granted = meta.dojoVictory(difficulty.value)
    lastReward.value = granted
    statusMessage.value = t('chessDojo.victory', { points: granted })
    audio.playSfx('capture')
  } else {
    lastReward.value = null
    statusMessage.value = t('chessDojo.defeat')
    audio.playSfx('chip')
  }
}

async function runAiTurn(): Promise<void> {
  if (!matchActive.value || board.value.sideToMove !== 'enemy') return
  aiThinking.value = true
  await nextTick()

  const move = meta.getDojoAiMove(board.value, difficulty.value)
  aiThinking.value = false

  if (!move) {
    statusMessage.value = t('chessDojo.stalemate')
    matchActive.value = false
    return
  }

  board.value = applyDojoMove(board.value, move)
  const outcome = checkDojoOutcome(board.value)
  if (outcome) {
    handleOutcome(outcome)
    return
  }

  if (board.value.sideToMove === 'enemy') {
    await runAiTurn()
  }
}

function onDojoCellClick(file: number, rank: number): void {
  if (!matchActive.value || board.value.sideToMove !== 'player' || aiThinking.value) return

  const piece = board.value.pieces.find(
    (entry) => entry.position.file === file && entry.position.rank === rank,
  )
  const move = playerLegalMoves.value.find(
    (entry) => entry.to.file === file && entry.to.rank === rank,
  )

  if (move && selectedPieceId.value) {
    board.value = applyDojoMove(board.value, move)
    selectedPieceId.value = null

    const outcome = checkDojoOutcome(board.value)
    if (outcome) {
      handleOutcome(outcome)
      return
    }

    void runAiTurn()
    return
  }

  if (piece?.side === 'player') {
    const hasMoves = playerLegalMoves.value.some((entry) => entry.pieceId === piece.id)
    if (hasMoves) {
      selectedPieceId.value = piece.id
      void audio.unlockFromGesture()
      audio.playSfx('uiClick')
    }
    return
  }

  selectedPieceId.value = null
}

function onPurchase(id: Parameters<typeof meta.purchaseDojoUpgrade>[0]): void {
  if (meta.purchaseDojoUpgrade(id)) {
    void audio.unlockFromGesture()
    audio.playSfx('uiClick')
  }
}

function upgradeLabel(id: string): string {
  return t(`chessDojo.upgrades.${id}.label`)
}

function upgradeEffect(id: string): string {
  return t(`chessDojo.upgrades.${id}.effect`)
}

watch(difficulty, () => {
  selectedPieceId.value = null
})
</script>

<template>
  <div class="space-y-4 px-3 py-4 sm:px-4">
    <header
      class="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/80 to-slate-900/90 p-4"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold uppercase tracking-widest text-indigo-300">
            {{ t('chessDojo.title') }}
          </h2>
          <p class="mt-1 text-xs text-slate-400">{{ t('chessDojo.subtitle') }}</p>
        </div>
        <div class="flex flex-wrap gap-2 text-xs font-mono">
          <span
            class="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-amber-200"
          >
            {{ t('chessDojo.skillPoints') }}: {{ meta.skillPoints }}
          </span>
          <span
            class="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-violet-200"
          >
            {{ t('chessDojo.elo') }}: {{ game.eloShards }}
          </span>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {{ t('chessDojo.difficulty') }}
        </span>
        <button
          v-for="tier in difficulties"
          :key="tier"
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition"
          :class="
            difficulty === tier
              ? 'bg-indigo-600 text-white ring-2 ring-indigo-300/60'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          "
          @click="onDifficultyChange(tier)"
        >
          {{ t(`chessDojo.difficulty_${tier}`) }}
          <span class="ml-1 text-[10px] opacity-70">+{{ DOJO_SKILL_REWARD[tier] }} SP</span>
        </button>
      </div>

      <p class="mt-2 text-[10px] text-slate-500">
        {{ t('chessDojo.winRewardPreview', { points: rewardPreview }) }}
        · {{ t('chessDojo.trainingRecord', { total: meta.totalDojoVictories }) }}
      </p>
    </header>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div class="min-w-0">
        <ChessBoard :dojo="dojoBinding" @dojo-cell-click="onDojoCellClick" />

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-600"
            @click="resetMatch"
          >
            {{ t('chessDojo.newMatch') }}
          </button>
          <p
            v-if="statusMessage"
            class="text-xs"
            :class="matchActive ? 'text-slate-400' : 'text-emerald-300'"
          >
            {{ statusMessage }}
          </p>
        </div>
      </div>

      <aside
        class="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        aria-labelledby="dojo-shop-heading"
      >
        <h3
          id="dojo-shop-heading"
          class="text-sm font-semibold uppercase tracking-wide text-slate-400"
        >
          {{ t('chessDojo.shopTitle') }}
        </h3>
        <p class="mb-3 text-xs text-slate-500">{{ t('chessDojo.shopHint') }}</p>

        <ul class="divide-y divide-slate-800">
          <li
            v-for="offer in upgradeOffers"
            :key="offer.id"
            class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            :class="offer.affordable ? 'rounded-lg bg-indigo-500/5 px-2 -mx-2' : ''"
          >
            <div class="min-w-0">
              <span class="text-sm font-medium text-slate-100">{{ upgradeLabel(offer.id) }}</span>
              <p class="text-xs text-slate-500">{{ upgradeEffect(offer.id) }}</p>
              <p class="text-[10px] text-slate-600">
                {{ t('chessDojo.rank', { rank: offer.rank, max: offer.maxRank }) }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-[0.98]"
              :class="
                offer.maxed
                  ? 'cursor-default bg-slate-800/80 text-slate-500'
                  : offer.affordable
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                    : 'cursor-not-allowed bg-slate-800 text-slate-500'
              "
              :disabled="offer.maxed || !offer.affordable"
              @click="onPurchase(offer.id)"
            >
              <template v-if="offer.maxed">{{ t('chessDojo.maxed') }}</template>
              <template v-else>{{ offer.nextCost }} {{ t('chessDojo.sp') }}</template>
            </button>
          </li>
        </ul>
      </aside>
    </div>
  </div>
</template>
