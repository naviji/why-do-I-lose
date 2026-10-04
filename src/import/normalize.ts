// Turns one PGN game into the app's Game record. PGN cleanup and splitting are ported
// from openingtree (src/app/iterator/IteratorUtils.js, GPL-3.0), parsing uses chessops.
import { parseComment, parsePgn, startingPosition } from 'chessops/pgn'
import { parseSan } from 'chessops/san'
import { standardUci } from '../core/uci'
import type { Game, Source, Speed } from './types'
import { evalsFromPgn } from './pgnEvals'

export type NormalizeResult =
  | { kind: 'ok'; game: Game }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'malformed'; error: string }

/** openingtree's normalizePGN: newlines, `;` comments, escaped quotes, games split by triple newlines. */
export function normalizePgn(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/^;.*$/gm, '')
    .replace(/\\"/g, '')
    .replace(/\n\n+\[/g, '\n\n\n[')
    .replace(/\s*\n+(1-0|0-1|1\/2-1\/2)/g, ' $1')
}

export function splitPgn(text: string): string[] {
  return normalizePgn(text)
    .split('\n\n\n')
    .map(s => s.trim())
    .filter(Boolean)
}

/** openingtree's getTimeSchedule: base + 40 × increment, in seconds. */
export function speedOf(timeControl: string | undefined): Speed {
  const m = /^(\d+)\+(\d+)$/.exec(timeControl ?? '')
  if (!m) return 'correspondence'
  const total = Number(m[1]) + 40 * Number(m[2])
  return total < 30 ? 'ultraBullet' : total < 120 ? 'bullet' : total < 480 ? 'blitz' : total < 1500 ? 'rapid' : 'classical'
}

export function normalize(pgn: string, username: string, source: Source): NormalizeResult {
  const [parsed] = parsePgn(pgn)
  if (!parsed) return { kind: 'malformed', error: 'no game found' }
  const h = (name: string) => parsed.headers.get(name)
  const variant = h('Variant')
  if (variant && variant !== 'Standard') return { kind: 'unsupported', reason: `variant ${variant}` }
  if (h('FEN') || h('SetUp') === '1') return { kind: 'unsupported', reason: 'starts from a set position' }
  const user = username.toLowerCase()
  const player = h('White')?.toLowerCase() === user ? 'white' : h('Black')?.toLowerCase() === user ? 'black' : null
  if (!player) return { kind: 'unsupported', reason: `${username} did not play this game` }
  const outcome = h('Result')
  if (outcome !== '1-0' && outcome !== '0-1' && outcome !== '1/2-1/2') return { kind: 'unsupported', reason: 'unfinished game' }

  const start = startingPosition(parsed.headers)
  if (start.isErr) return { kind: 'malformed', error: String(start.error) }
  const pos = start.value
  const moves: string[] = []
  const clocks: (number | null)[] = []
  for (const node of parsed.moves.mainline()) {
    const move = parseSan(pos, node.san)
    if (!move) return { kind: 'malformed', error: `illegal move ${node.san} at ply ${moves.length + 1}` }
    moves.push(standardUci(pos, move))
    pos.play(move)
    clocks.push((node.comments ?? []).map(parseComment).find(c => c.clock !== undefined)?.clock ?? null)
  }
  const evals = evalsFromPgn(parsed)
  const result = outcome === '1/2-1/2' ? 'draw' : (outcome === '1-0') === (player === 'white') ? 'win' : 'loss'
  const termination = h('Termination') === 'Time forfeit' || /won on time/i.test(h('Termination') ?? '') ? 'time' : h('Termination') === 'Normal' ? 'normal' : 'other'
  const date = (h('UTCDate') ?? h('Date') ?? '').replace(/\./g, '-')
  const playedAt = Date.parse(`${date}T${h('UTCTime') ?? '00:00:00'}Z`)

  return {
    kind: 'ok',
    game: {
      id: gameId(source, h, moves),
      source,
      player,
      result,
      termination,
      speed: speedOf(h('TimeControl')),
      playedAt: Number.isNaN(playedAt) ? 0 : playedAt,
      moves,
      evals: evals.some(e => e) ? evals : undefined,
      clocks: clocks.some(c => c !== null) ? clocks : undefined,
      pgn,
    },
  }
}

function gameId(source: Source, h: (name: string) => string | undefined, moves: string[]): string {
  const site = /lichess\.org\/(\w{8})/.exec(h('Site') ?? '')
  if (source === 'lichess' && site) return `lichess:${site[1]}`
  const link = /chess\.com\/game\/\w+\/(\d+)/.exec(h('Link') ?? '')
  if (source === 'chesscom' && link) return `chesscom:${link[1]}`
  // a file's games: same players, result and moves are the same game, whatever the other headers say
  return `pgn:${fnv1a([h('White'), h('Black'), h('Result'), ...moves].join(' '))}`
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, '0')
}
