import { describe, expect, it } from 'vitest'
import { criticalEpisodes, DEFAULT_THRESHOLD } from './criticalMoves'
import type { Score } from './winChance'

// evals[i] is the white-POV score after ply i; evals[0] is the start position.
const cp = (n: number): Score => ({ cp: n })

describe('criticalEpisodes', () => {
  it('finds nothing in a steady game', () => {
    expect(criticalEpisodes([cp(20), cp(30), cp(10), cp(25)], 'white')).toEqual([])
  })

  it('flags a player move whose win chance drops more than the threshold', () => {
    // white's 2nd move (ply 3) drops from +30 to -300
    const evals = [cp(20), cp(30), cp(20), cp(-300), cp(-310)]
    expect(criticalEpisodes(evals, 'white')).toEqual([{ firstPly: 3, plies: [3] }])
  })

  it('ignores the opponent\'s bad moves', () => {
    const evals = [cp(20), cp(30), cp(400), cp(410)]
    expect(criticalEpisodes(evals, 'white')).toEqual([])
  })

  it('works for black', () => {
    // black's 1st move (ply 2) drops from -30 (white POV) to +300
    const evals = [cp(20), cp(-30), cp(300)]
    expect(criticalEpisodes(evals, 'black')).toEqual([{ firstPly: 2, plies: [2] }])
  })

  it('flags a drop just above the threshold but not one exactly at it', () => {
    // black's move (ply 2) takes the eval from 0 to +100 (white POV)
    const evals = [cp(0), cp(0), cp(100)]
    const drop = 50 - (50 - 50 * (2 / (1 + Math.exp(-0.00368208 * 100)) - 1))
    expect(criticalEpisodes(evals, 'black', drop, 100)).toEqual([])
    expect(criticalEpisodes(evals, 'black', drop - 0.01, 100)).toEqual([{ firstPly: 2, plies: [2] }])
  })

  it('merges consecutive critical player moves into one episode', () => {
    // white blunders at ply 1 and again at ply 3
    const evals = [cp(20), cp(-300), cp(-300), cp(-700), cp(-700)]
    expect(criticalEpisodes(evals, 'white')).toEqual([{ firstPly: 1, plies: [1, 3] }])
  })

  it('splits episodes when a player move in between is not critical', () => {
    const evals = [cp(20), cp(-300), cp(-300), cp(-290), cp(-290), cp(-800)]
    expect(criticalEpisodes(evals, 'white')).toEqual([
      { firstPly: 1, plies: [1] },
      { firstPly: 5, plies: [5] },
    ])
  })

  it('skips moves whose eval before or after is missing', () => {
    const evals = [null, cp(-300), cp(-300), null, cp(-900)]
    expect(criticalEpisodes(evals, 'white')).toEqual([])
  })

  it('handles mate scores', () => {
    const evals = [cp(0), cp(0), cp(0), { mate: -1 }]
    expect(criticalEpisodes(evals, 'white')).toEqual([{ firstPly: 3, plies: [3] }])
  })

  it('ignores a big drop that still leaves the player above the losing line', () => {
    // +130 -> -20: about 62% -> 48%, a 14-point drop, but not losing
    const evals = [cp(20), cp(130), cp(130), cp(-20)]
    expect(criticalEpisodes(evals, 'white')).toEqual([])
  })

  it('flags a drop that ends below the losing line', () => {
    // -20 -> -300: about 48% -> 25%
    const evals = [cp(20), cp(-20), cp(-20), cp(-300)]
    expect(criticalEpisodes(evals, 'white')).toEqual([{ firstPly: 3, plies: [3] }])
  })

  it('lets callers change the losing line', () => {
    const evals = [cp(20), cp(130), cp(130), cp(-20)]
    expect(criticalEpisodes(evals, 'white', DEFAULT_THRESHOLD, 50)).toEqual([{ firstPly: 3, plies: [3] }])
  })
})
