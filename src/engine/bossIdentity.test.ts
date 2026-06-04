import { describe, expect, it } from 'vitest'

import {
  generateBossWaveKinds,
  isBossPieceKind,
  resolveBossIdentity,
} from '@/engine/bossIdentity'

describe('bossIdentity', () => {
  it('maps milestone stages to catalog bosses', () => {
    expect(resolveBossIdentity(10)).toBe('enPassantPhantom')
    expect(resolveBossIdentity(15)).toBe('bishopPair')
    expect(resolveBossIdentity(60)).toBe('endlessOverlord')
    expect(resolveBossIdentity(7)).toBeNull()
  })

  it('stage 10 wave leads with phantom knight boss', () => {
    const kinds = generateBossWaveKinds(10, 5)!
    expect(kinds[0]).toBe('knight')
    expect(isBossPieceKind('enPassantPhantom', 'knight', 0)).toBe(true)
    expect(isBossPieceKind('enPassantPhantom', 'pawn', 1)).toBe(false)
  })
})
