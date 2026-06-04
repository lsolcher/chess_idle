/**
 * Boss signature mechanics and phase-shift hooks (GDD §3.2).
 * Called from combat ticks after enemy actions and during damage resolution.
 */
import { coordKey, findKing, getAllPieces, type BoardCoord } from '@/engine/board'
import { bootstrapPieceInitiative } from '@/engine/initiative'
import {
  applyGrandmasterCheckmatePhaseSkip,
  applyGrandmasterMiddlegameCopy,
  detectGrandmasterCheckmatePattern,
  getGrandmasterPhase,
} from '@/engine/grandmasterBoss'
import { resolveBossIdentity, type BossIdentityId } from '@/engine/bossIdentity'
import { createPiece, type ChessPiece } from '@/types/game'

/** HP ratio thresholds for generic phase shifts (GDD §3.2). */
export const BOSS_PHASE_THRESHOLDS = [0.66, 0.33] as const

export interface BossCombatRuntime {
  identity: BossIdentityId
  enemyActionCount: number
  phasesTriggered: number[]
  /** Bishop Pair — both bishops alive grants +50% DEF (GDD). */
  bishopPairShieldActive: boolean
  /** Grandmaster Phase II stat copy applied once per fight. */
  grandmasterPhase2Applied: boolean
}

export interface BossDamageContext {
  identity: BossIdentityId
  attackerKind: ChessPiece['kind']
  attackerSide: ChessPiece['side']
  defender: ChessPiece
  moveFrom: BoardCoord
  moveTo: BoardCoord
}

export function createBossCombatRuntime(
  stage: number,
  enemies: ChessPiece[],
): BossCombatRuntime | null {
  const identity = resolveBossIdentity(stage)
  if (!identity) return null

  const bishops = enemies.filter((p) => p.bossId === 'bishopPair' || (identity === 'bishopPair' && p.kind === 'bishop'))
  return {
    identity,
    enemyActionCount: 0,
    phasesTriggered: [],
    bishopPairShieldActive: identity === 'bishopPair' && bishops.length >= 2,
    grandmasterPhase2Applied: false,
  }
}

/**
 * Reduces incoming damage based on boss identity (Castle frontal arc, Iron Rook reflect handled separately).
 */
export function applyBossDamageReduction(
  damage: number,
  ctx: BossDamageContext,
  runtime: BossCombatRuntime | null,
): number {
  if (!runtime || ctx.defender.side !== 'enemy') return damage

  let adjusted = damage

  if (runtime.bishopPairShieldActive && ctx.defender.kind === 'bishop') {
    adjusted = Math.max(1, Math.floor(adjusted * 0.5))
  }

  if (runtime.identity === 'theCastle' && ctx.defender.isBoss) {
    const df = ctx.moveTo.file - ctx.moveFrom.file
    const dr = ctx.moveTo.rank - ctx.moveFrom.rank
    const frontal = dr < 0 && Math.abs(df) <= 1
    if (frontal) {
      adjusted = Math.max(1, Math.floor(adjusted * 0.8))
    }
  }

  return adjusted
}

/** Iron Rook reflects 10% melee damage back to the attacker King (GDD §3.2). */
export function calculateIronRookReflectDamage(
  damageDealt: number,
  ctx: BossDamageContext,
  runtime: BossCombatRuntime | null,
): number {
  if (!runtime || runtime.identity !== 'ironRook' || !ctx.defender.isBoss) return 0
  const meleeKinds: ChessPiece['kind'][] = ['pawn', 'knight', 'king']
  if (!meleeKinds.includes(ctx.attackerKind) || ctx.attackerSide !== 'player') return 0
  return Math.max(1, Math.floor(damageDealt * 0.1))
}

export interface BossTickResult {
  runtime: BossCombatRuntime
  playerPieces: ChessPiece[]
  enemyPieces: ChessPiece[]
  kingReflectDamage: number
}

/**
 * Post-enemy-action boss scripts: Phantom teleport, Regent buff, Grandmaster spawns, phase checks.
 */
export function tickBossMechanics(
  runtime: BossCombatRuntime,
  stage: number,
  playerPieces: ChessPiece[],
  enemyPieces: ChessPiece[],
  actedEnemyId: string,
  nowMs: number,
  globalSpeedMult: number,
): BossTickResult {
  let players = playerPieces
  let enemies = enemyPieces
  let kingReflectDamage = 0
  const nextRuntime: BossCombatRuntime = {
    ...runtime,
    enemyActionCount: runtime.enemyActionCount + 1,
    phasesTriggered: [...runtime.phasesTriggered],
  }

  let boss =
    enemies.find((p) => p.isBoss && p.id === actedEnemyId) ??
    enemies.find((p) => p.isBoss && p.stats.hp > 0)

  if (runtime.identity === 'grandmaster' && detectGrandmasterCheckmatePattern(players, enemies)) {
    const skip = applyGrandmasterCheckmatePhaseSkip(enemies, nextRuntime.phasesTriggered)
    enemies = skip.enemies
    nextRuntime.phasesTriggered = skip.phasesTriggered
    boss = enemies.find((p) => p.isBoss && p.kind === 'king') ?? boss
  }

  if (boss) {
    const hpRatio = boss.stats.maxHp > 0 ? boss.stats.hp / boss.stats.maxHp : 0

    if (
      runtime.identity === 'grandmaster' &&
      getGrandmasterPhase(hpRatio) <= 2 &&
      !nextRuntime.grandmasterPhase2Applied
    ) {
      const bossIndex = enemies.findIndex((p) => p.id === boss!.id)
      if (bossIndex !== -1) {
        enemies = enemies.map((piece, i) =>
          i === bossIndex ? applyGrandmasterMiddlegameCopy(boss!, players) : piece,
        )
        nextRuntime.grandmasterPhase2Applied = true
        boss = enemies[bossIndex]
      }
    }

    for (const threshold of BOSS_PHASE_THRESHOLDS) {
      if (hpRatio <= threshold && !nextRuntime.phasesTriggered.includes(threshold)) {
        nextRuntime.phasesTriggered.push(threshold)
        enemies = spawnPhaseAdds(enemies, stage, nowMs, globalSpeedMult, 2)
      }
    }
  }

  if (runtime.identity === 'enPassantPhantom' && nextRuntime.enemyActionCount % 5 === 0) {
    const phantom = enemies.find((p) => p.bossId === 'enPassantPhantom' || (p.isBoss && p.kind === 'knight'))
    if (phantom) {
      enemies = teleportBossPiece(enemies, phantom.id, playerPieces)
      players = stealRandomInitiative(players, nowMs)
    }
  }

  if (runtime.identity === 'theRegent' && nextRuntime.enemyActionCount % 10 === 0) {
    enemies = buffEnemyAp(enemies, 0.1)
  }

  if (runtime.identity === 'grandmaster' && nextRuntime.enemyActionCount % 15 === 0) {
    enemies = spawnPhaseAdds(enemies, stage, nowMs, globalSpeedMult, 2)
  }

  nextRuntime.bishopPairShieldActive =
    runtime.identity === 'bishopPair' &&
    enemies.filter((p) => p.kind === 'bishop' && p.stats.hp > 0).length >= 2

  return {
    runtime: nextRuntime,
    playerPieces: players,
    enemyPieces: enemies,
    kingReflectDamage,
  }
}

function teleportBossPiece(
  enemies: ChessPiece[],
  bossId: string,
  playerPieces: ChessPiece[],
): ChessPiece[] {
  const occupied = new Set(
    getAllPieces(playerPieces, enemies).map((p) => coordKey(p.position)),
  )
  const candidates: BoardCoord[] = []
  for (let file = 0; file < 8; file += 1) {
    for (let rank = 4; rank < 8; rank += 1) {
      const coord = { file, rank }
      if (!occupied.has(coordKey(coord))) candidates.push(coord)
    }
  }
  if (candidates.length === 0) return enemies
  const target = candidates[(bossId.length + enemies.length) % candidates.length]!
  return enemies.map((piece) =>
    piece.id === bossId ? { ...piece, position: target } : piece,
  )
}

/** −15% initiative progress on one random player piece (Phantom steal). */
function stealRandomInitiative(
  playerPieces: ChessPiece[],
  nowMs: number,
): ChessPiece[] {
  if (playerPieces.length === 0) return playerPieces
  const index = nowMs % playerPieces.length
  return playerPieces.map((piece, i) => {
    if (i !== index) return piece
    const stolen = Math.min(0.15, piece.initiative.progress)
    return {
      ...piece,
      initiative: {
        ...piece.initiative,
        progress: Math.max(0, piece.initiative.progress - stolen),
      },
    }
  })
}

function buffEnemyAp(enemies: ChessPiece[], pct: number): ChessPiece[] {
  return enemies.map((piece) => {
    if (piece.side !== 'enemy' || piece.stats.hp <= 0) return piece
    const ap = Math.round(piece.stats.ap * (1 + pct))
    return { ...piece, stats: { ...piece.stats, ap } }
  })
}

function spawnPhaseAdds(
  enemies: ChessPiece[],
  stage: number,
  nowMs: number,
  globalSpeedMult: number,
  count: number,
): ChessPiece[] {
  const occupied = new Set(enemies.map((p) => coordKey(p.position)))
  const adds: ChessPiece[] = []
  for (let i = 0; i < count; i += 1) {
    let placed: BoardCoord | null = null
    for (let rank = 5; rank < 8 && !placed; rank += 1) {
      for (let file = 0; file < 8; file += 1) {
        const coord = { file, rank }
        const key = coordKey(coord)
        if (!occupied.has(key)) {
          placed = coord
          occupied.add(key)
          break
        }
      }
    }
    if (!placed) break
    const pawn = createPiece(`boss-add-${stage}-${nowMs}-${i}`, 'pawn', 'enemy', placed)
    adds.push(bootstrapPieceInitiative(pawn, nowMs, globalSpeedMult))
  }
  return [...enemies, ...adds]
}

/** Applies Iron Rook reflect damage to the player King. */
export function applyKingReflectDamage(
  playerPieces: ChessPiece[],
  reflectDamage: number,
): ChessPiece[] {
  if (reflectDamage <= 0) return playerPieces
  const king = findKing(playerPieces, 'player')
  if (!king) return playerPieces
  return playerPieces.map((piece) =>
    piece.id === king.id
      ? {
          ...piece,
          stats: {
            ...piece.stats,
            hp: Math.max(0, piece.stats.hp - reflectDamage),
          },
        }
      : piece,
  )
}
