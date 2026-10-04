import { describe, expect, it } from 'vitest'
import { trimToGain } from './trim'

describe('trimToGain', () => {
  it('ends the line where the opponent has won the most material', () => {
    // kramford game 6EDJEDJU, move 11: Nxc3 drops the queen to Qxa5; the rest is mop-up
    const fen = 'Nn3k1r/pp2ppbp/4b1p1/q1Pp4/1Q2nB2/2P1P3/PP3PPP/R3KBNR b KQ - 4 11'
    const line = ['b4a5', 'b8c6', 'a5a3', 'c3e4', 'a8c7', 'g6g5', 'c7e6', 'f7e6', 'f4c7', 'h7h5', 'f1d3']
    expect(trimToGain(fen, 'e4c3', line)).toEqual(['b4a5'])
  })

  it('waits for the recapture before counting a capture as won', () => {
    // Nxd5 exd5 is even; the pawn falls only on the third move
    const line = ['c3d5', 'e6d5', 'a1a7', 'e7d6', 'a7b7', 'd6e5', 'b7b1']
    expect(trimToGain('4k3/1p6/4p3/3n4/8/2N5/8/R3K3 b Q - 0 1', 'e8e7', line)).toEqual(line.slice(0, 5))
  })

  it('keeps a line that wins no material', () => {
    expect(trimToGain('4k3/8/8/8/8/8/8/R3K3 b Q - 0 1', 'e8d8', ['a1a7', 'd8c8', 'e1d2'])).toEqual(['a1a7', 'd8c8', 'e1d2'])
  })

  it('keeps a line that ends in mate', () => {
    // a pawn grab on the way does not cut short the mating line
    const fen = '6k1/5ppp/8/8/8/8/p7/R5K1 b - - 0 1'
    expect(trimToGain(fen, 'g8f8', ['a1a2', 'f8g8', 'a2a8'])).toEqual(['a1a2', 'f8g8', 'a2a8'])
  })
})
