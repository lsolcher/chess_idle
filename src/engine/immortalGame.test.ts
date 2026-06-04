import { describe, expect, it } from 'vitest'

import {
  consumeRevivalFlashAction,
  getRevivalFlashApMult,
  REVIVAL_FLASH_AP_MULT,
  tryImmortalRevive,
} from '@/engine/immortalGame'
import { createPiece } from '@/types/game'

describe('immortalGame', () => {
  it('revives with revival flash charges', () => {
    const pawn = createPiece('p1', 'pawn', 'player', { file: 0, rank: 1 })
    const { pieces, used } = tryImmortalRevive([pawn], [], 'p1', true, false, 1000)
    expect(used).toBe(true)
    expect(pieces[0]?.revivalFlash?.actionsRemaining).toBe(3)
    expect(pieces[0]?.stats.hp).toBeGreaterThan(0)
  })

  it('applies and consumes revival flash AP mult', () => {
    let pawn = createPiece('p2', 'pawn', 'player', { file: 1, rank: 1 })
    pawn = { ...pawn, revivalFlash: { actionsRemaining: 2 } }
    expect(getRevivalFlashApMult(pawn)).toBe(REVIVAL_FLASH_AP_MULT)
    const after = consumeRevivalFlashAction(pawn)
    expect(after.revivalFlash?.actionsRemaining).toBe(1)
  })
})
