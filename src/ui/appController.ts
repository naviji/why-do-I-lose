// Ties import, analysis and the results list together for the one screen. Pure apart
// from the injected repos, HTTP client, engine loader and label store, so it runs in tests.
import { writable, type Readable } from 'svelte/store'
import type { AnalysisGame, GameAnalysis } from '../analysis/analyseGame'
import { isAnalyzable } from '../analysis/eligibility'
import { createAnalysisJob, type AnalysisJob, type AnalysisRepo, type JobProgress } from '../analysis/job'
import { DEFAULT_SETTINGS, EngineLoadError, type Engine } from '../engine/engine'
import { importGames, type GameRepo, type ImportReport } from '../import/importGames'
import type { Game } from '../import/types'
import { chesscomSource, lichessSource, type HttpClient, type SourceItem } from '../import/sources'
import type { Speed as ImportSpeed } from '../import/types'
import { examplesOf, filterByResult, visibleExamples, type Example, type ResultFilter } from './examples'
import { rankCategories, type ImportFilters, type Ranked, type Site } from './viewModel'

export interface LabelStore {
  load(): Set<string>
  save(ids: Set<string>): void
}

export interface Stats {
  games: number
  wins: number
  draws: number
  losses: number
  analyzed: number
  first?: number
  last?: number
  skipped: number
  unreadable: number
  lastSync?: number
}

export interface GameRow {
  id: string
  playedAt: number
  result: Game['result']
  player: Game['player']
  speed: Game['speed']
  url: string | null
  status: 'queued' | 'analyzing' | 'done' | 'failed'
  /** Mistakes found in this game (so far, while analyzing). */
  mistakes: number
}

export interface AppState {
  phase: 'idle' | 'importing' | 'analyzing' | 'done'
  user?: { site: Site; username: string }
  downloaded: number
  stats: Stats
  progress?: JobProgress
  /** Analyzable games, newest first, with where each one is. */
  queue: GameRow[]
  resultFilter: ResultFilter
  ranked: Ranked<Example>[]
  panelOpen: boolean
  error?: string
}

export interface AppController {
  state: Readable<AppState>
  importAndAnalyze(site: Site, username: string, filters: ImportFilters): Promise<void>
  stop(): void
  refresh(): Promise<void>
  /** Shows an earlier visit's games and results, with the panel folded. */
  restore(): Promise<void>
  removeLabel(exampleId: string): void
  setResultFilter(f: ResultFilter): void
  setPanelOpen(open: boolean): void
}

function gameUrl(id: string): string | null {
  const [source, key] = id.split(':')
  return source === 'lichess' ? `https://lichess.org/${key}` : null
}

const emptyStats = (): Stats => ({ games: 0, wins: 0, draws: 0, losses: 0, analyzed: 0, skipped: 0, unreadable: 0 })

export function createAppController(deps: {
  http: HttpClient
  games: GameRepo
  analyses: AnalysisRepo
  engine: () => Promise<Engine | EngineLoadError>
  labels: LabelStore
  now?: () => number
}): AppController {
  const now = deps.now ?? Date.now
  const state = writable<AppState>({ phase: 'idle', downloaded: 0, stats: emptyStats(), resultFilter: 'all', ranked: [], queue: [], panelOpen: true })
  const removed = deps.labels.load()
  let examples: Example[] = []
  /** Examples from the game being analyzed, shown before it finishes. */
  let live: Example[] = []
  let gamesById = new Map<string, Game>()
  let report: ImportReport | undefined
  let lastSync: number | undefined
  let job: AnalysisJob | undefined
  let importAbort: AbortController | undefined
  let engine: Promise<Engine | EngineLoadError> | undefined
  const set = (patch: Partial<AppState>) => state.update(s => ({ ...s, ...patch }))
  const current = () => {
    let s!: AppState
    state.subscribe(v => (s = v))()
    return s
  }

  function rerank() {
    const s = current()
    set({ ranked: rankCategories(filterByResult(visibleExamples([...examples, ...live], removed), s.resultFilter)) })
  }

  async function refresh() {
    const games = await deps.games.list()
    const byId = (gamesById = new Map(games.map(g => [g.id, g])))
    const analyses = await deps.analyses.list()
    const found = new Map<string, number>()
    for (const a of analyses) found.set(a.gameId, a.findings.length)
    const prev = new Map(current().queue.map(r => [r.id, r.status]))
    const queue: GameRow[] = games.filter(isAnalyzable).sort((a, b) => b.playedAt - a.playedAt).map(g => ({
      id: g.id, playedAt: g.playedAt, result: g.result, player: g.player, speed: g.speed, url: gameUrl(g.id),
      status: found.has(g.id) ? 'done' : prev.get(g.id) === 'failed' ? 'failed' : g.id === current().progress?.current ? 'analyzing' : 'queued',
      mistakes: found.get(g.id) ?? 0,
    }))
    examples = analyses.flatMap(a => {
      const g = byId.get(a.gameId)
      return g ? examplesOf(g, a) : []
    })
    const times = games.map(g => g.playedAt)
    set({
      queue,
      stats: {
        games: games.length,
        wins: games.filter(g => g.result === 'win').length,
        draws: games.filter(g => g.result === 'draw').length,
        losses: games.filter(g => g.result === 'loss').length,
        analyzed: new Set(analyses.map(a => a.gameId)).size,
        first: times.length ? Math.min(...times) : undefined,
        last: times.length ? Math.max(...times) : undefined,
        skipped: report?.unsupported ?? 0,
        unreadable: report?.malformed.length ?? 0,
        lastSync,
      },
    })
    rerank()
  }

  async function* counted(items: AsyncIterable<SourceItem>, signal: AbortSignal): AsyncIterable<SourceItem> {
    for await (const item of items) {
      if (signal.aborted) return
      if ('pgn' in item) set({ downloaded: current().downloaded + 1 })
      yield item
    }
  }

  async function analyze() {
    set({ phase: 'analyzing' })
    const games = async (): Promise<AnalysisGame[]> => (await deps.games.list()).filter(isAnalyzable)
      .sort((a, b) => b.playedAt - a.playedAt)
    job = createAnalysisJob({ games, analyses: deps.analyses, engine: await (engine ??= deps.engine()), settings: DEFAULT_SETTINGS })
    job.subscribe(p => {
      const g = p.current ? gamesById.get(p.current) : undefined
      live = g && p.step ? examplesOf(g, { gameId: g.id, findings: p.step.findings } as GameAnalysis) : []
      set({
        progress: p,
        ...(p.error ? { error: p.error } : {}),
        queue: current().queue.map(r =>
          r.id === p.finished?.gameId ? { ...r, status: p.finished.status }
          : r.id === p.current ? { ...r, status: 'analyzing', mistakes: p.step?.findings.length ?? 0 }
          : r.status === 'analyzing' ? { ...r, status: 'queued' } : r),
      })
      rerank()
      if (p.finished || !p.running) {
        live = []
        void refresh().then(() => { if (!p.running) set({ phase: 'done' }) })
      }
    })
    job.start()
  }

  return {
    state,
    refresh,
    async restore() {
      await refresh()
      if (current().stats.games > 0) set({ panelOpen: false })
      // Pick up where an earlier visit stopped.
      if (current().queue.some(r => r.status !== 'done')) await analyze()
      else if (current().stats.games > 0) set({ phase: 'done' })
    },
    async importAndAnalyze(site, username, filters) {
      job?.stop()
      importAbort = new AbortController()
      set({ phase: 'importing', user: { site, username }, downloaded: 0, error: undefined })
      const speeds = filters.speeds.map(s => (s === 'daily' ? 'correspondence' : s)) as ImportSpeed[]
      const f = { ...filters, speeds, max: filters.max ?? undefined }
      const source = site === 'lichess' ? lichessSource(username, deps.http, { filters: f }) : chesscomSource(username, deps.http, { filters: f })
      report = await importGames(counted(source, importAbort.signal), site, username, deps.games)
      lastSync = now()
      if (report.error) set({ error: report.error })
      await refresh()
      if (current().stats.games > 0) set({ panelOpen: false })
      await analyze()
    },
    stop() {
      importAbort?.abort()
      job?.stop()
    },
    removeLabel(id) {
      removed.add(id)
      deps.labels.save(removed)
      rerank()
    },
    setResultFilter(resultFilter) {
      set({ resultFilter })
      rerank()
    },
    setPanelOpen(panelOpen) {
      set({ panelOpen })
    },
  }
}
