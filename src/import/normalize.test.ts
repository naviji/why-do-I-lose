import lichess from '../../test/fixtures/api/lichess-kramford.pgn?raw'
import { describe, expect, it } from 'vitest'
import { normalize, normalizePgn, speedOf, splitPgn } from './normalize'

const games = splitPgn(lichess)

describe('splitPgn (ported from openingtree)', () => {
  it('splits a Lichess export into its games', () => {
    expect(games).toHaveLength(200)
  })

  it('splits games separated by a single blank line, and joins a result on its own line', () => {
    const text = '[Event "a"]\n\n1. e4 e5\n0-1\n\n[Event "b"]\r\n\r\n1. d4 1-0\n'
    expect(splitPgn(text)).toEqual(['[Event "a"]\n\n1. e4 e5 0-1', '[Event "b"]\n\n1. d4 1-0'])
  })

  it('drops ; comment lines', () => {
    expect(normalizePgn('; exported\n[Event "a"]')).toBe('\n[Event "a"]')
  })
})

describe('normalize', () => {
  it('reads a Lichess loss with scores and clocks', () => {
    const pgn = games.find(g => g.includes('lichess.org/baKAvOOX'))!
    const r = normalize(pgn, 'kramford', 'lichess')
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.game).toMatchObject({ id: 'lichess:baKAvOOX', source: 'lichess', player: 'black', result: 'loss', speed: 'blitz' })
    expect(r.game.moves.slice(0, 2)).toEqual(['e2e4', 'c7c5'])
    expect(r.game.evals).toHaveLength(r.game.moves.length + 1)
    expect(r.game.clocks![0]).toBe(300)
  })

  it('matches the player case-insensitively and reads a win and time forfeit', () => {
    const r = normalize(games[0]!, 'KRAMFORD', 'lichess')
    expect(r.kind === 'ok' && r.game).toMatchObject({ player: 'black', result: 'win', termination: 'time' })
  })

  it('writes castling as e1g1', () => {
    const r = normalize(games[0]!, 'kramford', 'lichess')
    expect(r.kind === 'ok' && r.game.moves[8]).toBe('e1g1') // 5. O-O
  })

  it('marks games from a set position as unsupported', () => {
    const pgn = games.find(g => g.includes('[Variant "From Position"]'))!
    expect(normalize(pgn, 'kramford', 'lichess')).toMatchObject({ kind: 'unsupported' })
  })

  it('marks a game the user did not play as unsupported', () => {
    expect(normalize(games[0]!, 'someone-else', 'lichess')).toMatchObject({ kind: 'unsupported' })
  })

  it('marks an unfinished game as unsupported', () => {
    const pgn = '[White "kramford"]\n[Black "x"]\n[Result "*"]\n\n1. e4 *'
    expect(normalize(pgn, 'kramford', 'pgn')).toMatchObject({ kind: 'unsupported' })
  })

  it('reports an illegal move as malformed', () => {
    const pgn = '[White "kramford"]\n[Black "x"]\n[Result "0-1"]\n\n1. e5 0-1'
    expect(normalize(pgn, 'kramford', 'pgn')).toMatchObject({ kind: 'malformed' })
  })

  it('gives a PGN game the same id whatever the spacing and extra headers', () => {
    const a = normalize('[White "kramford"]\n[Black "x"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1', 'kramford', 'pgn')
    const b = normalize('[Event "?"]\n[White "kramford"]\n[Black "x"]\n[Result "0-1"]\n\n1.f3 e5\n2.g4 Qh4# 0-1', 'kramford', 'pgn')
    expect(a.kind === 'ok' && b.kind === 'ok' && a.game.id === b.game.id && a.game.id.startsWith('pgn:')).toBe(true)
  })

  it('counts the losses in the export', () => {
    const losses = games.map(g => normalize(g, 'kramford', 'lichess')).filter(r => r.kind === 'ok' && r.game.result === 'loss')
    expect(losses).toHaveLength(82)
    expect(losses.filter(r => r.kind === 'ok' && r.game.evals)).toHaveLength(72)
  })
})

describe('speedOf (ported from openingtree)', () => {
  it.each([
    ['15+0', 'ultraBullet'],
    ['60+0', 'bullet'],
    ['300+3', 'blitz'],
    ['600+5', 'rapid'],
    ['1800+0', 'classical'],
    ['-', 'correspondence'],
  ])('%s is %s', (tc, speed) => expect(speedOf(tc)).toBe(speed))
})
