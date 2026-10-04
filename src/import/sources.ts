// Where games come from. The Lichess stream splitting and Chess.com archive walk are
// ported from openingtree (src/app/iterator/BaseUrlIterator.js, ChessComIterator.js).
import { splitPgn } from './normalize'

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

/** All of a Lichess user's games, newest first, with `[%eval]` and `[%clk]`; `since` in ms. */
export async function* lichessSource(user: string, http: HttpClient, since?: number): AsyncIterable<SourceItem> {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(user)}?evals=true&clocks=true${since ? `&since=${since}` : ''}`
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
      for (const pgn of splitPgn(text.slice(0, cut))) yield { pgn }
      rest = text.slice(cut)
    }
    for (const pgn of splitPgn(rest)) yield { pgn }
  } catch (e) {
    yield { error: message(e) }
  }
}

/** A Chess.com user's games from monthly archives, starting at the `since` month ("YYYY/MM"). */
export async function* chesscomSource(user: string, http: HttpClient, since?: string): AsyncIterable<SourceItem> {
  try {
    const base = `https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}/games`
    const { archives } = await http.json<{ archives: string[] }>(`${base}/archives`)
    for (const url of archives) {
      if (since && url.slice(-7) < since) continue
      const { games } = await http.json<{ games: { pgn?: string }[] }>(url)
      for (const g of games) if (g.pgn) yield { pgn: g.pgn.trim() }
    }
  } catch (e) {
    yield { error: message(e) }
  }
}

export async function* pgnFileSource(text: string): AsyncIterable<SourceItem> {
  for (const pgn of splitPgn(text)) yield { pgn }
}
