import { describe, expect, it } from 'vitest'
import { exposedKingLate } from './exposedKing'
import { make } from './puzzle'

describe('exposedKingLate', () => {
  it('flags a move that breaks the king cover when the opponent then checks', () => {
    // kramford game pmAU0EPW, move 14: gxh3 Qxh3 strips the g-pawn, then Qg3+ and Bxf2+
    const fen = 'r4rk1/p1pq1ppp/2pp1n2/4b3/1P2P3/P1NB3b/1BP2PP1/1R1Q1RK1 w - - 0 14'
    expect(exposedKingLate(make(fen, 'g2h3 d7h3 f2f4 e5d4 f1f2 h3g3 g1h1 d4f2 d1f1'))).toBe(true)
  })

  it('flags a check that captures the cover pawn itself', () => {
    // kramford game YSZRRxvx, move 19 (batch-1 row 11): h5 and then Rxg6+ takes the g6 pawn in front of Kg7
    const fen = 'rn1q1r2/1b2pnk1/p2p2p1/1pp5/4P2P/P1NP4/BPPQ1P2/R3K1R1 b Q - 0 19'
    expect(exposedKingLate(make(fen, 'f8g8 h4h5 b8d7 e1c1 c5c4 g1g6 g7f8 d3c4 d7f6 d1g1 d8c8 c4b5'))).toBe(true)
  })

  it('ignores a stripped cover when the opponent never checks', () => {
    // kramford game TGS5qDvX, move 24: …h5 gxh5 gxh5 opens the king, but White just invades with the rooks
    const fen = '4rr2/2p2pkp/p1p1pRp1/4P3/3P2PP/1PP5/P7/R5K1 b - - 0 24'
    expect(exposedKingLate(make(fen, 'h7h5 g4h5 g6h5 g1f2 f8h8 f2e3 g7f8 a1g1 f8e7 g1g7 h8f8'))).toBe(false)
  })

  it('ignores a king that walks away from its own cover', () => {
    // kramford game 8eIeHKS9, move 17: the king leaves its pawns (Kf8-e7) before the check
    const fen = 'r5k1/1p3pbp/p1n1r1p1/4p3/8/PN2BP2/1PPR2PP/2KR4 b - - 1 17'
    expect(exposedKingLate(make(fen, 'g8f8 d2d7 b7b5 b3c5 e6e7 d7e7 f8e7 e3g5 e7e8'))).toBe(false)
  })

  it('ignores an endgame, where open kings are normal', () => {
    // kramford game WF4X5jQO, move 35: rook ending, …Rxa2 Re1 lets a rook check through the open g-file
    const fen = '4r2k/p2R2p1/r5Pp/3p4/2pP1P2/5K2/PP6/7R b - - 0 35'
    expect(exposedKingLate(make(fen, 'a6a2 h1e1 e8c8 e1e7 a2b2 e7g7 b2b1 g7h7 h8g8'))).toBe(false)
  })

  it('ignores an endgame king that never had cover', () => {
    // kramford game Xjs85bVX, move 50: rook-and-bishop checks on a bare king
    const fen = '8/3b4/5k2/2pr1p1R/8/8/5K2/8 w - - 0 50'
    expect(exposedKingLate(make(fen, 'f2e3 f5f4 e3e4 d5h5 e4d3 d7b5 d3c3 f6g6 c3b2'))).toBe(false)
  })
})
