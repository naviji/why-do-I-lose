import { describe, expect, it } from 'vitest'
import { missedTactic } from './missed'

describe('missedTactic', () => {
  it('finds the fork the player could have played', () => {
    // kramford game 0ApOEjfh, move 12: Bd3 instead of Qa4+, forking the king and the e4 knight
    const prevFen = 'r1bqk2r/1pp2pp1/2np3p/p2Pp3/4n3/2P2N2/PP2BPPP/R1BQ1RK1 b kq - 0 11'
    const better = 'd1a4 d8d7 a4e4 f7f5 e4b1 e7d5 c3c4 d5f6 c4c5'.split(' ')
    expect(missedTactic({ prevFen, prevMove: 'c6e7', betterLine: better })).toContain('fork')
  })

  it('finds the promotion behind a knight sacrifice', () => {
    // kramford game Y0EvZ34R, move 49: Kf2 instead of Nd3+ Nxd3 d7 and d8=Q
    const prevFen = '8/8/3P3p/p1N1nkp1/1p2P3/7P/8/6K1 b - - 0 48'
    const better = 'c5d3 e5d3 d6d7 b4b3 d7d8q f4e4 d8a5'.split(' ')
    expect(missedTactic({ prevFen, prevMove: 'f5f4', betterLine: better })).toContain('advancedPawn')
  })

  it('finds nothing when the better move only keeps the balance', () => {
    // kramford game TGS5qDvX, move 24: …c5 instead of …h5, no material won
    const prevFen = '4rr2/2p2pkp/p1p1pRp1/4P3/3P2P1/1PP5/P6P/R5K1 w - - 1 24'
    const better = 'c6c5 f6f4 e8d8 a1d1 h7h6 f4e4 d8d7'.split(' ')
    expect(missedTactic({ prevFen, prevMove: 'h2h4', betterLine: better })).toEqual([])
  })
})

describe('tagMove with a better line', () => {
  it('tags the Bd3 game as a fork instead of a positional mistake', async () => {
    const { tagMove } = await import('./tag')
    const tags = tagMove({
      fen: 'r1bqk2r/1pp1npp1/3p3p/p2Pp3/4n3/2P2N2/PP2BPPP/R1BQ1RK1 w kq - 1 12',
      move: 'e2d3',
      line: 'e4f6 d3b5 c8d7 b5d7 d8d7 c3c4 b7b5 b2b3 a5a4 c1e3 e8g8'.split(' '),
      lineScore: { cp: 280 },
      better: 'd1a4',
      betterLine: 'd1a4 d8d7 a4e4 f7f5 e4b1 e7d5 c3c4 d5f6 c4c5'.split(' '),
      prevFen: 'r1bqk2r/1pp2pp1/2np3p/p2Pp3/4n3/2P2N2/PP2BPPP/R1BQ1RK1 b kq - 0 11',
      prevMove: 'c6e7',
    })
    expect(tags).toContain('fork')
  })
})
