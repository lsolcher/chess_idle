/**
 * Direct click damage on enemy pieces (GDD §1.1 / §1.4).
 * Clicks spend stamina, use click-power upgrades, and respect active combo mult.
 */
import {
  calculateDamageDealt,
  calculateGoldCapture,
  calculateStatAtLevel,
  PIECE_DEFINITIONS,
  type ChessPiece,
  type PieceKind,
} from '@/types/game'

/** Base click damage at click-power level 1 (scales with upgrade track). */
export const CLICK_POWER_BASE = 10

/**
 * Seconds between click strikes (GDD §1.4 — clicks do not use initiative).
 * ~2.5s sits between fast pieces (2.0s) and the solo King (3.0s): supplemental DPS
 * without outpacing the chess loop or stamina regen (+10/s vs −5/click).
 */
export const CLICK_COOLDOWN_SEC = 2.5
export const CLICK_COOLDOWN_MS = CLICK_COOLDOWN_SEC * 1000

export function isClickCombatReady(readyAtMs: number, nowMs: number): boolean {
  return nowMs >= readyAtMs
}

/** 0 = on cooldown, 1 = ready (for UI ring). */
export function computeClickCooldownProgress(readyAtMs: number, nowMs: number): number {
  if (nowMs >= readyAtMs) return 1
  const remaining = readyAtMs - nowMs
  return Math.max(0, 1 - remaining / CLICK_COOLDOWN_MS)
}

export interface ClickDamageResult {
  playerPieces: ChessPiece[]
  enemyPieces: ChessPiece[]
  damageDealt: number
  captured: boolean
  capturedKind?: PieceKind
  captureGold: number
}

/**
 * `ClickDmg = BaseClick × PieceMult × ActiveMult` (GDD §1.1).
 * PieceMult ties chip effort to enemy piece tier via capture value.
 */
export function calculateClickDamage(
  clickPowerLevel: number,
  targetKind: PieceKind,
  activeMult: number,
): number {
  const baseClick = calculateStatAtLevel(CLICK_POWER_BASE, clickPowerLevel)
  const pieceMult = PIECE_DEFINITIONS[targetKind].captureValue / 5
  const raw = baseClick * pieceMult * activeMult
  return Math.max(1, Math.floor(raw))
}

function updatePieceHp(pieces: ChessPiece[], id: string, hp: number): ChessPiece[] {
  return pieces.map((piece) =>
    piece.id === id ? { ...piece, stats: { ...piece.stats, hp: Math.max(0, hp) } } : piece,
  )
}

/**
 * Applies click damage to one enemy; removes on lethal and awards capture gold.
 */
export function resolveClickDamage(
  enemyPieceId: string,
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
  options: {
    clickPowerLevel: number
    activeMult: number
    stage: number
    royalDecreeActive: boolean
    adjustDamage?: (rawDamage: number, defender: ChessPiece) => number
  },
): ClickDamageResult {
  const defender = enemyPieces.find((piece) => piece.id === enemyPieceId)
  if (!defender || defender.side !== 'enemy') {
    return {
      playerPieces,
      enemyPieces,
      damageDealt: 0,
      captured: false,
      captureGold: 0,
    }
  }

  let damage = calculateClickDamage(
    options.clickPowerLevel,
    defender.kind,
    options.activeMult,
  )

  if (options.adjustDamage) {
    damage = options.adjustDamage(damage, defender)
  }

  /** Clicks punch through a portion of DEF (direct strike). */
  const effective = calculateDamageDealt(damage, Math.floor(defender.stats.def * 0.5))
  let newHp = defender.stats.hp - effective

  if (newHp <= 0) {
    const captureGold = calculateGoldCapture(
      defender.kind,
      options.stage,
      options.activeMult,
      options.royalDecreeActive,
    )
    return {
      playerPieces,
      enemyPieces: enemyPieces.filter((piece) => piece.id !== defender.id),
      damageDealt: effective,
      captured: true,
      capturedKind: defender.kind,
      captureGold,
    }
  }

  return {
    playerPieces,
    enemyPieces: updatePieceHp(enemyPieces, defender.id, newHp),
    damageDealt: effective,
    captured: false,
    captureGold: 0,
  }
}
