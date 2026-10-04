import { describe, expect, it } from 'vitest'
import { discoveredAttackOnPiece } from './discovered'
import { make } from './puzzle'

describe('discoveredAttackOnPiece', () => {
  it('flags an uncovered attack on the queen even when another piece wins it', () => {
    // kramford game Lgog8SkZ, move 20: fxg6 uncovers Rf2 on Qf6; the queen falls to Bxg6
    const fen = '1r1r2k1/p4pbp/bp4p1/2pPpP2/2P1B2q/4B1P1/PPQ2R1P/5RK1 b - - 0 20'
    expect(discoveredAttackOnPiece(make(fen, 'h4f6 f5g6 f6g6 e4g6 f7g6 c2e4 d8e8 e4h4'))).toBe(true)
  })

  it('ignores an uncovered attack on a defended, cheaper piece', () => {
    // e5 uncovers Ra4 on the knight h4, which is defended by g5 and worth less than the rook
    expect(discoveredAttackOnPiece(make('4k3/8/8/6p1/R3P2n/8/8/6K1 b - - 0 1', 'e8d8 e4e5 d8e7'))).toBe(false)
  })

  it('ignores an uncovered attack that costs nothing', () => {
    // e5 uncovers Ra4 on the queen, but the queen simply steps away
    expect(discoveredAttackOnPiece(make('4k3/8/8/8/R3P2q/8/8/6K1 b - - 0 1', 'e8d8 e4e5 h4h5 g1g2 h5e5'))).toBe(false)
  })
})
