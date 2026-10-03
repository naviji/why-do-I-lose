import { describe, expect, it } from 'vitest'
import { parseInfo } from './uci'

describe('parseInfo', () => {
  it('reads depth, centipawn score and pv', () => {
    expect(parseInfo('info depth 14 seldepth 26 multipv 1 score cp 7 nodes 99851 nps 372578 time 268 pv e7c6 d2c4 c6d4')).toEqual({
      depth: 14,
      score: { cp: 7 },
      pv: ['e7c6', 'd2c4', 'c6d4'],
    })
  })

  it('reads mate scores', () => {
    expect(parseInfo('info depth 20 score mate -3 nodes 10 pv a1a2 b1b2')).toEqual({
      depth: 20,
      score: { mate: -3 },
      pv: ['a1a2', 'b1b2'],
    })
  })

  it('ignores bound scores, which are not final', () => {
    expect(parseInfo('info depth 9 score cp 30 lowerbound nodes 5 pv e2e4')).toBeNull()
  })

  it('ignores info lines without a score or pv', () => {
    expect(parseInfo('info string NNUE evaluation enabled')).toBeNull()
    expect(parseInfo('info depth 3 currmove e2e4 currmovenumber 1')).toBeNull()
  })
})
