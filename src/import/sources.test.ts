import lichessPgn from '../../test/fixtures/api/lichess-kramford.pgn?raw'
import archives from '../../test/fixtures/api/chesscom-archives.json?raw'
import sept from '../../test/fixtures/api/chesscom-2026-09.json?raw'
import { describe, expect, it } from 'vitest'
import { chesscomSource, lichessSource, pgnFileSource, type HttpClient, type SourceItem } from './sources'

const fixtures: Record<string, string> = { 'lichess-kramford.pgn': lichessPgn, 'chesscom-archives.json': archives, 'chesscom-2026-09.json': sept }
const fixture = (name: string) => fixtures[name]!

/** Serves recorded responses, in small chunks, and records the URLs asked for. */
class FakeHttpClient implements HttpClient {
  requested: string[] = []
  constructor(
    private readonly responses: Record<string, string>,
    private readonly failAfterChunks = Infinity,
  ) {}
  async *stream(url: string): AsyncIterable<string> {
    this.requested.push(url)
    const body = this.body(url)
    for (let i = 0, n = 0; i < body.length; i += 997, n++) {
      if (n >= this.failAfterChunks) throw new Error('network down')
      yield body.slice(i, i + 997)
    }
  }
  async json<T>(url: string): Promise<T> {
    this.requested.push(url)
    return JSON.parse(this.body(url)) as T
  }
  private body(url: string): string {
    const key = Object.keys(this.responses).find(k => url.startsWith(k))
    if (!key) throw new Error(`404 ${url}`)
    return this.responses[key]!
  }
}

const collect = async (items: AsyncIterable<SourceItem>) => {
  const out: SourceItem[] = []
  for await (const item of items) out.push(item)
  return out
}

describe('lichessSource', () => {
  const http = () => new FakeHttpClient({ 'https://lichess.org/api/games/user/kramford': fixture('lichess-kramford.pgn') })

  it('streams every game of the export, with scores and clocks requested', async () => {
    const client = http()
    const items = await collect(lichessSource('kramford', client))
    expect(items.filter(i => 'pgn' in i)).toHaveLength(200)
    expect(client.requested).toEqual(['https://lichess.org/api/games/user/kramford?evals=true&clocks=true'])
  })

  it('asks only for games after the checkpoint', async () => {
    const client = http()
    await collect(lichessSource('kramford', client, { since: 1780000000000 }))
    expect(client.requested[0]).toContain('&since=1780000000000')
  })

  it('passes openingtree-style filters to the Lichess API', async () => {
    const client = http()
    const filters = { speeds: ['blitz', 'rapid'], rated: 'rated', color: 'black', opponent: 'Mister-iks', from: 1, to: 2, max: 50 } as const
    await collect(lichessSource('kramford', client, { filters }))
    expect(client.requested[0]).toBe(
      'https://lichess.org/api/games/user/kramford?evals=true&clocks=true&perfType=blitz,rapid&rated=true&color=black&vs=Mister-iks&since=1&until=2&max=50',
    )
  })

  it('filters by opponent rating after download, as openingtree does', async () => {
    const items = await collect(lichessSource('kramford', http(), { filters: { eloRange: [1400, null] } }))
    const pgns = items.flatMap(i => ('pgn' in i ? [i.pgn] : []))
    expect(pgns.length).toBeGreaterThan(0)
    expect(pgns.length).toBeLessThan(200)
    for (const pgn of pgns) {
      const kramfordWhite = /\[White "kramford"\]/.test(pgn)
      const elo = Number(new RegExp(`\\[${kramfordWhite ? 'Black' : 'White'}Elo "(\\d+)"\\]`).exec(pgn)![1])
      expect(elo).toBeGreaterThanOrEqual(1400)
    }
  })

  it('keeps the games already received when the network fails', async () => {
    const client = new FakeHttpClient({ 'https://lichess.org/': fixture('lichess-kramford.pgn') }, 50)
    const items = await collect(lichessSource('kramford', client))
    expect(items.at(-1)).toEqual({ error: 'network down' })
    expect(items.filter(i => 'pgn' in i).length).toBeGreaterThan(10)
  })
})

describe('chesscomSource', () => {
  const client = () =>
    new FakeHttpClient({
      'https://api.chess.com/pub/player/kramford/games/archives': fixture('chesscom-archives.json'),
      'https://api.chess.com/pub/player/kramford/games/2026/09': fixture('chesscom-2026-09.json'),
      'https://api.chess.com/pub/player/kramford/games/2026/08': '{"games":[]}',
    })

  it('reads every monthly archive', async () => {
    const http = client()
    const items = await collect(chesscomSource('kramford', http))
    expect(items.filter(i => 'pgn' in i)).toHaveLength(1) // the Chess960 game is left out
    expect(http.requested).toHaveLength(3)
  })

  it('applies the filters to each archive game', async () => {
    const items = await collect(chesscomSource('kramford', client(), { filters: { speeds: ['rapid'] } }))
    expect(items).toEqual([])
    const blitz = await collect(chesscomSource('kramford', client(), { filters: { speeds: ['blitz'], color: 'white' } }))
    expect(blitz).toHaveLength(1)
  })

  it('starts from the checkpoint month', async () => {
    const http = client()
    await collect(chesscomSource('kramford', http, { since: '2026/09' }))
    expect(http.requested.slice(1)).toEqual(['https://api.chess.com/pub/player/kramford/games/2026/09'])
  })
})

describe('pgnFileSource', () => {
  it('splits a file into games', async () => {
    const items = await collect(pgnFileSource('[White "a"]\n\n1. e4 1-0\n\n[White "b"]\n\n1. d4 0-1\n'))
    expect(items).toEqual([{ pgn: '[White "a"]\n\n1. e4 1-0' }, { pgn: '[White "b"]\n\n1. d4 0-1' }])
  })
})
