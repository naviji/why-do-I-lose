import { describe, expect, it } from 'vitest'
import { FakeEngine } from './fakeEngine'
import { DEFAULT_SETTINGS } from './engine'

const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const signal = new AbortController().signal

describe('FakeEngine', () => {
  it('answers from its table, ignoring move counters', async () => {
    const engine = new FakeEngine({ [start]: { score: { cp: 20 }, pv: ['e2e4'], depth: 18 } })
    expect(await engine.evaluate(start.replace(' 0 1', ' 3 9'), DEFAULT_SETTINGS, signal)).toEqual({ score: { cp: 20 }, pv: ['e2e4'], depth: 18 })
  })

  it('throws on a position the test did not list', async () => {
    await expect(new FakeEngine({}).evaluate(start, DEFAULT_SETTINGS, signal)).rejects.toThrow(/no scripted eval/)
  })

  it('rejects when aborted', async () => {
    const engine = new FakeEngine({ [start]: { score: { cp: 20 }, pv: [], depth: 1 } })
    const controller = new AbortController()
    controller.abort()
    await expect(engine.evaluate(start, DEFAULT_SETTINGS, controller.signal)).rejects.toThrow(/abort/i)
  })

  it('counts its searches', async () => {
    const engine = new FakeEngine({ [start]: { score: { cp: 20 }, pv: [], depth: 1 } })
    await engine.evaluate(start, DEFAULT_SETTINGS, signal)
    expect(engine.searches).toBe(1)
  })
})
