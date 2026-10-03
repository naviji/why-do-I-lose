import { describe, expect, it } from 'vitest'
import { winPercent } from './winChance'

describe('winPercent', () => {
  it('is 50 for an equal position', () => {
    expect(winPercent({ cp: 0 }, 'white')).toBe(50)
  })

  it('matches the Lichess formula for a centipawn score', () => {
    // 50 + 50 * (2 / (1 + exp(-0.00368208 * 100)) - 1)
    expect(winPercent({ cp: 100 }, 'white')).toBeCloseTo(59.1, 1)
  })

  it('is mirrored for black', () => {
    expect(winPercent({ cp: 100 }, 'black')).toBeCloseTo(40.9, 1)
  })

  it('clamps centipawns to ±1000 like Lichess', () => {
    expect(winPercent({ cp: 5000 }, 'white')).toBe(winPercent({ cp: 1000 }, 'white'))
    expect(winPercent({ cp: -5000 }, 'white')).toBe(winPercent({ cp: -1000 }, 'white'))
  })

  it('treats mate as nearly certain, closer mates more so', () => {
    const m1 = winPercent({ mate: 1 }, 'white')
    const m10 = winPercent({ mate: 10 }, 'white')
    expect(m1).toBeGreaterThan(m10)
    expect(m10).toBeGreaterThan(winPercent({ cp: 1000 }, 'white'))
    expect(winPercent({ mate: -3 }, 'white')).toBeCloseTo(100 - winPercent({ mate: 3 }, 'white'), 10)
  })

  it('reads mate for black from the white-POV sign', () => {
    expect(winPercent({ mate: -2 }, 'black')).toBeCloseTo(winPercent({ mate: 2 }, 'white'), 10)
  })
})
