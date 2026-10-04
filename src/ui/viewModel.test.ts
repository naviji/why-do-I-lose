import { describe, expect, it } from 'vitest'
import {
  analysisUrl, boardSquares, categoryName, defaultFilters, filterSummary, headline, puzzleUrl, rankCategories,
  speedsFor,
} from './viewModel'

describe('categoryName', () => {
  it('names cook.py tags and our own tags in plain words', () => {
    expect(categoryName('hangingPiece')).toBe('Hanging piece')
    expect(categoryName('defensiveMove')).toBe('Defensive move')
    expect(categoryName('positionalMistake')).toBe('Positional mistake')
    expect(categoryName('mate')).toBe('Mate')
  })
  it('falls back to splitting an unknown camelCase tag', () => {
    expect(categoryName('someNewTag')).toBe('Some new tag')
  })
})

describe('puzzleUrl', () => {
  it('links Lichess themes', () => {
    expect(puzzleUrl('fork')).toBe('https://lichess.org/training/fork')
  })
  it('has no link for our own categories', () => {
    expect(puzzleUrl('counting')).toBeNull()
    expect(puzzleUrl('hangingPawn')).toBeNull()
    expect(puzzleUrl('positionalMistake')).toBeNull()
  })
})

describe('speedsFor', () => {
  it('offers the time controls each site has, as openingtree does', () => {
    expect(speedsFor('lichess')).toEqual(['ultraBullet', 'bullet', 'blitz', 'rapid', 'classical', 'correspondence'])
    expect(speedsFor('chesscom')).toEqual(['bullet', 'blitz', 'rapid', 'daily'])
  })
})

describe('defaultFilters / filterSummary', () => {
  it('defaults to blitz, rapid and classical, all modes, the 500 newest games', () => {
    const f = defaultFilters()
    expect(f.speeds).toEqual(['blitz', 'rapid', 'classical'])
    expect(f.rated).toBe('all')
    expect(f.max).toBe(500)
    expect(filterSummary(f)).toBe('Blitz, Rapid, Classical · 500 newest')
  })
  it('mentions rated-only and no limit', () => {
    expect(filterSummary({ speeds: ['bullet'], rated: 'rated', max: null })).toBe('Bullet · rated · all games')
  })
})

describe('rankCategories', () => {
  const findings = [
    { gameId: 'a', category: 'fork' },
    { gameId: 'a', category: 'fork' },
    { gameId: 'b', category: 'fork' },
    { gameId: 'b', category: 'pin' },
    { gameId: 'c', category: 'mate' },
    { gameId: 'c', category: 'pin' },
  ]
  it('counts distinct games and ranks by them, ties by name', () => {
    expect(rankCategories(findings).map(c => [c.category, c.games])).toEqual([
      ['fork', 2], ['pin', 2], ['mate', 1],
    ])
  })
  it('keeps every example in game order', () => {
    expect(rankCategories(findings)[0].examples.length).toBe(3)
  })
})

describe('headline', () => {
  it('names the categories tied for first', () => {
    const ranked = [
      { category: 'defensiveMove', games: 12 }, { category: 'discoveredAttack', games: 12 },
      { category: 'hangingPawn', games: 12 }, { category: 'fork', games: 9 },
    ]
    expect(headline(ranked, 120)).toBe(
      'You most often miss a defensive move, allow a discovered attack, or hang a pawn: each in 12 of 120 analyzed games.')
  })
  it('handles a single leader', () => {
    expect(headline([{ category: 'fork', games: 5 }, { category: 'pin', games: 2 }], 38))
      .toBe('You most often allow a fork: 5 of 38 analyzed games.')
  })
  it('is null with no findings', () => {
    expect(headline([], 10)).toBeNull()
  })
})

describe('analysisUrl', () => {
  it('opens the position on the Lichess analysis board from the player side', () => {
    expect(analysisUrl('5rk1/p4r2/1p4p1/7p/3Bn3/R7/P3RPP1/5K2 b - - 1 31', 'black'))
      .toBe('https://lichess.org/analysis/5rk1/p4r2/1p4p1/7p/3Bn3/R7/P3RPP1/5K2_b_-_-_1_31?color=black')
  })
})

describe('boardSquares', () => {
  const fen = '5rk1/p4r2/1p4p1/7p/3Bn3/R7/P3RPP1/5K2 b - - 1 31'
  it('lists 64 squares from the top-left of the viewer', () => {
    const white = boardSquares(fen, 'white')
    expect(white).toHaveLength(64)
    expect(white[0].square).toBe('a8')
    expect(white[6]).toMatchObject({ square: 'g8', piece: { role: 'king', color: 'black' } })
    const black = boardSquares(fen, 'black')
    expect(black[0].square).toBe('h1')
    expect(black[63].square).toBe('a8')
  })
  it('marks light squares', () => {
    const sq = boardSquares(fen, 'white')
    expect(sq.find(s => s.square === 'a1')!.light).toBe(false)
    expect(sq.find(s => s.square === 'h1')!.light).toBe(true)
  })
})
