// Turns saved analyses into the examples the results list shows: one per category of
// each critical move, with the position before the move and a one-line explanation.
import { parseFen, makeFen } from 'chessops/fen'
import { Chess, normalizeMove } from 'chessops/chess'
import { makeSan } from 'chessops/san'
import { parseUci } from 'chessops/util'
import type { GameAnalysis } from '../analysis/analyseGame'
import type { Game } from '../import/types'

export type ResultFilter = 'all' | Game['result']

export interface Example {
  id: string
  gameId: string
  category: string
  result: Game['result']
  side: Game['player']
  ply: number
  fen: string
  /** The opponent's move that led to `fen`, as [from, to] squares. */
  lastMove: [string, string] | null
  playedSan: string
  betterSan: string | null
  replySan: string | null
  explanation: string
  gameUrl: string | null
  /** The player's win chance (0-100, rounded) before and after the move. */
  winBefore: number
  winAfter: number
}

export function examplesOf(game: Game, analysis: GameAnalysis): Example[] {
  const pos = Chess.default()
  const fens: string[] = [makeFen(pos.toSetup())]
  for (const uci of game.moves) {
    pos.play(normalizeMove(pos, parseUci(uci)!))
    fens.push(makeFen(pos.toSetup()))
  }
  const out: Example[] = []
  for (const f of analysis.findings) {
    const fen = fens[f.ply - 1]
    if (!fen) continue
    const before = Chess.fromSetup(parseFen(fen).unwrap()).unwrap()
    const san = (p: Chess, uci: string | null | undefined) => {
      const m = uci ? parseUci(uci) : undefined
      return m ? makeSan(p, normalizeMove(p, m)) : null
    }
    const playedSan = san(before, f.played) ?? f.played
    const betterSan = san(before, f.better)
    const after = before.clone()
    after.play(normalizeMove(after, parseUci(f.played)!))
    const replySan = san(after, f.line[0])
    const explanation = (replySan ? `After ${playedSan} the opponent had ${replySan}.` : `${playedSan} was a mistake.`)
      + (betterSan ? ` Better was ${betterSan}.` : '')
    const gameUrl = game.source === 'lichess' ? `https://lichess.org/${game.id.slice('lichess:'.length)}/${game.player}#${f.ply}` : null
    for (const category of f.categories) {
      out.push({
        id: `${game.id}#${f.ply}#${category}`, gameId: game.id, category, result: game.result, side: game.player,
        ply: f.ply, fen, lastMove: lastMoveOf(game.moves[f.ply - 2]), playedSan, betterSan, replySan, explanation, gameUrl,
        winBefore: Math.round(f.winBefore), winAfter: Math.round(f.winAfter),
      })
    }
  }
  return out
}

export function filterByResult<T extends { result: string }>(examples: T[], filter: ResultFilter): T[] {
  return filter === 'all' ? examples : examples.filter(e => e.result === filter)
}

export function visibleExamples<T extends { id: string }>(examples: T[], removed: ReadonlySet<string>): T[] {
  return examples.filter(e => !removed.has(e.id))
}

function lastMoveOf(uci: string | undefined): [string, string] | null {
  return uci && uci.length >= 4 ? [uci.slice(0, 2), uci.slice(2, 4)] : null
}
