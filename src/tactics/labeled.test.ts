// Naveen's approved verdicts on labeling batch 1 (kramford's losses, 2026-10-04):
// for each critical move, the categories the dashboard should show.
import { describe, expect, it } from 'vitest'
import { categories } from './categories'
import labeled from './fixtures/labeled-batch-1.json'
import { tagMove, type CriticalMove } from './tag'

describe('labeled batch 1', () => {
  it.each(labeled.map(r => [r.row, r] as const))('row %i', (_, r) => {
    expect(new Set(categories(tagMove(r as CriticalMove)))).toEqual(new Set(r.categories))
  })
})
