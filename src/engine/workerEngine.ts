// Stockfish over UCI in a Web Worker (or anything that speaks UCI by message).
import type { Engine, EngineInfo, EngineSettings, EvalResult } from './engine'
import { parseInfo } from './uci'

export interface WorkerLike {
  postMessage(cmd: string): void
  onmessage: ((e: { data: string }) => void) | null
  terminate(): void
}

export const ENGINE_BUILD = 'stockfish-19-lite-single'

export class StockfishWorkerEngine implements Engine {
  private listener: ((line: string) => void) | null = null
  /** Searches run one after another. */
  private queue: Promise<unknown> = Promise.resolve()

  private constructor(
    private readonly worker: WorkerLike,
    private name = 'Stockfish',
  ) {
    worker.onmessage = e => this.listener?.(String(e.data))
  }

  static async start(worker: WorkerLike): Promise<StockfishWorkerEngine> {
    const engine = new StockfishWorkerEngine(worker)
    await engine.until('uci', line => {
      if (line.startsWith('id name ')) engine.name = line.slice('id name '.length)
      return line === 'uciok'
    })
    return engine
  }

  info(): EngineInfo {
    return { name: this.name, version: ENGINE_BUILD }
  }

  evaluate(fen: string, settings: EngineSettings, signal: AbortSignal): Promise<EvalResult> {
    const run = this.queue.then(() => this.search(fen, settings, signal))
    this.queue = run.catch(() => undefined)
    return run
  }

  dispose(): void {
    this.worker.terminate()
  }

  private async search(fen: string, settings: EngineSettings, signal: AbortSignal): Promise<EvalResult> {
    signal.throwIfAborted()
    this.worker.postMessage(`setoption name Hash value ${settings.hashMb}`)
    await this.until('isready', line => line === 'readyok')
    let result: EvalResult | null = null
    const onAbort = () => this.worker.postMessage('stop')
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      this.worker.postMessage(`position fen ${fen}`)
      // the single-threaded WASM build can't read `stop` mid-search, so the node cap bounds it too
      await this.until(`go depth ${settings.depth} nodes ${settings.nodes}`, line => {
        if (line.startsWith('info') && / score mate 0\b/.test(line)) result = { score: { cp: -100000 }, pv: [], depth: 0 }
        const info = parseInfo(line)
        if (info) result = { score: info.score, pv: info.pv, depth: info.depth }
        return line.startsWith('bestmove')
      })
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
    signal.throwIfAborted()
    if (!result) throw new Error(`no score for ${fen}`)
    return result
  }

  /** Sends `cmd` and resolves on the first line for which `done` returns true. */
  private until(cmd: string, done: (line: string) => boolean): Promise<void> {
    return new Promise(resolve => {
      this.listener = line => {
        if (done(line)) {
          this.listener = null
          resolve()
        }
      }
      this.worker.postMessage(cmd)
    })
  }
}
