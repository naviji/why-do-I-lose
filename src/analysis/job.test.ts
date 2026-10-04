import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, EngineLoadError, type Engine, type EvalResult } from '../engine/engine'
import { FakeEngine } from '../engine/fakeEngine'
import type { AnalysisGame } from './analyseGame'
import { createAnalysisJob, MemoryAnalysisRepo, type JobProgress } from './job'
import recorded from './fixtures/baKAvOOX.json'

const table = recorded.evals as Record<string, EvalResult>
const games: AnalysisGame[] = ['a', 'b', 'c'].map(id => ({ id, player: 'black', moves: recorded.moves }))

/** Waits until the job reports it has finished or stopped. */
const finished = (updates: JobProgress[]) =>
  new Promise<JobProgress>(resolve => {
    const check = setInterval(() => {
      const last = updates.at(-1)
      if (last && !last.running) {
        clearInterval(check)
        resolve(last)
      }
    }, 1)
  })

describe('analysis job', () => {
  it('analyses every game and reports progress', async () => {
    const analyses = new MemoryAnalysisRepo()
    const updates: JobProgress[] = []
    const job = createAnalysisJob({ games: async () => games, analyses, engine: new FakeEngine(table), settings: DEFAULT_SETTINGS })
    job.subscribe(p => updates.push(p))
    job.start()
    const last = await finished(updates)
    expect(last).toMatchObject({ done: 3, eligible: 3, running: false })
    expect((await analyses.list()).map(a => a.gameId)).toEqual(['a', 'b', 'c'])
  })

  it('stopping keeps finished games, and starting again skips them', async () => {
    const analyses = new MemoryAnalysisRepo()
    const engine = new FakeEngine(table)
    const updates: JobProgress[] = []
    const job = createAnalysisJob({ games: async () => games, analyses, engine, settings: DEFAULT_SETTINGS })
    let stopped = false
    job.subscribe(p => {
      updates.push(p)
      if (!stopped && p.done === 1 && p.running) {
        stopped = true
        job.stop() // part-way through the second game
      }
    })
    job.start()
    await finished(updates)
    expect((await analyses.list()).map(a => a.gameId)).toEqual(['a'])

    const searchesBefore = engine.searches
    updates.length = 0
    job.start()
    expect(await finished(updates)).toMatchObject({ done: 3, eligible: 3 })
    expect((await analyses.list()).map(a => a.gameId)).toEqual(['a', 'b', 'c'])
    // b and c only: all positions each, then a full search either side of each critical move
    const critical = (await analyses.list())[1]!.findings.length
    expect(engine.searches - searchesBefore).toBe(2 * (recorded.moves.length + 1 + 2 * critical))
  })

  it('reanalyses a game when the engine settings change', async () => {
    const analyses = new MemoryAnalysisRepo()
    const run = async (depth: number) => {
      const updates: JobProgress[] = []
      const job = createAnalysisJob({ games: async () => games.slice(0, 1), analyses, engine: new FakeEngine(table), settings: { ...DEFAULT_SETTINGS, depth } })
      job.subscribe(p => updates.push(p))
      job.start()
      return finished(updates)
    }
    await run(18)
    await run(20)
    expect((await analyses.list()).map(a => a.settings.depth).sort()).toEqual([18, 20])
  })

  it('reports an engine that failed to load, without throwing', async () => {
    const updates: JobProgress[] = []
    const job = createAnalysisJob({ games: async () => games, analyses: new MemoryAnalysisRepo(), engine: new EngineLoadError('no WebAssembly'), settings: DEFAULT_SETTINGS })
    job.subscribe(p => updates.push(p))
    job.start()
    expect(await finished(updates)).toMatchObject({ done: 0, running: false, error: 'no WebAssembly' })
  })

  it('records a failed game and carries on', async () => {
    const broken: Engine = new FakeEngine({})
    const analyses = new MemoryAnalysisRepo()
    const updates: JobProgress[] = []
    const job = createAnalysisJob({ games: async () => games.slice(0, 2), analyses, engine: broken, settings: DEFAULT_SETTINGS })
    job.subscribe(p => updates.push(p))
    job.start()
    expect(await finished(updates)).toMatchObject({ done: 2, failed: 2, running: false })
  })
})
