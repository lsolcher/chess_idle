/**
 * Combat resolution for board moves — HP damage before capture removal (GDD §1.1).
 */
import { applyBoardMove, type BoardMove } from './moves'
import {
  removeDefender,
  repositionPiece,
  resolveSafeAttackLanding,
} from './combatMovement'
import {
  calculateDamageDealt,
  calculateGoldCapture,
  MOVE_TYPE_MULTIPLIERS,
  type ChessPiece,
  type PieceKind,
} from '@/types/game'

export interface CombatResult {
  playerPieces: ChessPiece[]
  enemyPieces: ChessPiece[]
  damageDealt: number
  captured: boolean
  capturedKind?: PieceKind
  captureGold: number
}

function findPieceById(pieces: ChessPiece[], id: string): ChessPiece | undefined {
  return pieces.find((piece) => piece.id === id)
}

function updatePieceHp(pieces: ChessPiece[], id: string, hp: number): ChessPiece[] {
  return pieces.map((piece) =>
    piece.id === id ? { ...piece, stats: { ...piece.stats, hp: Math.max(0, hp) } } : piece,
  )
}

function applyNonCaptureMove(
  move: BoardMove,
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
): CombatResult {
  const applied = applyBoardMove(move, playerPieces, enemyPieces)
  return {
    playerPieces: applied.playerPieces,
    enemyPieces: applied.enemyPieces,
    damageDealt: 0,
    captured: false,
    captureGold: 0,
  }
}

/**
 * Resolves a board move with RPG damage rules.
 * Line attacks (rook/bishop/queen at range) chip/capture then advance beside the target.
 */
export function resolveCombatMove(
  move: BoardMove,
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
  options: {
    stage: number
    activeMult: number
    royalDecreeActive: boolean
    attackerApMult?: number
    /** Immortal Game invulnerability — lethal hits become chip damage (GDD §2.5). */
    defenderInvulnerable?: boolean
    /** Boss signature damage tuning (GDD §3.2). */
    adjustDamage?: (rawDamage: number, defender: ChessPiece) => number
  },
): CombatResult {
  const attacker =
    move.side === 'player'
      ? findPieceById(playerPieces, move.pieceId)
      : findPieceById(enemyPieces, move.pieceId)

  if (!attacker) {
    return {
      playerPieces,
      enemyPieces,
      damageDealt: 0,
      captured: false,
      captureGold: 0,
    }
  }

  if (!move.isCapture || !move.capturedPieceId) {
    return applyNonCaptureMove(move, playerPieces, enemyPieces)
  }

  const defender =
    move.side === 'player'
      ? findPieceById(enemyPieces, move.capturedPieceId)
      : findPieceById(playerPieces, move.capturedPieceId)

  if (!defender) {
    return {
      playerPieces,
      enemyPieces,
      damageDealt: 0,
      captured: false,
      captureGold: 0,
    }
  }

  const moveMult = MOVE_TYPE_MULTIPLIERS.capture
  const apMult = options.attackerApMult ?? 1
  let damage = calculateDamageDealt(attacker.stats.ap * apMult, defender.stats.def, moveMult)
  if (options.adjustDamage) {
    damage = options.adjustDamage(damage, defender)
  }
  let newHp = defender.stats.hp - damage

  if (newHp <= 0 && options.defenderInvulnerable) {
    newHp = Math.max(1, Math.floor(defender.stats.maxHp * 0.3))
    const updatedEnemy =
      move.side === 'player'
        ? updatePieceHp(enemyPieces, defender.id, newHp)
        : enemyPieces
    const updatedPlayer =
      move.side === 'enemy'
        ? updatePieceHp(playerPieces, defender.id, newHp)
        : playerPieces
    const landing = resolveSafeAttackLanding(
      move,
      attacker,
      defender,
      false,
      updatedPlayer,
      updatedEnemy,
      false,
    )
    const repositioned = repositionPiece(
      move.pieceId,
      move.side,
      landing,
      updatedPlayer,
      updatedEnemy,
    )
    return {
      playerPieces: repositioned.playerPieces,
      enemyPieces: repositioned.enemyPieces,
      damageDealt: damage,
      captured: false,
      captureGold: 0,
    }
  }

  if (newHp <= 0) {
    let nextPlayer = playerPieces
    let nextEnemy = enemyPieces
    const removed = removeDefender(
      defender.id,
      move.side,
      nextPlayer,
      nextEnemy,
    )
    nextPlayer = removed.playerPieces
    nextEnemy = removed.enemyPieces
    const landing = resolveSafeAttackLanding(
      move,
      attacker,
      defender,
      true,
      nextPlayer,
      nextEnemy,
      true,
    )
    const repositioned = repositionPiece(
      move.pieceId,
      move.side,
      landing,
      nextPlayer,
      nextEnemy,
    )
    const captureGold = calculateGoldCapture(
      defender.kind,
      options.stage,
      options.activeMult,
      options.royalDecreeActive,
    )
    return {
      playerPieces: repositioned.playerPieces,
      enemyPieces: repositioned.enemyPieces,
      damageDealt: damage,
      captured: true,
      capturedKind: defender.kind,
      captureGold,
    }
  }

  const updatedEnemy =
    move.side === 'player'
      ? updatePieceHp(enemyPieces, defender.id, newHp)
      : enemyPieces
  const updatedPlayer =
    move.side === 'enemy'
      ? updatePieceHp(playerPieces, defender.id, newHp)
      : playerPieces

  const landing = resolveSafeAttackLanding(
    move,
    attacker,
    defender,
    false,
    updatedPlayer,
    updatedEnemy,
    false,
  )
  const repositioned = repositionPiece(
    move.pieceId,
    move.side,
    landing,
    updatedPlayer,
    updatedEnemy,
  )

  return {
    playerPieces: repositioned.playerPieces,
    enemyPieces: repositioned.enemyPieces,
    damageDealt: damage,
    captured: false,
    captureGold: 0,
  }
}

