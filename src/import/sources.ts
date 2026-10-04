// Where games come from. The Lichess stream splitting and Chess.com archive walk are
// ported from openingtree (src/app/iterator/BaseUrlIterator.js, ChessComIterator.js).
import { splitPgn } from './normalize'
import type { Speed } from './types'

/** The import filters openingtree offers, minus variants (v1 is standard chess only). */
export interface ImportFilters {
  speeds?: Speed[]
  rated?: 'all' | 'rated' | 'casual'
  /** The user's colour; both when absent. */
  color?: 'white' | 'black'
  opponent?: string
  /** Opponent rating, inclusive; null upper bound means no limit. */
  eloRange?: [number, number | null]
  /** Played between these times, ms since 1970. */
  from?: number
  to?: number
  /** Most games to download (Lichess). */
  max?: number
}

const eloInRange = (elo: number, [low, high]: [number, number | null]) => elo >= low && (high === null || elo <= high)

/** The opponent's rating from PGN headers, or null if the user isn't in the game. */
function opponentElo(pgn: string, user: string): number | null {
  const header = (name: string) => new RegExp(`\\[${name} "([^"]*)"\\]`).exec(pgn)?.[1]
  const side = header('White')?.toLowerCase() === user.toLowerCase() ? 'Black' : 'White'
  const elo = Number(header(`${side}Elo`))
  return Number.isFinite(elo) ? elo : null
}

export type SourceItem = { pgn: string } | { error: string }

export interface HttpClient {
  stream(url: string, init?: RequestInit): AsyncIterable<string>
  json<T>(url: string): Promise<T>
}

export const fetchHttpClient: HttpClient = {
  async *stream(url, init) {
    const res = await fetch(url, init)
    if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText} from ${url}`)
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      yield value
    }
  },
  async json(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${url}`)
    return res.json()
  },
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** A Lichess user's games, newest first, with `[%eval]` and `[%clk]`; `since` in ms is the refresh checkpoint. */
export async function* lichessSource(
  user: string,
  http: HttpClient,
  { since, filters = {} }: { since?: number; filters?: ImportFilters } = {},
): AsyncIterable<SourceItem> {
  const f = filters
  const params = [
    'evals=true',
    'clocks=true',
    f.speeds?.length ? `perfType=${f.speeds.join(',')}` : '',
    f.rated && f.rated !== 'all' ? `rated=${f.rated === 'rated'}` : '',
    f.color ? `color=${f.color}` : '',
    f.opponent ? `vs=${encodeURIComponent(f.opponent)}` : '',
    since || f.from ? `since=${Math.max(since ?? 0, f.from ?? 0)}` : '',
    f.to ? `until=${f.to}` : '',
    f.max ? `max=${f.max}` : '',
  ].filter(Boolean)
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(user)}?${params.join('&')}`
  // the API can't filter by opponent rating, so openingtree checks it after download
  const keep = (pgn: string) => {
    if (!f.eloRange) return true
    const elo = opponentElo(pgn, user)
    return elo !== null && eloInRange(elo, f.eloRange)
  }
  let rest = ''
  try {
    for await (const chunk of http.stream(url, { headers: { Accept: 'application/x-chess-pgn' } })) {
      // games are separated by blank lines; keep the unfinished tail for the next chunk
      const text = rest + chunk
      const cut = text.lastIndexOf('\n\n\n')
      if (cut < 0) {
        rest = text
        continue
      }
      for (const pgn of splitPgn(text.slice(0, cut))) if (keep(pgn)) yield { pgn }
      rest = text.slice(cut)
    }
    for (const pgn of splitPgn(rest)) if (keep(pgn)) yield { pgn }
  } catch (e) {
    yield { error: message(e) }
  }
}

interface ChesscomGame {
  pgn?: string
  rules?: string
  time_class?: string
  rated?: boolean
  end_time?: number
  white?: { username: string; rating?: number }
  black?: { username: string; rating?: number }
}

/** openingtree's Chess.com filter, applied to each archive entry. */
function chesscomKeep(g: ChesscomGame, user: string, f: ImportFilters): boolean {
  if (g.rules && g.rules !== 'chess') return false
  const color = g.white?.username.toLowerCase() === user.toLowerCase() ? 'white' : 'black'
  const opponent = color === 'white' ? g.black : g.white
  const speed = g.time_class === 'daily' ? 'correspondence' : g.time_class
  if (f.speeds?.length && !f.speeds.includes(speed as Speed)) return false
  if (f.rated === 'rated' && !g.rated) return false
  if (f.rated === 'casual' && g.rated) return false
  if (f.color && f.color !== color) return false
  if (f.opponent && opponent?.username.toLowerCase() !== f.opponent.toLowerCase()) return false
  if (f.eloRange && !(opponent?.rating !== undefined && eloInRange(opponent.rating, f.eloRange))) return false
  const ended = (g.end_time ?? 0) * 1000
  if (f.from && ended < f.from) return false
  if (f.to && ended > f.to) return false
  return true
}

/** A Chess.com user's games from monthly archives, starting at the `since` month ("YYYY/MM"). */
export async function* chesscomSource(
  user: string,
  http: HttpClient,
  { since, filters = {} }: { since?: string; filters?: ImportFilters } = {},
): AsyncIterable<SourceItem> {
  try {
    const base = `https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}/games`
    const { archives } = await http.json<{ archives: string[] }>(`${base}/archives`)
    for (const url of archives) {
      if (since && url.slice(-7) < since) continue
      const { games } = await http.json<{ games: ChesscomGame[] }>(url)
      for (const g of games) if (g.pgn && chesscomKeep(g, user, filters)) yield { pgn: g.pgn.trim() }
    }
  } catch (e) {
    yield { error: message(e) }
  }
}

export async function* pgnFileSource(text: string): AsyncIterable<SourceItem> {
  for (const pgn of splitPgn(text)) yield { pgn }
}
