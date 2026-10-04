import { describe, expect, it } from 'vitest'
import type { Score } from '../core/winChance'
import { DEFAULT_SETTINGS, type EvalResult } from '../engine/engine'
import { FakeEngine } from '../engine/fakeEngine'
import { analyseGame, type AnalysisGame } from './analyseGame'
import recorded from './fixtures/baKAvOOX.json'

// kramford game baKAvOOX (black), every position searched by Stockfish 19 lite at depth 14
const table = recorded.evals as Record<string, EvalResult>
const fens = Object.keys(table)
/** The White-POV score after each ply, as Lichess puts in its PGN export. */
const lichessEvals: (Score | null)[] = fens.map(fen => {
  const s = table[fen]!.score
  const sign = fen.split(' ')[1] === 'w' ? 1 : -1
  return 'mate' in s ? { mate: sign * s.mate } : { cp: sign * s.cp }
})
const game: AnalysisGame = { id: recorded.id, player: recorded.player as 'black', moves: recorded.moves }
const signal = new AbortController().signal

describe('analyseGame', () => {
  it('finds the critical moves and tags them from the opponent line', async () => {
    const analysis = await analyseGame({ ...game, evals: lichessEvals }, new FakeEngine(table), DEFAULT_SETTINGS, signal)
    expect(analysis.status).toBe('done')
    expect(analysis.findings.map(f => [f.ply, f.played, f.better])).toEqual([
      [10, 'd8b6', table[fens[9]!]!.pv[0]],
      [16, recorded.moves[15], table[fens[15]!]!.pv[0]],
    ])
    expect(analysis.findings[0]!.line).toEqual(table[fens[10]!]!.pv)
    // Qb6 is the row 215 you approved as a positional mistake; Nh5 walks into a trap
    expect(analysis.findings.map(f => f.categories)).toEqual([['positionalMistake'], ['trappedPiece']])
  })

  it('with Lichess scores, searches only around each critical move', async () => {
    const engine = new FakeEngine(table)
    await analyseGame({ ...game, evals: lichessEvals }, engine, DEFAULT_SETTINGS, signal)
    expect(engine.searches).toBe(4) // before and after each of the 2 critical moves
  })

  it('without scores, searches every position and finds the same moves', async () => {
    const engine = new FakeEngine(table)
    const withScores = await analyseGame({ ...game, evals: lichessEvals }, new FakeEngine(table), DEFAULT_SETTINGS, signal)
    const without = await analyseGame(game, engine, DEFAULT_SETTINGS, signal)
    expect(without.findings).toEqual(withScores.findings)
    expect(engine.searches).toBe(fens.length) // every position, the start included
  })

  it('stops when aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(analyseGame(game, new FakeEngine(table), DEFAULT_SETTINGS, controller.signal)).rejects.toThrow(/abort/i)
  })
})
