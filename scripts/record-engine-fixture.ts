// Usage: npx tsx scripts/record-engine-fixture.ts <pgn> <gameId> <user> <out.json> [depth]
// Runs Stockfish over every position of one game and saves the game plus a
// FEN -> EvalResult table, for FakeEngine-driven analysis tests.
import { readFileSync, writeFileSync } from 'node:fs'
import { parsePgn, startingPosition } from 'chessops/pgn'
import { parseSan } from 'chessops/san'
import { makeFen } from 'chessops/fen'
import { standardUci } from '../src/core/uci'
import { startEngine } from './nodeEngine'

const [pgnPath, gameId, user, out, depthArg] = process.argv.slice(2)
if (!pgnPath || !gameId || !user || !out) throw new Error('usage: record-engine-fixture <pgn> <gameId> <user> <out.json> [depth]')
const depth = Number(depthArg ?? 14)
const game = parsePgn(readFileSync(pgnPath, 'utf8')).find(g => (g.headers.get('Site') ?? '').endsWith(gameId))
if (!game) throw new Error(`no game ${gameId}`)
const player = game.headers.get('White')?.toLowerCase() === user.toLowerCase() ? 'white' : 'black'
const pos = startingPosition(game.headers).unwrap()
const fens = [makeFen(pos.toSetup())]
const moves: string[] = []
for (const node of game.moves.mainline()) {
  const move = parseSan(pos, node.san)!
  moves.push(standardUci(pos, move))
  pos.play(move)
  fens.push(makeFen(pos.toSetup()))
}
const engine = startEngine()
await engine.init()
const evals: Record<string, unknown> = {}
for (const fen of fens) {
  const [, , , , ...rest] = fen.split(' ')
  void rest
  const r = await engine.analyse(fen, [], depth)
  evals[fen] = { score: r.score, pv: r.pv, depth: r.depth }
}
engine.quit()
writeFileSync(out, JSON.stringify({ id: `lichess:${gameId}`, player, moves, evals }, null, 1) + '\n')
console.log(`${moves.length} plies, ${fens.length} positions -> ${out}`)
