// Usage: npx tsx scripts/add-engine-lines.ts <candidates.json> [depth]
// For each candidate, stores the opponent's best line after the player's move
// (`line`, `lineScore` from the opponent's POV) and the engine's best move instead (`better`).
import { readFileSync, writeFileSync } from 'node:fs'
import { startEngine, ENGINE_BUILD } from './nodeEngine'

const [path, depthArg] = process.argv.slice(2)
if (!path) throw new Error('usage: add-engine-lines <candidates.json> [depth]')
const depth = Number(depthArg ?? 18)
const candidates = JSON.parse(readFileSync(path, 'utf8'))

// The WASM engine dies after a few dozen searches in one process, so restart it regularly.
const RESTART_EVERY = 10
let engine = startEngine()
await engine.init()
let done = 0
for (const c of candidates) {
  if (c.line && c.engine?.depth === depth) continue
  if (done > 0 && done % RESTART_EVERY === 0) {
    engine.quit()
    engine = startEngine()
    await engine.init()
  }
  const after = await engine.analyse(c.fen, [c.move], depth)
  const before = await engine.analyse(c.fen, [], depth)
  c.line = after.pv
  c.lineScore = after.score
  c.better = before.bestmove
  c.engine = { build: ENGINE_BUILD, depth }
  if (++done % RESTART_EVERY === 0) {
    writeFileSync(path, JSON.stringify(candidates, null, 2) + '\n')
    console.log(`${done} analysed`)
  }
}
engine.quit()
writeFileSync(path, JSON.stringify(candidates, null, 2) + '\n')
console.log(`done: ${done} candidates analysed at depth ${depth}`)
