import { describe, expect, it } from 'vitest'
import { parseSquare } from 'chessops/util'
import { ALL, Board } from './board'

const s = (name: string) => parseSquare(name)!

describe('Board', () => {
  it('lists castling once, as the king two-square move', () => {
    const moves = Board.fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1').legalMoves()
    const kingTo = moves.filter(m => m.from === s('e1')).map(m => m.to)
    expect(kingTo).toContain(s('g1'))
    expect(kingTo).toContain(s('c1'))
    expect(kingTo).not.toContain(s('h1'))
  })

  it('lists every promotion piece', () => {
    expect(Board.fromFen('8/P7/8/8/8/8/8/k6K w - - 0 1').legalMoves().filter(m => m.from === s('a7'))).toHaveLength(4)
  })

  it('returns the pin line for a pinned piece and ALL otherwise', () => {
    const b = Board.fromFen('4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1')
    expect(b.pin('white', s('e2')).has(s('e8'))).toBe(true)
    expect(b.pin('white', s('e2')).has(s('d2'))).toBe(false)
    expect(b.pin('white', s('e1')).equals(ALL)).toBe(true)
  })

  it('plays castling given as e1g1', () => {
    const b = Board.fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    b.push({ from: s('e1'), to: s('g1') })
    expect(b.pieceAt(s('g1'))?.role).toBe('king')
    expect(b.pieceAt(s('f1'))?.role).toBe('rook')
  })

  it('mirrors vertically and swaps colours', () => {
    expect(Board.fromFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1').mirror().fen()).toBe('4k3/4p3/8/8/8/8/8/4K3 b - - 0 1')
  })

  it('counts attackers of a colour', () => {
    const b = Board.fromFen('4k3/8/8/3p4/4P3/5N2/8/4K3 w - - 0 1')
    expect([...b.attackers('white', s('d5'))].sort()).toEqual([s('e4')])
  })
})
