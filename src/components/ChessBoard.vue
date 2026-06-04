<script setup lang="ts">

import { computed } from 'vue'

import { buildOccupancy, coordKey, coordsEqual } from '@/engine/board'

import type { BoardMove } from '@/engine/moves'

import { getPromotionBlockSquares } from '@/engine/promotion'

import type { CombatFeedbackEvent } from '@/engine/combatFeedback'
import { CLICK_COOLDOWN_SEC } from '@/engine/clickCombat'
import { useGameStore } from '@/store'

import type { ChessPiece, PieceKind, PieceSide, SuperPromotionForm } from '@/types/game'

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

const isDojoMode = computed(() => Boolean(props.dojo))
const isArenaMode = computed(() => Boolean(props.arena))
const isOverlayMode = computed(() => isDojoMode.value || isArenaMode.value)

const clickCooldownRemainingSec = computed(() =>
  (CLICK_COOLDOWN_SEC * (1 - store.clickCooldownProgress)).toFixed(1),
)

const BOARD_SIZE = 8



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



const modeLabel = computed(() => (store.autoPlay ? 'AUTO' : 'MANUAL'))



const kindGlyph: Record<PieceKind, { player: string; enemy: string }> = {

  king: { player: '♔', enemy: '♚' },

  pawn: { player: '♙', enemy: '♟' },

  knight: { player: '♘', enemy: '♞' },

  bishop: { player: '♗', enemy: '♝' },

  rook: { player: '♖', enemy: '♜' },

  queen: { player: '♛', enemy: '♛' },

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
  const kinds = feedbackAt(file, rank).map((event) => event.kind)
  if (kinds.includes('capture')) return 'animate-capture-flash'
  if (kinds.includes('leak')) return 'animate-chip-flash'
  if (kinds.includes('chip') || kinds.includes('reflect')) return 'animate-chip-flash'
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
  if (isDojoMode.value) {
    return props.dojo!.selectedPieceId === piece.id
  }
  if (isArenaMode.value) {
    return props.arena!.selectedPieceId === piece.id
  }
  return (
    store.manualPendingPieceId === piece.id || store.prepPendingPieceId === piece.id
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
    store.executePlayerManualMove(manualMove)
    return
  }

  if (
    store.isMoveFocus &&
    !store.autoPlay &&
    piece?.side === 'player' &&
    piece.id === store.activeTurnPieceId
  ) {
    store.selectManualPiece(piece.id)
    return
  }

  if (store.isStrikeFocus && piece?.side === 'enemy' && store.canStrikeEnemy) {
    store.clickEnemyPiece(piece.id)
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

  const isNext =

    piece?.id === (store.manualPendingPieceId ?? store.nextActingPieceId) &&

    piece?.side === 'player'

  const blocked = isBlockSquare(file, rank)

  const manualTarget = isManualTarget(file, rank)
  const prepTarget = isPrepTarget(file, rank)
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

    'relative flex aspect-square items-center justify-center text-xl sm:text-2xl',

    light ? store.cosmeticTheme.boardLight : store.cosmeticTheme.boardDark,

    light ? store.gradualBoardClasses.light : store.gradualBoardClasses.dark,

    blocked ? 'ring-1 ring-amber-600/40 ring-inset' : '',

    ready && !selected
      ? 'z-10 ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900'
      : '',

    prepSelectable && !selected
      ? 'z-10 ring-2 ring-violet-400/70 ring-offset-1 ring-offset-slate-900'
      : '',

    selected ? 'z-10 ring-2 ring-sky-300 ring-offset-1 ring-offset-slate-900' : '',

    isNext && store.autoPlay
      ? 'ring-2 ring-accent-emerald ring-offset-1 ring-offset-slate-900'
      : '',

    manualTarget || (isArenaMode && isArenaDeployTarget(file, rank))
      ? 'bg-sky-950/40 ring-2 ring-sky-400/60 ring-offset-1 ring-offset-slate-900'
      : '',

    prepTarget ? 'bg-violet-950/40 ring-2 ring-violet-400/60 ring-offset-1 ring-offset-slate-900' : '',

    boardInteractive ? 'cursor-pointer' : 'cursor-default',

    feedbackCellClass(file, rank),

  ].join(' ')

}



function displayGlyph(piece: ChessPiece): string {

  if (piece.superPromotion) {

    const superGlyphs: Record<SuperPromotionForm, string> = {

      'super-knight': '♘',

      'super-bishop': '♗',

      'super-rook': '♖',

      'super-queen': '♛',

    }

    return superGlyphs[piece.superPromotion.form]

  }

  return kindGlyph[piece.kind][piece.side]

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
  const aura = store.pieceAuraClassFor(piece)
  return aura ? `${base} ${aura}` : base
}



function progressStyle(piece: ChessPiece): Record<string, string> | undefined {
  if (isOverlayMode.value) return undefined

  const withProgress = store.playerPiecesWithProgress.find((p) => p.id === piece.id)

  if (!withProgress || piece.side !== 'player') return undefined

  const pct = Math.round(withProgress.initiative.progress * 100)

  return {

    background: `conic-gradient(#34d399 ${pct}%, transparent ${pct}%)`,

  }

}



function hpPercent(piece: ChessPiece): number {

  if (piece.stats.maxHp <= 0) return 0

  return Math.max(0, Math.min(100, (piece.stats.hp / piece.stats.maxHp) * 100))

}

</script>



<template>

  <section class="rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4">

    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">

      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">
        {{ isArenaMode ? 'Arena Preview' : isDojoMode ? 'Dojo Board' : 'Chessboard' }}
      </h2>

      <button
        v-if="!isOverlayMode && store.canSkipManualTurn"
        type="button"
        class="rounded-lg bg-slate-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 hover:bg-slate-500"
        @click="store.skipManualTurn()"
      >
        Skip Turn
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
          Strike
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
          Move
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
        Mode: {{ modeLabel }}
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
        Tap a violet square to reposition
      </template>
      <template v-else>
        Tap your pieces to set formation (ranks 1–2)
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
          Strike armed — tap an enemy ({{ store.staminaCurrent }}/{{ store.staminaMax }} stamina)
        </template>
        <template v-else-if="store.staminaCurrent < 5">
          Strike armed — need more stamina
        </template>
        <template v-else-if="store.isCombatTimePaused">
          Strike recharging when combat resumes
        </template>
        <template v-else>
          Strike recharging ({{ clickCooldownRemainingSec }}s)
        </template>
      </p>
    </div>

    <p
      v-if="!isOverlayMode && !store.autoPlay && store.isWaveActive"
      class="mb-2 text-center text-xs text-amber-200/90"
    >
      <template v-if="store.hasNoManualLegalMoves">
        No legal moves — use Skip Turn below
      </template>
      <template v-else-if="store.isAwaitingManualMove && store.isMoveFocus">
        Move armed — tap a sky square or enemy you can capture
        <span class="block text-slate-500">Clock paused until you act</span>
      </template>
      <template v-else-if="store.isAwaitingManualMove && store.isStrikeFocus">
        Your turn — use Move to play a piece, or Strike to chip enemies
      </template>
      <template v-else-if="store.activeTurnSide === 'enemy'">
        Enemy turn — resolving move…
      </template>
      <template v-else-if="store.isStrikeFocus">
        Strike armed — tap enemies between turns
      </template>
      <template v-else>
        Waiting for next initiative tick…
      </template>
    </p>

    <p
      v-else-if="!isOverlayMode && store.autoPlay && store.isWaveActive && store.isStrikeFocus"
      class="mb-2 text-center text-xs text-emerald-200/80"
    >
      Auto moves pieces — Strike armed for tap damage
    </p>



    <div

      class="mx-auto grid grid-cols-8 overflow-hidden rounded-lg border border-slate-700 shadow-lg shadow-black/30"
      :class="props.dojo?.compact || props.arena?.compact ? 'max-w-xs' : 'max-w-md'"

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

                :style="progressStyle(pieceAt(file - 1, BOARD_SIZE - rank)!)"

              >

                <span

                  class="flex size-full items-center justify-center rounded-full bg-slate-900/85 text-lg sm:text-xl"

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

                >

                  {{ displayGlyph(pieceAt(file - 1, BOARD_SIZE - rank)!) }}

                </span>

              </div>

              <div
                v-if="!isOverlayMode"
                class="mt-0.5 h-1 w-[70%] overflow-hidden rounded-full bg-slate-950/80"
                role="progressbar"
                :aria-valuenow="hpPercent(pieceAt(file - 1, BOARD_SIZE - rank)!)"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="h-full rounded-full transition-all"
                  :class="
                    pieceAt(file - 1, BOARD_SIZE - rank)!.side === 'player'
                      ? 'bg-sky-500'
                      : 'bg-rose-500'
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
              v-else-if="fx.kind === 'chip' || fx.kind === 'reflect'"
              class="pointer-events-none absolute bottom-1 right-1 z-30 text-xs text-rose-400 drop-shadow"
              aria-hidden="true"
            >⚔</span>
            <span
              v-else-if="fx.kind === 'leak'"
              class="pointer-events-none absolute bottom-1 left-1 z-30 text-[10px] font-bold text-rose-500"
            >−{{ fx.amount }}</span>
          </template>

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



    <div class="mt-2 flex justify-between text-[10px] text-slate-600 sm:text-xs">

      <span>a1</span>

      <span v-if="blockSquares.length" class="text-amber-600/70">Shaded = promotion block</span>

      <span>h8</span>

    </div>

  </section>

</template>

