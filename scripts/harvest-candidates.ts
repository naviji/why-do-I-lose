// Usage: npx tsx scripts/harvest-candidates.ts <games.pgn> <username> <out.json>
// Finds the user's critical moves in their losses from the PGN's Lichess evals.
import { readFileSync, writeFileSync } from 'node:fs'
import { parsePgn, startingPosition } from 'chessops/pgn'
import { parseSan, makeSanAndPlay } from 'chessops/san'
import { makeFen } from 'chessops/fen'
import { standardUci } from '../src/core/uci'
import type { Color } from 'chessops'
import { evalsFromPgn } from '../src/import/pgnEvals'
import { criticalEpisodes } from '../src/core/criticalMoves'

const [pgnPath, username, outPath] = process.argv.slice(2)
if (!pgnPath || !username || !outPath) throw new Error('usage: harvest-candidates <pgn> <username> <out.json>')
const user = username.toLowerCase()

const candidates = []
let losses = 0
for (const game of parsePgn(readFileSync(pgnPath, 'utf8'))) {
  const h = game.headers
  if ((h.get('Variant') ?? 'Standard') !== 'Standard') continue
  const player: Color | null =
    h.get('White')?.toLowerCase() === user ? 'white' : h.get('Black')?.toLowerCase() === user ? 'black' : null
  const result = h.get('Result')
  if (!player) continue
  if (!process.env.ALL_GAMES && result !== (player === 'white' ? '0-1' : '1-0')) continue
  losses++
  const evals = evalsFromPgn(game)
  const episodes = criticalEpisodes(evals, player)
  if (!episodes.length) continue

  const pos = startingPosition(game.headers).unwrap()
  const firstPlies = new Set(episodes.map(e => e.firstPly))
  const id = h.get('GameId') ?? h.get('Site')?.split('/').pop()
  let ply = 0
  let prevFen: string | null = null
  let prevMove: string | null = null
  for (const node of game.moves.mainline()) {
    ply++
    const fen = makeFen(pos.toSetup())
    const move = parseSan(pos, node.san)
    if (!move) break
    if (firstPlies.has(ply)) {
      const episode = episodes.find(e => e.firstPly === ply)!
      candidates.push({
        gameId: `lichess:${id}`,
        url: `https://lichess.org/${id}${player === 'black' ? '/black' : ''}#${ply}`,
        player,
        termination: h.get('Termination'),
        ply,
        fen,
        move: standardUci(pos, move),
        prevFen,
        prevMove,
        san: node.san,
        evalBefore: evals[ply - 1],
        evalAfter: evals[ply],
        episodePlies: episode.plies,
        line: null as string[] | null, // filled in by Stockfish later
        labels: {} as Record<string, boolean>,
      })
    }
    prevFen = fen
    prevMove = standardUci(pos, move)
    makeSanAndPlay(pos, move)
  }
}
writeFileSync(outPath, JSON.stringify(candidates, null, 2) + '\n')
console.log(`${losses} losses, ${candidates.length} candidates from ${new Set(candidates.map(c => c.gameId)).size} games -> ${outPath}`)
