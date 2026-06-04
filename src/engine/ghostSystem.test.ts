import { describe, expect, it } from 'vitest'
import { selectBestMove } from '@/engine/aiHeuristic'
import {
  exportArmySnapshot,
  exportArmySnapshotFromPieces,
  importArmySnapshot,
  parseArmySnapshot,
  saveGhostArmy,
  selectGhostOpponent,
  serializeArmySnapshot,
} from '@/engine/ghostSystem'
import { createInitialGameState, createPiece } from '@/types/game'

describe('ghostSystem', () => {
  it('exports minimal army JSON with stats and super-form', () => {
    const state = createInitialGameState(0)
    const pawn = createPiece('p1', 'pawn', 'player', { file: 3, rank: 1 })
    pawn.upgradeLevels = { ap: 2, hp: 2, def: 1, initiative: 1 }
    pawn.superPromotion = {
      form: 'super-queen',
      sourcePawnId: 'p1',
      apMult: 1.5,
      hpMult: 1.4,
      traits: { lineSlam: true },
    }
    state.playerPieces = [state.playerPieces[0]!, pawn]
    state.currentStage = 12

    const snapshot = exportArmySnapshot(state, 1000)
    const json = serializeArmySnapshot(snapshot)
    const parsed = JSON.parse(json) as { pieces: unknown[]; powerScore: number }

    expect(parsed.pieces).toHaveLength(2)
    expect(parsed.powerScore).toBeGreaterThan(0)
    const queenRow = snapshot.pieces.find((p) => p.superForm === 'super-queen')
    expect(queenRow?.upgradeLevels.ap).toBe(2)
    expect(queenRow?.stats.ap).toBeGreaterThan(0)
  })

  it('exportArmySnapshotFromPieces matches state export', () => {
    const state = createInitialGameState(0)
    state.playerPieces.push(createPiece('p2', 'knight', 'player', { file: 1, rank: 0 }))
    const fromPieces = exportArmySnapshotFromPieces(state.playerPieces, state.currentStage, 0)
    const fromState = exportArmySnapshot(state, 0)
    expect(fromPieces.pieces).toHaveLength(fromState.pieces.length)
    expect(fromPieces.powerScore).toBe(fromState.powerScore)
  })

  it('round-trips import from JSON', () => {
    const state = createInitialGameState(0)
    state.playerPieces.push(createPiece('p2', 'knight', 'player', { file: 1, rank: 0 }))
    const json = serializeArmySnapshot(exportArmySnapshot(state, 0))
    const imported = importArmySnapshot(json, 5000, 1)

    expect(imported.length).toBe(2)
    expect(imported.some((p) => p.kind === 'king')).toBe(true)
    expect(imported.some((p) => p.kind === 'knight')).toBe(true)
    expect(imported[0]!.initiative.progress).toBeGreaterThanOrEqual(0)
  })

  it('rejects invalid snapshot schema', () => {
    expect(parseArmySnapshot('{}')).toBeNull()
    expect(parseArmySnapshot('{"schemaVersion":"0.0.0"}')).toBeNull()
  })

  it('saves and matchmakes ghost armies by power', () => {
    const low = exportArmySnapshot(createInitialGameState(0), 1)
    const state = createInitialGameState(0)
    for (let i = 0; i < 4; i++) {
      state.playerPieces.push(
        createPiece(`p${i}`, 'pawn', 'player', { file: i, rank: 1 }),
      )
    }
    const high = exportArmySnapshot(state, 2)
    saveGhostArmy(low, 'low')
    saveGhostArmy(high, 'high')

    const pick = selectGhostOpponent(high.powerScore)
    expect(pick?.snapshot.powerScore).toBe(high.powerScore)
  })
})

describe('pvpGhost AI', () => {
  it('prefers king shelter over pawn march', () => {
    const king = createPiece('pk', 'king', 'player', { file: 4, rank: 0 })
    const pawn = createPiece('pp', 'pawn', 'player', { file: 4, rank: 1 })
    const rook = createPiece('pr', 'rook', 'player', { file: 0, rank: 0 })
    const enemy = createPiece('ep', 'pawn', 'enemy', { file: 4, rank: 5 })

    const wave = selectBestMove(pawn, {
      allPieces: [king, pawn, rook, enemy],
      decreeStepEnabled: false,
      personality: 'aggressive',
      movingPiece: pawn,
      combatMode: 'wave',
    })

    const ghost = selectBestMove(pawn, {
      allPieces: [king, pawn, rook, enemy],
      decreeStepEnabled: false,
      personality: 'aggressive',
      movingPiece: pawn,
      combatMode: 'pvpGhost',
    })

    expect(wave?.to.rank).toBeGreaterThan(pawn.position.rank)
    expect(ghost?.to.rank ?? 0).toBeLessThanOrEqual(pawn.position.rank + 1)
  })
})
