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
})
