// Stockfish WASM (npm `stockfish`) as a child process speaking UCI, for dev scripts.
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { createRequire } from 'node:module'
import { parseInfo, type UciInfo } from '../src/engine/uci'

export const ENGINE_BUILD = 'stockfish/bin/stockfish-19-lite-single.js'

export function startEngine() {
  const path = createRequire(import.meta.url).resolve(ENGINE_BUILD)
  const proc = spawn(process.execPath, [path], { stdio: ['pipe', 'pipe', 'inherit'] })
  const lines = createInterface({ input: proc.stdout })
  let listener: ((line: string) => void) | null = null
  lines.on('line', line => listener?.(line))
  const send = (cmd: string) => proc.stdin.write(cmd + '\n')
  const until = (pred: (line: string) => boolean, onLine?: (line: string) => void) =>
    new Promise<void>(resolve => {
      listener = line => {
        onLine?.(line)
        if (pred(line)) resolve()
      }
    })

  return {
    async init(hashMb = 64) {
      send('uci')
      await until(l => l === 'uciok')
      send(`setoption name Hash value ${hashMb}`)
      send('isready')
      await until(l => l === 'readyok')
    },
    /** Searches `fen` (+ `moves`) to `depth`; the score is for the side to move there. */
    async analyse(fen: string, moves: string[], depth: number): Promise<UciInfo & { bestmove: string | null }> {
      let last: UciInfo | null = null
      let bestmove: string | null = null
      send('ucinewgame')
      send('isready')
      await until(l => l === 'readyok')
      send(`position fen ${fen}${moves.length ? ' moves ' + moves.join(' ') : ''}`)
      send(`go depth ${depth}`)
      await until(
        l => l.startsWith('bestmove'),
        l => {
          if (l.startsWith('bestmove')) bestmove = l.split(' ')[1] === '(none)' ? null : l.split(' ')[1]!
          else last = parseInfo(l) ?? last
        },
      )
      if (!last) throw new Error(`no search result for ${fen} ${moves.join(' ')}`)
      return { ...(last as UciInfo), bestmove }
    },
    quit() {
      send('quit')
    },
  }
}
