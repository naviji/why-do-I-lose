import { describe, expect, it } from 'vitest'
import { hangingPawn } from './hangingPawn'
import { make } from './puzzle'

describe('hangingPawn', () => {
  it('flags a pawn left undefended and won in the line', () => {
    // kramford, move 12: Nef3 opens d6-f4 and Bxf4 wins the pawn
    const fen = 'r2qk2r/ppp3pp/3bpp2/3pNn2/3P1P2/2P5/PP1NKPPP/R2Q3R w kq - 0 12'
    expect(hangingPawn(make(fen, 'e5f3 d6f4 h1e1 d8d7 e2f1 e8g8 f1g1'))).toBe(true)
  })

  it('ignores a defended pawn', () => {
    // e4 is defended by d3, so Nxe4 dxe4 loses the knight
    expect(hangingPawn(make('4k3/8/8/8/4P3/3P2n1/8/4K3 w - - 0 1', 'e1d2 g3e4 d3e4'))).toBe(false)
  })

  it('ignores a pawn the line wins back', () => {
    // black takes e4, white takes a5 straight back
    expect(hangingPawn(make('4k3/8/8/p7/4P3/8/5n2/R3K3 w - - 0 1', 'e1e2 f2e4 a1a5'))).toBe(false)
  })

  it('ignores a recapture of equal value', () => {
    // exd5 Qxd5: a pawn for a pawn
    expect(hangingPawn(make('3qk3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', 'e4d5 d8d5 e1e2'))).toBe(false)
  })

  it('ignores a pawn taken while escaping check', () => {
    // d7+ Kxd7: the king has to deal with the check
    expect(hangingPawn(make('4k3/8/3P4/8/8/8/8/4K3 w - - 0 1', 'd6d7 e8d7'))).toBe(false)
  })

  it('flags a pawn won after a tempo move on a loose piece', () => {
    // kramford, move 18: Re8 lets Nc4 hit the a5 rook, Ra8, Nxb6 wins the pawn
    const fen = '2b2rk1/1p1p1pbp/1p2pnp1/rB6/3NP3/N1P2P2/PP4PP/R2R2K1 b - - 4 18'
    expect(hangingPawn(make(fen, 'f8e8 a3c4 a5a8 c4b6 a8b8 a2a4 e8d8 a4a5 d7d5 e4d5 f6d5'))).toBe(true)
  })

  it('flags a pawn won after a discovered threat', () => {
    // e5 uncovers the rook on h4, then Rxh4
    expect(hangingPawn(make('2k5/8/8/8/R3P2p/8/8/6K1 b - - 0 1', 'c8d8 e4e5 d8e7 a4h4 e7e6'))).toBe(true)
  })

  it('ignores a pawn won after a non-forcing move', () => {
    // Kh1 threatens nothing; the pawn is lost to the player's own later c4, not to m
    expect(hangingPawn(make('2k5/8/8/2p5/8/3P4/8/6K1 b - - 0 1', 'c8d8 g1h1 c5c4 d3c4 d8e7'))).toBe(false)
  })

  it('stops after more than two forcing moves', () => {
    // three checks before the capture: a long combination, not a hanging pawn
    expect(hangingPawn(make('k7/8/8/8/8/8/1p6/R5K1 b - - 0 1', 'a8b7 a1a7 b7b6 a7a6 b6b5 a6a5 b5b4 a5b5 b4c3 b5b2'))).toBe(false)
  })
})
