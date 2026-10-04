// Runs analyseGame over many games, one at a time, with Stop and Resume. Finished
// games are saved as they complete; stopping discards only the game in progress, and
// starting again skips games already analysed with the same engine and settings.
import { EngineLoadError, type Engine, type EngineInfo, type EngineSettings } from '../engine/engine'
import { analyseGame, type AnalysisGame, type GameAnalysis, type GameStep } from './analyseGame'

export interface AnalysisRepo {
  put(analysis: GameAnalysis): Promise<void>
  get(gameId: string, engine: EngineInfo, settings: EngineSettings): Promise<GameAnalysis | undefined>
  list(): Promise<GameAnalysis[]>
}

export const analysisKey = (gameId: string, engine: EngineInfo, settings: EngineSettings) =>
  JSON.stringify([gameId, engine.name, engine.version, settings.depth, settings.nodes])

export class MemoryAnalysisRepo implements AnalysisRepo {
  private readonly rows = new Map<string, GameAnalysis>()
  async put(a: GameAnalysis) {
    this.rows.set(analysisKey(a.gameId, a.engine, a.settings), a)
  }
  async get(gameId: string, engine: EngineInfo, settings: EngineSettings) {
    return this.rows.get(analysisKey(gameId, engine, settings))
  }
  async list() {
    return [...this.rows.values()]
  }
}

export interface JobProgress {
  running: boolean
  /** Games finished, including ones already analysed earlier and ones that failed. */
  done: number
  failed: number
  eligible: number
  current?: string
  /** How far the current game has got, with its findings so far. */
  step?: GameStep
  /** The game that just finished in this emit, and how. */
  finished?: { gameId: string; status: 'done' | 'failed' }
  error?: string
}

export interface AnalysisJob {
  start(): void
  stop(): void
  subscribe(listener: (p: JobProgress) => void): () => void
}

export function createAnalysisJob(deps: {
  games: () => Promise<AnalysisGame[]>
  analyses: AnalysisRepo
  engine: Engine | EngineLoadError
  settings: EngineSettings
}): AnalysisJob {
  const listeners = new Set<(p: JobProgress) => void>()
  let controller: AbortController | null = null
  const emit = (p: JobProgress) => listeners.forEach(l => l(p))

  async function run(signal: AbortSignal) {
    const { engine, settings, analyses } = deps
    if (engine instanceof EngineLoadError) return emit({ running: false, done: 0, failed: 0, eligible: 0, error: engine.message })
    const games = await deps.games()
    const progress: JobProgress = { running: true, done: 0, failed: 0, eligible: games.length }
    for (const game of games) {
      if (signal.aborted) break
      if (!(await analyses.get(game.id, engine.info(), settings))) {
        emit({ ...progress, current: game.id })
        try {
          await analyses.put(await analyseGame(game, engine, settings, signal, step => emit({ ...progress, current: game.id, step })))
          progress.done++
          emit({ ...progress, finished: { gameId: game.id, status: 'done' } })
        } catch (e) {
          if (signal.aborted) break // the stopped game is discarded
          progress.failed++
          progress.done++
          emit({ ...progress, finished: { gameId: game.id, status: 'failed' } })
        }
        continue
      }
      progress.done++
      emit({ ...progress, finished: { gameId: game.id, status: 'done' } })
    }
    emit({ ...progress, running: false, current: undefined })
  }

  return {
    start() {
      if (controller) return
      const c = (controller = new AbortController())
      void run(c.signal).finally(() => {
        if (controller === c) controller = null
      })
    },
    stop() {
      controller?.abort()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
