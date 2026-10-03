// Usage: npx tsx scripts/make-label-batch.ts <candidates.json> <out.md>
// Writes a markdown table of candidates for hand-labeling: up to PER_TAG examples
// per motif plus a few untagged ones. Only candidates that leave the player losing
// by Stockfish's eval (below DEFAULT_LOSING_BELOW) are included.
import { readFileSync, writeFileSync } from 'node:fs'
import { parseUci } from 'chessops/util'
import { makeSanAndPlay } from 'chessops/san'
import { normalizeMove } from 'chessops/chess'
import { positionFromFen } from '../src/core/position'
import { winPercent, type Score } from '../src/core/winChance'
import { DEFAULT_LOSING_BELOW } from '../src/core/criticalMoves'

const PER_TAG = 6
const UNTAGGED = 10
// position descriptions rather than mistakes
const IGNORE = new Set(['castling', 'quietMove', 'defensiveMove', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5', 'rookEndgame', 'bishopEndgame', 'knightEndgame', 'pawnEndgame', 'queenEndgame', 'queenRookEndgame', 'promotion', 'enPassant'])

const [inPath, outPath] = process.argv.slice(2)
if (!inPath || !outPath) throw new Error('usage: make-label-batch <candidates.json> <out.md>')
const all = JSON.parse(readFileSync(inPath, 'utf8'))

// lineScore is from the opponent's (side to move) point of view
const playerWinAfter = (x: any) => 100 - winPercent(x.lineScore as Score, 'white')
const motifs = (x: any): string[] => (x.tags ?? []).filter((t: string) => !IGNORE.has(t))

const per: Record<string, number> = {}
const picked: number[] = []
let untagged = 0
all.forEach((x: any, i: number) => {
  if (!x.line || playerWinAfter(x) >= DEFAULT_LOSING_BELOW) return
  const m = motifs(x)
  if (m.length ? m.some(t => (per[t] ?? 0) < PER_TAG) : untagged < UNTAGGED && i % 5 === 0) {
    picked.push(i)
    if (!m.length) untagged++
    for (const t of m) per[t] = (per[t] ?? 0) + 1
  }
})

const sanLine = (x: any) => {
  const pos = positionFromFen(x.fen)
  makeSanAndPlay(pos, normalizeMove(pos, parseUci(x.move)!))
  return x.line.slice(0, 7).map((u: string) => makeSanAndPlay(pos, normalizeMove(pos, parseUci(u)!))).join(' ')
}
const pct = (n: number) => `${Math.round(n)}%`
const lichessWin = (x: any, s: Score) => winPercent(s, x.player)

let md = `# Labeling batch 1 (v2)\n\nOnly moves that dropped your win chance by more than 10 points **and** left you below ${DEFAULT_LOSING_BELOW}% (by Stockfish) are included. "Tags" is what the ported lichess-puzzler tagger finds in the opponent's best line.\n\nIn the last column, write **✓** if the tags are right, **✗** if a tag is wrong (say which), or add a missing motif.\n\n| # | Position | You played | Your win chance | Opponent's best line | Tags | Your call |\n|---|---|---|---|---|---|---|\n`
for (const i of picked) {
  const x = all[i]
  md += `| ${i} | [move ${Math.ceil(x.ply / 2)}](${x.url}) | ${x.san} | ${pct(lichessWin(x, x.evalBefore))} → ${pct(playerWinAfter(x))} | ${sanLine(x)} | ${motifs(x).join(', ') || 'none'} | |\n`
}
writeFileSync(outPath, md)
const eligible = all.filter((x: any) => x.line && playerWinAfter(x) < DEFAULT_LOSING_BELOW)
console.log(`${eligible.length} losing candidates from ${new Set(eligible.map((x: any) => x.gameId)).size} games; ${picked.length} rows`, per)
