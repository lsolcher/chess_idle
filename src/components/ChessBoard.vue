<script setup lang="ts">

import { computed, onMounted, ref, watch } from 'vue'
import { t } from '@/i18n'
import type { IntentTimelineEntry } from '@/engine/enemyIntent'

import { buildOccupancy, coordKey, coordsEqual, getAllPieces } from '@/engine/board'

import type { BoardMove } from '@/engine/moves'
import { generateLegalMoves } from '@/engine/moves'

import { getPromotionBlockSquares } from '@/engine/promotion'

import type { CombatFeedbackEvent } from '@/engine/combatFeedback'
import { CLICK_COOLDOWN_SEC } from '@/engine/clickCombat'
import { useGameStore } from '@/store'

import {
  getVictoryGlowLabelId,
  type VictoryBackgroundTier,
} from '@/engine/aestheticProgression'
import ChessPieceRenderer from '@/components/ChessPieceRenderer.vue'
import type { ChessPiece, PieceSide } from '@/types/game'

export interface ChessBoardDojoBinding {
  pieces: ChessPiece[]
  legalMoves: BoardMove[]
  selectedPieceId: string | null
  sideToMove: PieceSide
  hint?: string
  compact?: boolean
}

export interface ChessBoardArenaBinding {
  pieces: ChessPiece[]
  selectedPieceId: string | null
  deployTargetKeys: string[]
  hint?: string
  compact?: boolean
  readonly?: boolean
}

const props = defineProps<{
  dojo?: ChessBoardDojoBinding | null
  arena?: ChessBoardArenaBinding | null
}>()

const emit = defineEmits<{
  dojoCellClick: [file: number, rank: number]
  arenaCellClick: [file: number, rank: number]
}>()

const store = useGameStore()

onMounted(() => {
  console.log('[ChessBoard] mounted', {
    wavePhase: store.wavePhase,
    playerPieces: store.playerPieces.length,
    enemyPieces: store.enemyPieces.length,
    onboarding: store.showOnboardingTelegraph,
  })
})

const isDojoMode = computed(() => Boolean(props.dojo))
const isArenaMode = computed(() => Boolean(props.arena))
const isOverlayMode = computed(() => isDojoMode.value || isArenaMode.value)

const clickCooldownRemainingSec = computed(() =>
  (CLICK_COOLDOWN_SEC * (1 - store.clickCooldownProgress)).toFixed(1),
)

const BOARD_SIZE = 8

/** Enemy piece selected for movement preview (red dots). */
const inspectedEnemyId = ref<string | null>(null)

watch(
  () => store.wavePhase,
  (phase) => {
    if (phase !== 'WAVE_ACTIVE') inspectedEnemyId.value = null
  },
)

const attackableEnemyIds = computed(() => {
  if (!store.isWaveActive || !store.manualPendingPieceId) return new Set<string>()
  const ids = new Set<string>()
  for (const move of store.manualLegalMoves) {
    if (move.isCapture && move.capturedPieceId) {
      ids.add(move.capturedPieceId)
    }
  }
  return ids
})

const inspectedEnemyMoves = computed((): BoardMove[] => {
  if (!inspectedEnemyId.value || !store.isWaveActive) return []
  const piece = store.enemyPieces.find((p) => p.id === inspectedEnemyId.value)
  if (!piece) return []
  return generateLegalMoves(piece, {
    allPieces: getAllPieces(store.playerPieces, store.enemyPieces),
    decreeStepEnabled: false,
  })
})

const enemyPreviewTargetKeys = computed(() => {
  const keys = new Set<string>()
  for (const move of inspectedEnemyMoves.value) {
    keys.add(coordKey(move.to))
  }
  return keys
})

const activeSelectedPieceId = computed(() => {
  if (isDojoMode.value) return props.dojo!.selectedPieceId
  if (isArenaMode.value) return props.arena!.selectedPieceId
  return store.manualPendingPieceId ?? store.prepPendingPieceId
})



const allPieces = computed(() => {
  if (isDojoMode.value) return props.dojo!.pieces
  if (isArenaMode.value) return props.arena!.pieces
  return [...store.playerPieces, ...store.enemyPieces]
})

const occupancy = computed(() => buildOccupancy(allPieces.value))

const blockSquares = computed(() =>
  isOverlayMode.value ? [] : getPromotionBlockSquares(store.currentStage),
)



const manualTargetKeys = computed(() => {
  const keys = new Set<string>()
  const moves = isDojoMode.value
    ? props.dojo!.legalMoves
    : isArenaMode.value
      ? []
      : store.manualLegalMoves
  for (const move of moves) {
    keys.add(coordKey(move.to))
  }
  return keys
})

const prepTargetKeys = computed(() => {
  const keys = new Set<string>()
  for (const move of store.prepLegalMoves) {
    keys.add(coordKey(move.to))
  }
  return keys
})



const modeLabel = computed(() =>
  store.autoPlay ? t('chessBoard.modeAuto') : t('chessBoard.modeManual'),
)

const intentTimeline = computed((): IntentTimelineEntry[] =>
  isOverlayMode.value ? [] : store.enemyIntentTimeline,
)

const victoryGlowBanner = computed(() => {
  if (isOverlayMode.value) return null
  const tier = store.aestheticProgress.victoryGlowTier
  if (tier <= 0) return null
  const labelId = getVictoryGlowLabelId(tier)
  const backdropKey: Record<VictoryBackgroundTier, string> = {
    worn: 'backdropWorn',
    rising: 'backdropRising',
    triumphant: 'backdropTriumphant',
  }
  const backdropTier = store.aestheticProgress.victoryBackgroundTier
  return t('victoryGlow.banner', {
    label: t(`victoryGlow.${labelId}`),
    waves: store.aestheticProgress.wavesClearedThisRun,
    backdrop: t(`victoryGlow.${backdropKey[backdropTier]}`),
  })
})

function intentLabel(entry: IntentTimelineEntry): string {
  if (entry.side === 'player') {
    return t('intentRibbon.playerTurn', { kind: entry.kind })
  }
  return t(`intentRibbon.enemy.${entry.intentKind}`)
}

function formatEtaMs(ms: number): string {
  if (ms <= 0) return t('intentRibbon.now')
  return `${(ms / 1000).toFixed(1)}s`
}

function isTelegraphedEnemy(entry: IntentTimelineEntry): boolean {
  return entry.side === 'enemy' && store.telegraphedEnemyIds.includes(entry.pieceId)
}



function pieceAt(file: number, rank: number): ChessPiece | undefined {

  return occupancy.value.get(coordKey({ file, rank }))

}



function isBlockSquare(file: number, rank: number): boolean {

  return blockSquares.value.some((sq) => coordsEqual(sq, { file, rank }))

}



function isManualTarget(file: number, rank: number): boolean {

  return manualTargetKeys.value.has(coordKey({ file, rank }))

}

function isPrepTarget(file: number, rank: number): boolean {
  return prepTargetKeys.value.has(coordKey({ file, rank }))
}

function isPrepSelectable(piece: ChessPiece): boolean {
  return store.isWavePrep && piece.side === 'player'
}

/** Active VFX on this square (capture flash, chip icon, floating gold). */
function feedbackAt(file: number, rank: number): CombatFeedbackEvent[] {
  const now = Date.now()
  return store.combatFeedbackEvents.filter(
    (event: CombatFeedbackEvent) =>
      event.file === file && event.rank === rank && event.expiresAtMs > now,
  )
}

function feedbackCellClass(file: number, rank: number): string {
  const events = feedbackAt(file, rank)
  const kinds = events.map((event) => event.kind)
  if (kinds.includes('capture')) {
    return events.some((e) => e.heavy)
      ? 'animate-capture-flash animate-capture-heavy'
      : 'animate-capture-flash'
  }
  if (kinds.includes('leak')) return 'animate-chip-flash'
  if (kinds.includes('clash') || kinds.includes('chip') || kinds.includes('reflect')) {
    return 'animate-clash-flash'
  }
  return ''
}



function isActiveTurnPiece(piece: ChessPiece): boolean {
  return (
    !store.autoPlay &&
    store.isWaveActive &&
    store.activeTurnPieceId === piece.id
  )
}



const arenaDeployTargetKeys = computed(() => {
  if (!isArenaMode.value) return new Set<string>()
  return new Set(props.arena!.deployTargetKeys)
})

function isArenaDeployTarget(file: number, rank: number): boolean {
  return arenaDeployTargetKeys.value.has(coordKey({ file, rank }))
}

function isSelectedPlayerPiece(piece: ChessPiece): boolean {
  return activeSelectedPieceId.value === piece.id
}

function isInspectedEnemyPiece(piece: ChessPiece): boolean {
  return piece.side === 'enemy' && inspectedEnemyId.value === piece.id
}

function isAttackableEnemyPiece(piece: ChessPiece): boolean {
  return piece.side === 'enemy' && attackableEnemyIds.value.has(piece.id)
}

function isEnemyPreviewTarget(file: number, rank: number): boolean {
  return enemyPreviewTargetKeys.value.has(coordKey({ file, rank }))
}

function isEnemyPreviewCapture(file: number, rank: number): boolean {
  const key = coordKey({ file, rank })
  return inspectedEnemyMoves.value.some(
    (move) => move.isCapture && coordKey(move.to) === key,
  )
}



function findManualMove(file: number, rank: number): BoardMove | undefined {

  return store.manualLegalMoves.find((m) => m.to.file === file && m.to.rank === rank)

}

function findPrepMove(file: number, rank: number): BoardMove | undefined {
  return store.prepLegalMoves.find((m) => m.to.file === file && m.to.rank === rank)
}



function onCellClick(file: number, rank: number): void {
  if (isDojoMode.value) {
    emit('dojoCellClick', file, rank)
    return
  }
  if (isArenaMode.value) {
    emit('arenaCellClick', file, rank)
    return
  }

  const piece = pieceAt(file, rank)

  if (store.isWavePrep) {
    const prepMove = findPrepMove(file, rank)
    if (prepMove && store.prepPendingPieceId) {
      store.executePrepMove(prepMove)
      return
    }
    if (piece && isPrepSelectable(piece)) {
      store.selectPrepPiece(piece.id)
    }
    return
  }

  if (!store.isWaveActive) return

  const manualMove = !store.autoPlay ? findManualMove(file, rank) : undefined

  if (store.isMoveFocus && manualMove && store.manualPendingPieceId) {
    inspectedEnemyId.value = null
    store.executePlayerManualMove(manualMove)
    return
  }

  if (
    store.isMoveFocus &&
    !store.autoPlay &&
    piece?.side === 'player' &&
    piece.id === store.activeTurnPieceId
  ) {
    inspectedEnemyId.value = null
    store.selectManualPiece(piece.id)
    return
  }

  if (store.isStrikeFocus && piece?.side === 'enemy' && store.canStrikeEnemy) {
    inspectedEnemyId.value = null
    store.clickEnemyPiece(piece.id)
    return
  }

  if (piece?.side === 'enemy' && store.isWaveActive) {
    inspectedEnemyId.value =
      inspectedEnemyId.value === piece.id ? null : piece.id
    return
  }
}



function togglePlayMode(): void {

  store.setAutoPlay(!store.autoPlay)

}



function cellClasses(file: number, rank: number): string {

  const light = (file + rank) % 2 === 0

  const piece = pieceAt(file, rank)

  const ready = piece ? isActiveTurnPiece(piece) : false

  const selected = piece ? isSelectedPlayerPiece(piece) : false
  const inspectedEnemy = piece ? isInspectedEnemyPiece(piece) : false
  const attackableEnemy = piece ? isAttackableEnemyPiece(piece) : false

  const isNext =

    piece?.id === (store.manualPendingPieceId ?? store.nextActingPieceId) &&

    piece?.side === 'player'

  const blocked = isBlockSquare(file, rank)

  const manualTarget = isManualTarget(file, rank)
  const prepTarget = isPrepTarget(file, rank)
  const enemyPreview = isEnemyPreviewTarget(file, rank)
  const enemyPreviewCapture = isEnemyPreviewCapture(file, rank)
  const prepSelectable = piece ? isPrepSelectable(piece) : false

  const dojoActive =
    isDojoMode.value &&
    props.dojo!.sideToMove === 'player' &&
    props.dojo!.legalMoves.length > 0
  const arenaActive =
    isArenaMode.value &&
    props.arena!.deployTargetKeys.length > 0 &&
    Boolean(props.arena!.selectedPieceId)
  const manualActive = !store.autoPlay && store.isWaveActive
  const prepActive = store.isWavePrep
  const clickActive = store.isWaveActive
  const boardInteractive = dojoActive || arenaActive || prepActive || manualActive || clickActive

  return [

    'fantasy-board-cell relative flex aspect-square items-center justify-center text-xl sm:text-2xl',

    light ? 'fantasy-board-cell--light fantasy-stone-tile--light' : 'fantasy-board-cell--dark fantasy-stone-tile--dark',

    light ? store.cosmeticTheme.boardLight : store.cosmeticTheme.boardDark,

    blocked ? 'ring-1 ring-amber-600/40 ring-inset' : '',

    ready && !selected
      ? 'z-10 ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900'
      : '',

    prepSelectable && !selected
      ? 'z-10 ring-2 ring-violet-400/70 ring-offset-1 ring-offset-slate-900'
      : '',

    selected
      ? 'z-10 ring-2 ring-sky-300 ring-offset-2 ring-offset-slate-900 chess-board-cell--selected'
      : '',

    inspectedEnemy
      ? 'z-10 ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-900 chess-board-cell--enemy-inspect'
      : '',

    attackableEnemy && !selected
      ? 'z-10 ring-2 ring-rose-500/80 ring-offset-1 ring-offset-slate-900 chess-board-cell--attackable'
      : '',

    isNext && store.autoPlay
      ? 'ring-2 ring-accent-emerald ring-offset-1 ring-offset-slate-900'
      : '',

    manualTarget || (isArenaMode && isArenaDeployTarget(file, rank))
      ? 'bg-sky-950/40 ring-2 ring-sky-400/60 ring-offset-1 ring-offset-slate-900'
      : '',

    prepTarget ? 'bg-violet-950/40 ring-2 ring-violet-400/60 ring-offset-1 ring-offset-slate-900' : '',

    enemyPreview ? 'bg-rose-950/35 ring-2 ring-rose-500/50 ring-offset-1 ring-offset-slate-900' : '',

    enemyPreviewCapture && piece
      ? 'bg-rose-950/40 ring-2 ring-rose-500/70 ring-offset-1 ring-offset-slate-900'
      : '',

    boardInteractive ? 'cursor-pointer' : 'cursor-default',

    feedbackCellClass(file, rank),

  ].join(' ')

}



function hasEnPassantCarry(piece: ChessPiece): boolean {
  const carry = store.enPassantCarryByPieceId[piece.id]
  return Boolean(carry && (carry.apBonus > 0 || carry.hpBonus > 0))
}

function pieceClasses(piece: ChessPiece): string {
  if (piece.isBoss) {
    return 'text-yellow-200 drop-shadow-[0_0_8px_rgba(250,204,21,0.75)]'
  }
  if (piece.superPromotion) return 'text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]'
  if (hasEnPassantCarry(piece)) {
    return 'text-violet-200 drop-shadow-[0_0_4px_rgba(167,139,250,0.55)]'
  }
  const theme = store.cosmeticTheme
  const base = piece.side === 'player' ? theme.playerPiece : theme.enemyPiece
  const juice = store.pieceJuiceClassFor(piece)
  return juice ? `${base} ${juice}` : base
}



function progressStyle(piece: ChessPiece): Record<string, string> | undefined {
  if (isOverlayMode.value || !store.isWaveActive) return undefined

  const withProgress =
    piece.side === 'player'
      ? store.playerPiecesWithProgress.find((p) => p.id === piece.id)
      : store.enemyPiecesWithProgress.find((p) => p.id === piece.id)

  if (!withProgress) return undefined

  const pct = Math.round(withProgress.initiative.progress * 100)
  const color = piece.side === 'player' ? '#34d399' : '#f87171'

  return {
    background: `conic-gradient(${color} ${pct}%, transparent ${pct}%)`,
  }
}

function pieceRingClass(piece: ChessPiece): string {
  if (isSelectedPlayerPiece(piece)) return 'chess-piece-ring--selected'
  if (isInspectedEnemyPiece(piece)) return 'chess-piece-ring--enemy-inspect'
  if (isAttackableEnemyPiece(piece)) return 'chess-piece-ring--attackable'
  return ''
}



function hpPercent(piece: ChessPiece): number {

  if (piece.stats.maxHp <= 0) return 0

  return Math.max(0, Math.min(100, (piece.stats.hp / piece.stats.maxHp) * 100))

}

</script>



<template>

  <section class="stone-panel p-3 sm:p-4">

    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">

      <h2 class="fantasy-heading text-sm font-semibold uppercase tracking-wide">
        {{
          isArenaMode
            ? t('chessBoard.arenaTitle')
            : isDojoMode
              ? t('chessBoard.dojoTitle')
              : t('chessBoard.title')
        }}
      </h2>

      <button
        v-if="!isOverlayMode && store.canSkipManualTurn"
        type="button"
        class="rounded-lg bg-slate-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 hover:bg-slate-500"
        @click="store.skipManualTurn()"
      >
        {{ t('chessBoard.skipTurn') }}
      </button>

      <template v-if="!isOverlayMode && store.isWaveActive">
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide shadow-md transition"
          :class="
            store.isStrikeFocus
              ? 'bg-rose-600 text-white ring-2 ring-rose-300/80'
              : 'bg-slate-700 text-rose-100 hover:bg-slate-600'
          "
          :disabled="!store.canArmStrikeFocus"
          :aria-pressed="store.isStrikeFocus"
          @click="store.setCombatFocus('strike')"
        >
          {{ t('chessBoard.strike') }}
        </button>

        <button
          v-if="!store.autoPlay"
          type="button"
          class="rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide shadow-md transition"
          :class="
            store.isMoveFocus
              ? 'bg-sky-600 text-white ring-2 ring-sky-300/80'
              : 'bg-slate-700 text-sky-100 hover:bg-slate-600'
          "
          :disabled="!store.canArmMoveFocus"
          :aria-pressed="store.isMoveFocus"
          @click="store.setCombatFocus('move')"
        >
          {{ t('chessBoard.move') }}
        </button>
      </template>

      <button
        v-if="!isOverlayMode"
        type="button"
        class="rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wider shadow-md transition"
        :class="
          store.autoPlay
            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
            : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
        "
        :aria-pressed="store.autoPlay"
        @click="togglePlayMode"
      >
        {{ t('chessBoard.mode', { mode: modeLabel }) }}
      </button>
    </div>

    <p
      v-if="isDojoMode && props.dojo?.hint"
      class="mb-2 text-center text-xs text-indigo-200/90"
    >
      {{ props.dojo.hint }}
    </p>

    <p
      v-if="isArenaMode && props.arena?.hint"
      class="mb-2 text-center text-xs text-cyan-200/90"
    >
      {{ props.arena.hint }}
    </p>

    <p
      v-if="!isOverlayMode && store.isWavePrep"
      class="mb-2 text-center text-xs text-violet-200/90"
    >
      <template v-if="store.prepPendingPieceId">
        {{ t('chessBoard.prepReposition') }}
      </template>
      <template v-else>
        {{ t('chessBoard.prepFormation') }}
      </template>
    </p>

    <div
      v-if="!isOverlayMode && store.isWaveActive && store.isStrikeFocus"
      class="mb-2 space-y-1"
    >
      <div
        class="mx-auto h-1 max-w-xs overflow-hidden rounded-full bg-slate-800"
        aria-hidden="true"
      >
        <div
          class="h-full rounded-full bg-rose-500/90 transition-[width] duration-75"
          :style="{ width: `${Math.round(store.clickCooldownProgress * 100)}%` }"
        />
      </div>
      <p class="text-center text-xs text-rose-200/80">
        <template v-if="store.canStrikeEnemy">
          {{
            t('chessBoard.strikeArmedStamina', {
              current: store.staminaCurrent,
              max: store.staminaMax,
            })
          }}
        </template>
        <template v-else-if="store.staminaCurrent < 5">
          {{ t('chessBoard.strikeNeedStamina') }}
        </template>
        <template v-else-if="store.isCombatTimePaused">
          {{ t('chessBoard.strikeRechargingResume') }}
        </template>
        <template v-else>
          {{ t('chessBoard.strikeRechargingSec', { sec: clickCooldownRemainingSec }) }}
        </template>
      </p>
    </div>

    <p
      v-if="!isOverlayMode && !store.autoPlay && store.isWaveActive"
      class="mb-2 text-center text-xs text-amber-200/90"
    >
      <template v-if="store.hasNoManualLegalMoves">
        {{ t('chessBoard.noLegalMoves') }}
      </template>
      <template v-else-if="store.isAwaitingManualMove && store.isMoveFocus">
        {{ t('chessBoard.moveArmed') }}
        <span class="block text-slate-500">{{ t('chessBoard.clockPaused') }}</span>
      </template>
      <template v-else-if="store.isAwaitingManualMove && store.isStrikeFocus">
        {{ t('chessBoard.yourTurnDual') }}
      </template>
      <template v-else-if="store.activeTurnSide === 'enemy'">
        {{ t('chessBoard.enemyTurn') }}
      </template>
      <template v-else-if="store.isStrikeFocus">
        {{ t('chessBoard.strikeBetweenTurns') }}
      </template>
      <template v-else>
        {{ t('chessBoard.waitingInitiative') }}
      </template>
    </p>

    <p
      v-else-if="!isOverlayMode && store.autoPlay && store.isWaveActive && store.isStrikeFocus"
      class="mb-2 text-center text-xs text-emerald-200/80"
    >
      {{ t('chessBoard.autoStrikeHint') }}
    </p>

    <p
      v-if="victoryGlowBanner"
      class="mb-2 text-center text-[11px] font-medium tracking-wide text-sky-200/90"
    >
      {{ victoryGlowBanner }}
    </p>

    <div
      v-if="!isOverlayMode && store.isWaveActive && intentTimeline.length > 0"
      class="fantasy-intent-ribbon mb-3 px-2 py-2"
      :class="store.showOnboardingTelegraph ? 'ring-2 ring-amber-400/70' : ''"
      role="region"
      :aria-label="t('intentRibbon.title')"
    >
      <div class="mb-1.5 flex flex-wrap items-center justify-between gap-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
          {{ t('intentRibbon.title') }}
        </span>
        <span class="text-[10px] text-slate-400">
          {{ t(`wavePattern.${store.currentWavePattern}`) }}
          <template v-if="store.wavePatternCountered">
            · {{ t('intentRibbon.countered') }}
          </template>
        </span>
      </div>
      <ol class="flex flex-col gap-1">
        <li
          v-for="entry in intentTimeline"
          :key="entry.pieceId"
          class="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
          :class="
            isTelegraphedEnemy(entry)
              ? 'bg-rose-950/50 text-rose-100 ring-1 ring-rose-500/40'
              : entry.side === 'player'
                ? 'bg-sky-950/40 text-sky-100'
                : 'bg-slate-800/60 text-slate-300'
          "
        >
          <span class="font-medium capitalize">
            {{ entry.order }}. {{ intentLabel(entry) }}
          </span>
          <span class="font-mono text-[10px] opacity-80">
            {{ entry.isReady ? t('intentRibbon.now') : formatEtaMs(entry.etaMs) }}
          </span>
        </li>
      </ol>
      <p class="mt-1.5 text-[10px] text-amber-100/70">
        {{ t('intentRibbon.tempoHint') }}
      </p>
    </div>

    <div
      class="fantasy-board-frame mx-auto transition-transform duration-100"
      :class="[
        props.dojo?.compact || props.arena?.compact ? 'max-w-xs' : 'max-w-md',
        !isOverlayMode && store.isBoardZoomActive ? 'combat-board-zoom' : '',
      ]"
    >
      <div
        class="chess-board-grid overflow-hidden rounded-md shadow-lg shadow-black/30"
      >

      <template v-for="rank in BOARD_SIZE" :key="`rank-${rank}`">

        <button

          v-for="file in BOARD_SIZE"

          :key="`${file}-${rank}`"

          type="button"

          :class="cellClasses(file - 1, BOARD_SIZE - rank)"

          :aria-disabled="
            isDojoMode
              ? props.dojo?.sideToMove !== 'player'
              : isArenaMode
                ? !props.arena?.selectedPieceId
                : !store.isWavePrep && !store.isWaveActive
          "

          @click="onCellClick(file - 1, BOARD_SIZE - rank)"

        >

          <template v-if="pieceAt(file - 1, BOARD_SIZE - rank)">

            <div class="relative z-20 flex h-[88%] w-[88%] flex-col items-center justify-end">

              <div
                class="relative grid size-full place-items-center rounded-full p-0.5"
                :class="pieceRingClass(pieceAt(file - 1, BOARD_SIZE - rank)!)"
                :style="progressStyle(pieceAt(file - 1, BOARD_SIZE - rank)!)"
              >
                <ChessPieceRenderer
                  class="chess-piece-victory-wrap max-h-full max-w-full"
                  :class="[
                    pieceClasses(pieceAt(file - 1, BOARD_SIZE - rank)!),
                    pieceAt(file - 1, BOARD_SIZE - rank)?.side === 'enemy' &&
                    store.isWaveActive &&
                    store.isStrikeFocus &&
                    store.canStrikeEnemy
                      ? 'cursor-crosshair hover:brightness-125'
                      : pieceAt(file - 1, BOARD_SIZE - rank)?.side === 'enemy' &&
                          store.isWaveActive &&
                          store.isStrikeFocus
                        ? 'opacity-70'
                        : '',
                    pieceAt(file - 1, BOARD_SIZE - rank)?.superPromotion
                      ? 'ring-1 ring-amber-400/60'
                      : '',
                  ]"
                  :piece="pieceAt(file - 1, BOARD_SIZE - rank)!"
                />
              </div>

              <div
                v-if="!isOverlayMode"
                class="fantasy-hp-bar mt-0.5 h-1 w-[70%] overflow-hidden rounded-full"
                role="progressbar"
                :aria-valuenow="hpPercent(pieceAt(file - 1, BOARD_SIZE - rank)!)"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="h-full rounded-full transition-all"
                  :class="
                    pieceAt(file - 1, BOARD_SIZE - rank)!.side === 'player'
                      ? 'fantasy-hp-bar--player'
                      : 'fantasy-hp-bar--enemy'
                  "
                  :style="{
                    width: `${hpPercent(pieceAt(file - 1, BOARD_SIZE - rank)!)}%`,
                  }"
                />
              </div>

            </div>

          </template>

          <template
            v-for="fx in feedbackAt(file - 1, BOARD_SIZE - rank)"
            :key="fx.id"
          >
            <span
              v-if="fx.kind === 'gold'"
              class="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center animate-float-gold text-[10px] font-bold text-amber-300 drop-shadow"
            >+{{ fx.amount }}</span>
            <span
              v-else-if="fx.kind === 'clash' || fx.kind === 'chip' || fx.kind === 'reflect'"
              class="combat-clash-icon pointer-events-none absolute bottom-1 right-1 z-30 text-sm font-bold text-slate-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]"
              aria-hidden="true"
            >⚔</span>
            <span
              v-if="(fx.kind === 'clash' || fx.kind === 'chip') && fx.amount"
              class="pointer-events-none absolute bottom-4 right-0 z-30 animate-clash-damage text-[9px] font-bold text-rose-300"
            >{{ fx.amount }}</span>
            <span
              v-else-if="fx.kind === 'leak'"
              class="pointer-events-none absolute bottom-1 left-1 z-30 text-[10px] font-bold text-rose-500"
            >−{{ fx.amount }}</span>
          </template>

          <span
            v-if="!pieceAt(file - 1, BOARD_SIZE - rank) && isEnemyPreviewTarget(file - 1, BOARD_SIZE - rank)"
            class="text-lg text-rose-500/85"
            aria-hidden="true"
          >
            ●
          </span>
          <span
            v-if="
              !pieceAt(file - 1, BOARD_SIZE - rank) &&
              (isManualTarget(file - 1, BOARD_SIZE - rank) ||
                (isArenaMode && isArenaDeployTarget(file - 1, BOARD_SIZE - rank)))
            "
            class="text-lg text-sky-400/60"
            aria-hidden="true"
          >
            ●
          </span>
          <span
            v-if="!pieceAt(file - 1, BOARD_SIZE - rank) && isPrepTarget(file - 1, BOARD_SIZE - rank)"
            class="text-lg text-violet-400/70"
            aria-hidden="true"
          >
            ●
          </span>

        </button>

      </template>

      </div>
    </div>

    <div class="mt-2 flex justify-between text-[10px] text-slate-600 sm:text-xs">

      <span>a1</span>

      <span v-if="blockSquares.length" class="text-amber-600/70">{{
        t('chessBoard.promotionBlock')
      }}</span>

      <span>h8</span>

    </div>

  </section>

</template>

