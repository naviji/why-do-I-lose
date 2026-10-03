import { describe, expect, it } from 'vitest'
import { positionFromFen } from './position'

describe('positionFromFen', () => {
  it('parses the standard start position', () => {
    const pos = positionFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(pos.turn).toBe('white')
  })

  it('throws on an invalid FEN', () => {
    expect(() => positionFromFen('not a fen')).toThrow()
  })
})
