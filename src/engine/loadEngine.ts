// Starts Stockfish in a Web Worker. The engine files are copied to /stockfish/ at build
// time (see vite.config.ts). Any failure becomes an EngineLoadError, so import and review
// keep working without an engine.
import { EngineLoadError, type Engine } from './engine'
import { ENGINE_BUILD, StockfishWorkerEngine } from './workerEngine'

const HANDSHAKE_MS = 15_000

export async function loadEngine(base: string = import.meta.env.BASE_URL): Promise<Engine> {
  let worker: Worker | undefined
  try {
    worker = new Worker(`${base}stockfish/${ENGINE_BUILD}.js`)
    const failed = new Promise<never>((_, reject) => {
      worker!.onerror = e => reject(new EngineLoadError(`Stockfish failed to load: ${e.message || 'worker error'}`))
      setTimeout(() => reject(new EngineLoadError('Stockfish did not start in time')), HANDSHAKE_MS)
    })
    return await Promise.race([StockfishWorkerEngine.start(worker as never), failed])
  } catch (e) {
    worker?.terminate()
    throw e instanceof EngineLoadError ? e : new EngineLoadError(`Stockfish failed to load: ${String(e)}`)
  }
}
