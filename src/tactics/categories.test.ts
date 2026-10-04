import { describe, expect, it } from 'vitest'
import { categories } from './categories'

describe('categories', () => {
  it('keeps motif tags and drops context tags', () => {
    expect(categories(['quietMove', 'fork', 'castling'])).toEqual(['fork'])
  })

  it('calls a critical move with no motif a positional mistake', () => {
    expect(categories(['quietMove', 'castling'])).toEqual(['positionalMistake'])
  })

  it('keeps pawn endgame as a category', () => {
    expect(categories(['pawnEndgame'])).toEqual(['pawnEndgame'])
  })
})
