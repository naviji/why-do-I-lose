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
  /** Analyzable games with no analysis yet. */
  pending: number
  first?: number
  last?: number
  skipped: number
  unreadable: number
  lastSync?: number
}

/** The game being analyzed, as the progress line describes it. */
export type CurrentGame = Pick<Game, 'playedAt' | 'result' | 'player' | 'speed'>

export interface AppState {
  phase: 'idle' | 'importing' | 'analyzing' | 'done'
  user?: { site: Site; username: string }
  downloaded: number
  stats: Stats
  progress?: JobProgress
  currentGame?: CurrentGame
  resultFilter: ResultFilter
  ranked: Ranked<Example>[]
  panelOpen: boolean
  error?: string
}

export interface AppController {
  state: Readable<AppState>
  importAndAnalyze(site: Site, username: string, filters: ImportFilters): Promise<void>
  stop(): void
  /** Continues analyzing games left over after Stop. */
  resume(): Promise<void>
  refresh(): Promise<void>
  /** Shows an earlier visit's games and results, with the panel folded. */
  restore(): Promise<void>
  removeLabel(exampleId: string): void
  setResultFilter(f: ResultFilter): void
  setPanelOpen(open: boolean): void
}

const scored = (g: Game) => (g.evals?.length ? 0 : 1)

/** Games Lichess already scored go first, as they skip scoring every position; newest first within each. */
export const byPriority = (games: Game[]) => [...games].sort((a, b) => scored(a) - scored(b) || b.playedAt - a.playedAt)

const emptyStats = (): Stats => ({ games: 0, wins: 0, draws: 0, losses: 0, analyzed: 0, pending: 0, skipped: 0, unreadable: 0 })

export function createAppController(deps: {
  http: HttpClient
  games: GameRepo
  analyses: AnalysisRepo
  engine: () => Promise<Engine | EngineLoadError>
  labels: LabelStore
  now?: () => number
}): AppController {
  const now = deps.now ?? Date.now
  const state = writable<AppState>({ phase: 'idle', downloaded: 0, stats: emptyStats(), resultFilter: 'all', ranked: [], panelOpen: true })
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
    const analyzed = new Set(analyses.map(a => a.gameId))
    const pending = games.filter(g => isAnalyzable(g) && !analyzed.has(g.id)).length
    examples = analyses.flatMap(a => {
      const g = byId.get(a.gameId)
      return g ? examplesOf(g, a) : []
    })
    const times = games.map(g => g.playedAt)
    set({
      stats: {
        pending,
        games: games.length,
        wins: games.filter(g => g.result === 'win').length,
        draws: games.filter(g => g.result === 'draw').length,
        losses: games.filter(g => g.result === 'loss').length,
        analyzed: analyzed.size,
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
    const games = async (): Promise<AnalysisGame[]> => byPriority((await deps.games.list()).filter(isAnalyzable))
    job = createAnalysisJob({ games, analyses: deps.analyses, engine: await (engine ??= deps.engine()), settings: DEFAULT_SETTINGS })
    job.subscribe(p => {
      const g = p.current ? gamesById.get(p.current) : undefined
      live = g && p.step ? examplesOf(g, { gameId: g.id, findings: p.step.findings } as GameAnalysis) : []
      set({
        progress: p,
        ...(p.error ? { error: p.error } : {}),
        currentGame: g && { playedAt: g.playedAt, result: g.result, player: g.player, speed: g.speed },
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
      if (current().stats.pending > 0) await analyze()
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
    async resume() {
      if (current().phase !== 'analyzing') await analyze()
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
