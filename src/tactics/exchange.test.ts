import { describe, expect, it } from 'vitest'
import { parseUci } from 'chessops/util'
import { Board, type Move } from './board'
import { see, counting } from './exchange'

const mv = (uci: string) => parseUci(uci) as Move

describe('see (static exchange evaluation)', () => {
  it('wins the full value of an undefended piece', () => {
    expect(see(Board.fromFen('4k3/8/8/3n4/4P3/8/8/4K3 w - - 0 1'), mv('e4d5'))).toBe(3)
  })

  it('pawn takes a defended knight: still +2', () => {
    expect(see(Board.fromFen('4k3/8/4p3/3n4/4P3/8/8/4K3 w - - 0 1'), mv('e4d5'))).toBe(2)
  })

  it('knight takes a pawn defended by the queen: -2', () => {
    expect(see(Board.fromFen('4k3/2q5/8/2p5/4N3/8/8/4K3 w - - 0 1'), mv('e4c5'))).toBe(-2)
  })

  it('counts a recapture through an x-ray', () => {
    // Rxd5 exd5? no: rook takes defended pawn, black recaptures, white's second rook recaptures
    expect(see(Board.fromFen('3r2k1/8/8/3p4/8/8/3R4/3RK3 w - - 0 1'), mv('d2d5'))).toBe(1 - 5 + 5)
  })

  it('stops when continuing would lose more', () => {
    // queen takes a pawn defended by a pawn: the queen is lost, -8
    expect(see(Board.fromFen('4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1'), mv('d1d5'))).toBe(1 - 9)
  })

  it('handles en passant', () => {
    expect(see(Board.fromFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'), mv('e5d6'))).toBe(1)
  })
})

describe('counting: the player starts the exchange', () => {
  // kramford game UIY0uNdT, move 24: Nxc5 Qxc5 Bxf7+ Kh8, a knight for two pawns
  const fen = '3b1rk1/2q2ppp/1n6/2p1p3/1p2N3/1B1PPQ2/1PP3P1/5RK1 w - - 2 24'

  it('flags a capture that loses material in the engine line', () => {
    expect(counting({ fen, move: 'e4c5', line: ['c7c5', 'b3f7', 'g8h8', 'f3e4', 'b6d7', 'd3d4', 'e5d4', 'e3d4'] })).toEqual({
      square: 'c5',
      see: -2,
      materialLost: 1,
      by: 'player',
    })
  })

  it('ignores a non-capture', () => {
    expect(counting({ fen, move: 'g2g4', line: ['c7c6'] })).toBeNull()
  })

  it('ignores an even trade', () => {
    expect(
      counting({ fen: '4k3/8/4p3/3n4/8/2N5/8/4K3 w - - 0 1', move: 'c3d5', line: ['e6d5'] }),
    ).toBeNull()
  })

  it('ignores a losing count the engine line never cashes in', () => {
    // Nxc5 is -2 on the square, but it uncovers check from the rook, so the queen can't recapture
    expect(counting({ fen: '4k3/2q5/8/2p5/4N3/8/8/4RK2 w - - 0 1', move: 'e4c5', line: ['e8d8'] })).toBeNull()
  })
})

describe('counting: the opponent starts the exchange', () => {
  // kramford game L4uuQv4z, move 18: e6 drops a defender of f6, Bxf6 Bxf6 Qxf6 wins the knight
  const fen = '2r1r1k1/3qppbp/p1n2np1/1p4B1/1N1P4/P1P2Q1P/BP3PP1/R3R1K1 b - - 1 18'

  it('flags a defended piece the opponent wins on the count', () => {
    expect(counting({ fen, move: 'e7e6', line: ['g5f6', 'g7f6', 'f3f6', 'a6a5', 'b4d3', 'b5b4', 'd3c5'] })).toEqual({
      square: 'f6',
      see: 3,
      materialLost: 3,
      by: 'opponent',
    })
  })

  it('leaves an undefended piece to hanging piece', () => {
    // Nd5 has no defender at all
    expect(counting({ fen: '4k3/8/8/3n4/8/2N5/8/4K3 b - - 0 1', move: 'e8e7', line: ['c3d5', 'e7d6'] })).toBeNull()
  })

  it('ignores an even trade', () => {
    // Nxd5 exd5: knight for knight
    expect(counting({ fen: '4k3/8/4p3/3n4/8/2N5/8/4K3 b - - 0 1', move: 'e8e7', line: ['c3d5', 'e6d5'] })).toBeNull()
  })

  it('ignores the recapture of a piece the player just took', () => {
    // Nxd5 Nxd5 is a trade the player started; the first describe covers it
    expect(counting({ fen: '4k3/8/8/3N4/8/2N1n3/8/4K3 b - - 0 1', move: 'e3d5', line: ['c3d5', 'e8d7'] })).toBeNull()
  })
})
