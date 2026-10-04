import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './engine'
import { StockfishWorkerEngine, type WorkerLike } from './workerEngine'

/** A worker that answers UCI commands from a script and records what it was sent. */
class ScriptedWorker implements WorkerLike {
  sent: string[] = []
  onmessage: ((e: { data: string }) => void) | null = null
  terminated = false
  constructor(private readonly replies: (cmd: string) => string[]) {}
  postMessage(cmd: string) {
    this.sent.push(cmd)
    const out = this.replies(cmd)
    queueMicrotask(() => out.forEach(line => this.onmessage?.({ data: line })))
  }
  terminate() {
    this.terminated = true
  }
}

const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'
// recorded from stockfish-19-lite-single for a back-rank mate in 1
const search = (cmd: string): string[] =>
  cmd === 'uci'
    ? ['id name Stockfish 19 Lite', 'uciok']
    : cmd === 'isready'
      ? ['readyok']
      : cmd.startsWith('go')
        ? [
            'info depth 1 seldepth 2 multipv 1 score cp 900 nodes 20 pv a1a8',
            'info depth 2 seldepth 2 multipv 1 score mate 1 lowerbound nodes 40 pv a1a8',
            'info depth 2 seldepth 2 multipv 1 score mate 1 nodes 52 pv a1a8',
            'bestmove a1a8',
          ]
        : []

describe('StockfishWorkerEngine', () => {
  it('runs the UCI handshake and reads the engine name', async () => {
    const worker = new ScriptedWorker(search)
    const engine = await StockfishWorkerEngine.start(worker)
    expect(engine.info()).toEqual({ name: 'Stockfish 19 Lite', version: 'stockfish-19-lite-single' })
    expect(worker.sent.slice(0, 1)).toEqual(['uci'])
  })

  it('searches a position and returns the last complete line', async () => {
    const worker = new ScriptedWorker(search)
    const engine = await StockfishWorkerEngine.start(worker)
    worker.sent = []
    const result = await engine.evaluate(fen, DEFAULT_SETTINGS, new AbortController().signal)
    expect(result).toEqual({ score: { mate: 1 }, pv: ['a1a8'], depth: 2 })
    expect(worker.sent).toEqual([
      `setoption name Hash value ${DEFAULT_SETTINGS.hashMb}`,
      'isready',
      `position fen ${fen}`,
      `go depth ${DEFAULT_SETTINGS.depth} nodes ${DEFAULT_SETTINGS.nodes}`,
    ])
  })

  it('runs one search at a time', async () => {
    const worker = new ScriptedWorker(search)
    const engine = await StockfishWorkerEngine.start(worker)
    worker.sent = []
    const signal = new AbortController().signal
    await Promise.all([engine.evaluate(fen, DEFAULT_SETTINGS, signal), engine.evaluate(fen, DEFAULT_SETTINGS, signal)])
    const gos = worker.sent.map((c, i) => [c, i] as const).filter(([c]) => c.startsWith('go') || c.startsWith('position'))
    expect(gos.map(([c]) => c.split(' ')[0])).toEqual(['position', 'go', 'position', 'go'])
  })

  it('sends stop and rejects when aborted mid-search', async () => {
    let release: (() => void) | undefined
    const worker = new ScriptedWorker(cmd => (cmd.startsWith('go') ? [] : cmd === 'stop' ? ['bestmove a1a8'] : search(cmd)))
    const engine = await StockfishWorkerEngine.start(worker)
    const controller = new AbortController()
    const pending = engine.evaluate(fen, DEFAULT_SETTINGS, controller.signal)
    await new Promise(r => setTimeout(r, 0))
    controller.abort()
    await expect(pending).rejects.toThrow(/abort/i)
    expect(worker.sent).toContain('stop')
    void release
  })

  it('fails a search that ends without any score', async () => {
    const worker = new ScriptedWorker(cmd => (cmd.startsWith('go') ? ['bestmove (none)'] : search(cmd)))
    const engine = await StockfishWorkerEngine.start(worker)
    await expect(engine.evaluate(fen, DEFAULT_SETTINGS, new AbortController().signal)).rejects.toThrow(/no score/)
  })

  it('scores a checkmated side to move as lost', async () => {
    // what Stockfish prints when the side to move is already mated
    const worker = new ScriptedWorker(cmd => (cmd.startsWith('go') ? ['info depth 0 score mate 0', 'bestmove (none)'] : search(cmd)))
    const engine = await StockfishWorkerEngine.start(worker)
    expect(await engine.evaluate(fen, DEFAULT_SETTINGS, new AbortController().signal)).toEqual({ score: { cp: -100000 }, pv: [], depth: 0 })
  })

  it('terminates the worker on dispose', async () => {
    const worker = new ScriptedWorker(search)
    ;(await StockfishWorkerEngine.start(worker)).dispose()
    expect(worker.terminated).toBe(true)
  })
})
