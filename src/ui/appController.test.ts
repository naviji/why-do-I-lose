import lichessPgn from '../../test/fixtures/api/lichess-kramford.pgn?raw'
import { get } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import { MemoryAnalysisRepo } from '../analysis/job'
import type { Engine } from '../engine/engine'
import { EngineLoadError } from '../engine/engine'
import { MemoryGameRepo } from '../import/importGames'
import type { HttpClient } from '../import/sources'
import { createAppController, type LabelStore } from './appController'
import type { ImportFilters } from './viewModel'

// The first ten games keep the run short.
const pgn = lichessPgn.split(/\n\n\n/).slice(0, 10).join('\n\n\n')
const http = (urls: string[] = []): HttpClient => ({
  async *stream(url) {
    urls.push(url)
    yield pgn
  },
  async json() {
    throw new Error('not used')
  },
})
// Every position is level and has no line, so no move is critical.
const flatEngine: Engine = {
  info: () => ({ name: 'Flat', version: '1' }),
  evaluate: async () => ({ score: { cp: 0 }, pv: [], depth: 1 }),
  dispose() {},
}
const memoryLabels = (): LabelStore => {
  let s: string[] = []
  return { load: () => new Set(s), save: ids => void (s = [...ids]) }
}
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 500 && !cond(); i++) await new Promise(r => setTimeout(r, 5))
  expect(cond()).toBe(true)
}

function setup(engine: Engine | EngineLoadError = flatEngine, urls: string[] = []) {
  const games = new MemoryGameRepo()
  const analyses = new MemoryAnalysisRepo()
  const app = createAppController({ http: http(urls), games, analyses, engine: async () => engine, labels: memoryLabels() })
  return { app, games, analyses }
}

describe('appController', () => {
  it('starts empty, with the Games panel open', () => {
    const { app } = setup()
    const s = get(app.state)
    expect(s.stats.games).toBe(0)
    expect(s.phase).toBe('idle')
    expect(s.panelOpen).toBe(true)
  })

  it('imports with the chosen filters, then analyzes every game', async () => {
    const urls: string[] = []
    const { app } = setup(flatEngine, urls)
    await app.importAndAnalyze('lichess', 'kramford', { speeds: ['blitz'], rated: 'rated', max: 20 })
    expect(urls[0]).toContain('perfType=blitz')
    expect(urls[0]).toContain('rated=true')
    expect(urls[0]).toContain('max=20')
    const s = get(app.state)
    expect(s.user).toEqual({ site: 'lichess', username: 'kramford' })
    expect(s.stats.games).toBeGreaterThan(0)
    expect(s.stats.wins + s.stats.draws + s.stats.losses).toBe(s.stats.games)
    expect(s.panelOpen).toBe(false)
    await until(() => get(app.state).phase === 'done')
    expect(get(app.state).stats.analyzed).toBeGreaterThan(0)
  })

  it('maps Chess.com Daily to correspondence', async () => {
    const seen: unknown[] = []
    const games = new MemoryGameRepo()
    const app = createAppController({
      http: { async *stream() {}, json: async url => (seen.push(url), { archives: [] }) as never },
      games, analyses: new MemoryAnalysisRepo(), engine: async () => flatEngine, labels: memoryLabels(),
    })
    await app.importAndAnalyze('chesscom', 'someone', { speeds: ['daily'], rated: 'all', max: null })
    expect(seen[0]).toContain('api.chess.com')
    await until(() => get(app.state).phase === 'done')
  })

  it('shows results from saved analyses and hides a removed label', async () => {
    const { app, games, analyses } = setup()
    await app.importAndAnalyze('lichess', 'kramford', defaultish)
    await until(() => get(app.state).phase === 'done')
    const [g] = await games.list()
    const ply = g.player === 'white' ? 1 : 2
    await analyses.put({
      gameId: g.id, engine: flatEngine.info(), settings: { depth: 1, nodes: 1, hashMb: 1 }, status: 'done',
      findings: [{ ply, played: g.moves[ply - 1], better: null, line: [], categories: ['fork'], winBefore: 50, winAfter: 10 }],
    })
    await app.refresh()
    const ranked = get(app.state).ranked
    const fork = ranked.find(r => r.category === 'fork')!
    expect(fork.games).toBe(1)
    app.removeLabel(fork.examples[0].id)
    expect(get(app.state).ranked.find(r => r.category === 'fork')).toBeUndefined()
  })

  it('restores an earlier visit with the panel folded', async () => {
    const { app, games, analyses } = setup()
    await app.importAndAnalyze('lichess', 'kramford', defaultish)
    await until(() => get(app.state).phase === 'done')
    const again = createAppController({ http: http(), games, analyses, engine: async () => flatEngine, labels: memoryLabels() })
    await again.restore()
    expect(get(again.state).stats.games).toBe(10)
    expect(get(again.state).panelOpen).toBe(false)
  })

  it('resumes analysis of unfinished games on restore, and lists each game with its status', async () => {
    const { app, games, analyses } = setup()
    await app.importAndAnalyze('lichess', 'kramford', defaultish)
    app.stop()
    await until(() => get(app.state).phase === 'done')
    const again = createAppController({ http: http(), games, analyses, engine: async () => flatEngine, labels: memoryLabels() })
    await again.restore()
    await until(() => get(again.state).phase === 'done')
    const queue = get(again.state).queue
    expect(queue.length).toBeGreaterThan(0)
    expect(queue.every(r => r.status === 'done')).toBe(true)
  })

  it('reports an engine that will not load, and keeps the games', async () => {
    const { app } = setup(new EngineLoadError('no wasm'))
    await app.importAndAnalyze('lichess', 'kramford', defaultish)
    await until(() => get(app.state).phase === 'done')
    expect(get(app.state).error).toBe('no wasm')
    expect(get(app.state).stats.games).toBeGreaterThan(0)
  })
})

const defaultish: ImportFilters = { speeds: [], rated: 'all', max: null }
