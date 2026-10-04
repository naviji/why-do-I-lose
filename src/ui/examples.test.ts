import { describe, expect, it } from 'vitest'
import type { GameAnalysis } from '../analysis/analyseGame'
import type { Game } from '../import/types'
import { examplesOf, filterByResult, visibleExamples } from './examples'

const game: Game = {
  id: 'lichess:abc', source: 'lichess', player: 'white', result: 'loss', termination: 'normal', speed: 'blitz',
  playedAt: 0, moves: ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'h5f7'], pgn: '',
}
const analysis = (findings: GameAnalysis['findings']): GameAnalysis => ({
  gameId: game.id, engine: { name: 'SF', version: '19' }, settings: { depth: 1, nodes: 1, hashMb: 1 }, status: 'done', findings,
})

describe('examplesOf', () => {
  it('makes one example per category of each finding, with the position before the move in SAN', () => {
    const ex = examplesOf(game, analysis([{ ply: 3, played: 'd1h5', better: 'g1f3', line: ['b8c6'], categories: ['hangingPiece', 'fork'] }]))
    expect(ex.map(e => e.category)).toEqual(['hangingPiece', 'fork'])
    expect(ex[0]).toMatchObject({
      gameId: 'lichess:abc', side: 'white', ply: 3, playedSan: 'Qh5', betterSan: 'Nf3', replySan: 'Nc6',
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', result: 'loss',
      gameUrl: 'https://lichess.org/abc/white#3',
    })
    expect(ex[0].id).not.toBe(ex[1].id)
  })
  it('explains the move in one line', () => {
    const [e] = examplesOf(game, analysis([{ ply: 3, played: 'd1h5', better: 'g1f3', line: ['b8c6'], categories: ['fork'] }]))
    expect(e.explanation).toBe('After Qh5 the opponent had Nc6. Better was Nf3.')
  })
  it('leaves out what it does not know', () => {
    const [e] = examplesOf(game, analysis([{ ply: 3, played: 'd1h5', better: null, line: [], categories: ['positionalMistake'] }]))
    expect(e.explanation).toBe('Qh5 was a mistake.')
  })
  it('has no game link for Chess.com', () => {
    const [e] = examplesOf({ ...game, id: 'chesscom:9', source: 'chesscom' }, analysis([{ ply: 3, played: 'd1h5', better: null, line: [], categories: ['x'] }]))
    expect(e.gameUrl).toBeNull()
  })
})

describe('filterByResult', () => {
  const ex = [{ result: 'win' }, { result: 'loss' }, { result: 'draw' }] as const
  it('keeps all or one result', () => {
    expect(filterByResult([...ex], 'all')).toHaveLength(3)
    expect(filterByResult([...ex], 'loss')).toEqual([{ result: 'loss' }])
  })
})

describe('visibleExamples', () => {
  it('drops removed labels', () => {
    const ex = examplesOf(game, analysis([{ ply: 3, played: 'd1h5', better: null, line: [], categories: ['a', 'b'] }]))
    expect(visibleExamples(ex, new Set([ex[0].id])).map(e => e.category)).toEqual(['b'])
  })
})
