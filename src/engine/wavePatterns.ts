/**
 * Wave Patterns — stage-driven enemy compositions that demand tactical answers.
 */
import type { PieceKind } from '@/types/game'
import { pickEnemyKindForSlot } from '@/engine/stageManager'

export type WavePatternId =
  | 'procedural'
  | 'knight_rush'
  | 'pawn_wall'
  | 'bishop_diagonal'
  | 'rook_siege'

export type DojoModuleId =
  | 'knightDefense'
  | 'pawnWallBreak'
  | 'bishopDiagonal'
  | 'rookSiege'

export const WAVE_PATTERN_FOR_MODULE: Record<WavePatternId, DojoModuleId | null> = {
  procedural: null,
  knight_rush: 'knightDefense',
  pawn_wall: 'pawnWallBreak',
  bishop_diagonal: 'bishopDiagonal',
  rook_siege: 'rookSiege',
}

const PATTERN_CYCLE: WavePatternId[] = [
  'knight_rush',
  'pawn_wall',
  'bishop_diagonal',
  'rook_siege',
]

/** Resolves the tactical pattern for a stage (onboarding stays procedural). */
export function resolveWavePatternForStage(stage: number): WavePatternId {
  if (stage <= 5) return 'procedural'
  const index = Math.floor((stage - 6) / 4) % PATTERN_CYCLE.length
  return PATTERN_CYCLE[index]!
}

function fillPatternKinds(
  pattern: WavePatternId,
  waveSize: number,
  stage: number,
): PieceKind[] {
  const size = Math.max(1, waveSize)
  switch (pattern) {
    case 'knight_rush': {
      const knights = Math.min(size, Math.max(2, Math.floor(size * 0.55)))
      const kinds: PieceKind[] = []
      for (let i = 0; i < knights; i += 1) kinds.push('knight')
      while (kinds.length < size) {
        kinds.push(kinds.length % 2 === 0 ? 'pawn' : 'knight')
      }
      return kinds.slice(0, size)
    }
    case 'pawn_wall': {
      const kinds: PieceKind[] = []
      while (kinds.length < size) kinds.push('pawn')
      return kinds
    }
    case 'bishop_diagonal': {
      const bishops = Math.min(size, Math.max(2, Math.floor(size * 0.45)))
      const kinds: PieceKind[] = []
      for (let i = 0; i < bishops; i += 1) kinds.push('bishop')
      while (kinds.length < size) kinds.push(kinds.length % 2 === 0 ? 'pawn' : 'bishop')
      return kinds.slice(0, size)
    }
    case 'rook_siege': {
      const rooks = Math.min(size, Math.max(1, Math.floor(size * 0.35)))
      const kinds: PieceKind[] = []
      for (let i = 0; i < rooks; i += 1) kinds.push('rook')
      while (kinds.length < size) kinds.push(kinds.length % 2 === 0 ? 'pawn' : 'rook')
      return kinds.slice(0, size)
    }
    default:
      return []
  }
}

/**
 * Pattern-aware composition; falls back to procedural weights when pattern is procedural.
 */
export function generatePatternEnemyComposition(
  stage: number,
  waveSize: number,
  pattern: WavePatternId = resolveWavePatternForStage(stage),
): PieceKind[] {
  if (pattern === 'procedural') {
    const kinds: PieceKind[] = []
    for (let i = 0; i < Math.max(1, waveSize); i += 1) {
      kinds.push(pickEnemyKindForSlot(stage, i))
    }
    return kinds
  }

  const patterned = fillPatternKinds(pattern, waveSize, stage)
  if (patterned.length > 0) return patterned

  const kinds: PieceKind[] = []
  for (let i = 0; i < Math.max(1, waveSize); i += 1) {
    kinds.push(pickEnemyKindForSlot(stage, i))
  }
  return kinds
}

export interface DojoModuleCompletion {
  knightDefense: boolean
  pawnWallBreak: boolean
  bishopDiagonal: boolean
  rookSiege: boolean
}

export function createDefaultDojoModules(): DojoModuleCompletion {
  return {
    knightDefense: false,
    pawnWallBreak: false,
    bishopDiagonal: false,
    rookSiege: false,
  }
}

/** +15% player AP vs pattern counter-piece when the matching Dojo module is complete. */
export function getWavePatternPlayerApMult(
  pattern: WavePatternId,
  modules: DojoModuleCompletion,
  attackerKind: PieceKind,
): number {
  const moduleId = WAVE_PATTERN_FOR_MODULE[pattern]
  if (!moduleId || !modules[moduleId]) return 1

  switch (pattern) {
    case 'knight_rush':
      return attackerKind === 'knight' || attackerKind === 'bishop' ? 1.15 : 1
    case 'pawn_wall':
      return attackerKind === 'rook' || attackerKind === 'bishop' ? 1.15 : 1
    case 'bishop_diagonal':
      return attackerKind === 'bishop' || attackerKind === 'queen' ? 1.15 : 1
    case 'rook_siege':
      return attackerKind === 'rook' || attackerKind === 'knight' ? 1.15 : 1
    default:
      return 1
  }
}

export function isWavePatternCountered(
  pattern: WavePatternId,
  modules: DojoModuleCompletion,
): boolean {
  const moduleId = WAVE_PATTERN_FOR_MODULE[pattern]
  return Boolean(moduleId && modules[moduleId])
}
