// Usage: npx tsx scripts/tag-candidates.ts <candidates.json>
// Runs the ported lichess-puzzler tagger on each candidate: the player's move m
// followed by the opponent's best line, from the opponent's point of view.
import { readFileSync, writeFileSync } from 'node:fs'
import { cook } from '../src/tactics/cook'
import { make } from '../src/tactics/puzzle'
import { counting } from '../src/tactics/exchange'
import { hangingPawn } from '../src/tactics/hangingPawn'
import { defensiveMove } from '../src/tactics/defensiveMove'

const MAX_PLIES = 12
// cook.py's defensiveMove describes the opponent's solution; ours (below) describes the player's move
const META = new Set(['defensiveMove', 'equality', 'advantage', 'crushing', 'oneMove', 'short', 'long', 'veryLong'])

const [path] = process.argv.slice(2)
if (!path) throw new Error('usage: tag-candidates <candidates.json>')
const candidates = JSON.parse(readFileSync(path, 'utf8'))
const counts: Record<string, number> = {}
for (const c of candidates) {
  // a puzzle mainline ends on the solver's move: m + an odd number of opponent plies
  let line: string[] = c.line.slice(0, MAX_PLIES - 1)
  if (line.length % 2 === 0) line = line.slice(0, -1)
  if (!line.length) {
    c.tags = []
    continue
  }
  const s = c.lineScore
  const cp = 'mate' in s ? (s.mate > 0 ? 999999 : -999999) : s.cp
  const puzzle = make(c.fen, [c.move, ...line], cp)
  c.tags = cook(puzzle).filter((t: string) => !META.has(t))
  // a threat already on the board is a missed defence, not something the move left hanging
  if (defensiveMove({ fen: c.fen, move: c.move, line })) {
    c.tags = c.tags.filter((t: string) => t !== 'hangingPiece')
    c.tags.push('defensiveMove')
  } else if (hangingPawn(puzzle)) c.tags.push('hangingPawn')
  if (counting({ fen: c.fen, move: c.move, line })) c.tags.push('counting')
  for (const t of c.tags) counts[t] = (counts[t] ?? 0) + 1
}
writeFileSync(path, JSON.stringify(candidates, null, 2) + '\n')
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', '))
