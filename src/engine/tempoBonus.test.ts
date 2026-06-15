import { describe, expect, it } from 'vitest'
import { createPiece } from '@/types/game'
import { shouldGrantTempoBonus, applyTempoIntervalMult } from '@/engine/tempoBonus'

describe('tempoBonus', () => {
  it('grants tempo when capturing a telegraphed enemy', () => {
    const enemy = createPiece('e', 'pawn', 'enemy', { file: 3, rank: 6 })
    const ok = shouldGrantTempoBonus({
      telegraphedEnemyIds: ['e'],
      primaryTelegraphedId: 'e',
      move: {
        pieceId: 'k',
        from: { file: 4, rank: 0 },
        to: { file: 3, rank: 6 },
        capturedPieceId: 'e',
        isCapture: true,
      },
      combat: { captured: true, damageDealt: 5 },
      enemiesBefore: [enemy],
      manualOnly: true,
      isManualMove: true,
    })
    expect(ok).toBe(true)
  })

  it('shortens the next initiative interval', () => {
    expect(applyTempoIntervalMult(2000, 0.95)).toBe(1900)
  })
})
