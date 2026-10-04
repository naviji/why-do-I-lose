import { describe, expect, it } from 'vitest'
import lichess from '../../test/fixtures/api/lichess-kramford.pgn?raw'
import { normalize, splitPgn } from '../import/normalize'
import { isAnalyzable } from './eligibility'

const games = splitPgn(lichess).map(p => normalize(p, 'kramford', 'lichess')).flatMap(r => (r.kind === 'ok' ? [r.game] : []))

describe('isAnalyzable', () => {
  it('takes wins and draws as well as losses', () => {
    const picked = games.filter(isAnalyzable)
    expect(new Set(picked.map(g => g.result))).toEqual(new Set(['win', 'loss', 'draw']))
  })

  it('skips a game with fewer than two moves each', () => {
    expect(isAnalyzable({ ...games[0]!, moves: ['e2e4', 'e7e5'] })).toBe(false)
  })
})
