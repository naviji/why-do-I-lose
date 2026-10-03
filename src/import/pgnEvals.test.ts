import { describe, expect, it } from 'vitest'
import { parsePgn } from 'chessops/pgn'
import { evalsFromPgn } from './pgnEvals'

const game = (movetext: string) => parsePgn(`[Event "x"]\n\n${movetext}`)[0]!

describe('evalsFromPgn', () => {
  it('reads one White-POV score per ply, with the start position unknown', () => {
    const g = game('1. e4 { [%eval 0.18] [%clk 0:05:00] } 1... c5 { [%eval -1.5] } *')
    expect(evalsFromPgn(g)).toEqual([null, { cp: 18 }, { cp: -150 }])
  })

  it('reads mate scores', () => {
    const g = game('1. e4 { [%eval #3] } 1... e5 { [%eval #-2] } *')
    expect(evalsFromPgn(g)).toEqual([null, { mate: 3 }, { mate: -2 }])
  })

  it('leaves plies without an eval as null', () => {
    const g = game('1. e4 { [%clk 0:05:00] } 1... e5 *')
    expect(evalsFromPgn(g)).toEqual([null, null, null])
  })
})
