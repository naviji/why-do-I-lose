import { describe, expect, it } from 'vitest'
import { tagMove } from './tag'

const tag = (fen: string, move: string, line: string, cp = 300, better?: string) =>
  tagMove({ fen, move, line: line.split(' '), lineScore: { cp }, better })

describe('late losses and mate threats (when nothing else fires)', () => {
  it('flags a knight lost right after a queen trade', () => {
    // kramford game rpgIobQn, move 19: Qh7+ Qxh7 Nxh7 Kxh7
    expect(tag('r1b2rk1/pp3pq1/3p2pQ/6N1/1n2P3/1P1B4/P4PPP/R3R1K1 w - - 3 19', 'h6h7', 'g7h7 g5h7 g8h7 a1d1 b4d3 d1d3 c8e6 f2f4 a8c8 e1f1 e6d7')).toContain('hangingPiece')
  })

  it('flags a rook put on a diagonal and taken after a trade and a check', () => {
    // kramford game aBLGCEyn, move 25: Reb1 Nxc5 dxc5 Qc7+ Kh1 Bxb1
    expect(tag('rr4k1/1n2qp1b/2p1p2p/2Np2p1/3P2P1/PNP4P/4Q1PK/R3R3 w - - 1 25', 'e1b1', 'b7c5 d4c5 e7c7 h2h1 h7b1 a1b1 a8a7 b1f1 b8b3 c3c4 b3h3')).toContain('hangingPiece')
  })

  it('flags a knight that the king picks up two moves later', () => {
    // kramford game hsKRCxiW, move 46: Nc5+ Kc4 Rh8 Kxc5
    expect(tag('8/6k1/8/8/4nN2/1KP4r/RP6/8 b - - 0 46', 'e4c5', 'b3c4 h3h8 c4c5 g7f6 b2b4 h8c8 c5d4 c8g8 b4b5 f6e7 d4c4')).toContain('hangingPiece')
  })

  it('calls it a missed defence when the piece was already attacked', () => {
    // kramford game QMprjtF2, move 16: Be5 already hit the b8 rook; Qd5 Qxd5 Nxd5 Bxb8
    expect(tag('1rb2rk1/p2q1pbp/2p2np1/4B3/8/1N1B1Q2/PP3PPP/R4RK1 b - - 0 16', 'd7d5', 'f3d5 f6d5 e5b8 g7b2 a1e1 b2c3 e1c1 c3b2 c1d1 b2f6 b8g3')).toContain('defensiveMove')
  })

  it('flags a mate threat that costs material to stop', () => {
    // kramford game RRjFHbI7, move 18: g6 Bf6 threatens Qg7#
    expect(tag('r4rk1/pp3pp1/1qn1b3/2pp2B1/8/1P1P2Q1/P1P2PPP/R3R1K1 b - - 4 18', 'g7g6', 'g5f6 e6g4 g3g4 c6d4 g4h4 b6f6 h4f6 d4c2 a1b1 c2e1 b1e1', 592, 'c6d4')).toContain('mateThreat')
  })

  it('leaves a quiet worsening move positional', () => {
    // kramford game jhUHbnes, move 15: Rec8 e5 Ne8 f4, nothing lost
    expect(tag('r3rnk1/1p1qbpp1/p1p1bn1p/3p4/3PP3/2NB1P2/PPQ1NBPP/3R1RK1 b - - 0 15', 'e8c8', 'e4e5 f6e8 f3f4 g7g6 c3a4 d7d8 f4f5 g6f5 f2e3 e7g5 e3g5', 120)).toEqual(['quietMove'])
  })
})
