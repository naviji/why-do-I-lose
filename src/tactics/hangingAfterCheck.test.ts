import { describe, expect, it } from 'vitest'
import { hangingAfterCheck } from './hangingAfterCheck'
import { make } from './puzzle'

describe('hangingAfterCheck', () => {
  it('flags a loose piece taken right after an in-between check', () => {
    // kramford game YtiI9FAb, move 32: Rb4?? Qe8+ Qg8 axb4
    const fen = '7k/1p3qp1/p6p/6pP/6P1/P3Q3/1r3P2/4R1K1 b - - 5 32'
    expect(hangingAfterCheck(make(fen, 'b2b4 e3e8 f7g8 a3b4 b7b6 e8c6 a6a5'))).toBe(true)
  })

  it('ignores a check followed by taking a defended piece', () => {
    // the rook on b4 is defended by the knight on c6, so axb4 is a trade
    const fen = '7k/1p3qp1/p1n4p/6pP/6P1/P3Q3/1r3P2/4R1K1 b - - 5 32'
    expect(hangingAfterCheck(make(fen, 'b2b4 e3e8 f7g8 a3b4 c6b4'))).toBe(false)
  })
})
