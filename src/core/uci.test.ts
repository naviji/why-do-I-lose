import { describe, expect, it } from 'vitest'
import { parseSan } from 'chessops/san'
import { positionFromFen } from './position'
import { standardUci } from './uci'

const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'

describe('standardUci', () => {
  it('writes castling as the king\'s two-square move, as engines expect', () => {
    const pos = positionFromFen(fen)
    expect(standardUci(pos, parseSan(pos, 'O-O')!)).toBe('e1g1')
    expect(standardUci(pos, parseSan(pos, 'O-O-O')!)).toBe('e1c1')
  })

  it('leaves other moves alone', () => {
    const pos = positionFromFen(fen)
    expect(standardUci(pos, parseSan(pos, 'Ra2')!)).toBe('a1a2')
  })
})
