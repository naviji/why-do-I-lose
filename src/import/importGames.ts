import { normalize } from './normalize'
import type { SourceItem } from './sources'
import type { Game, Source } from './types'

export interface GameRepo {
  putMany(games: Game[]): Promise<{ inserted: string[]; duplicate: string[] }>
  list(): Promise<Game[]>
}

export class MemoryGameRepo implements GameRepo {
  private readonly games = new Map<string, Game>()
  async putMany(games: Game[]) {
    const inserted: string[] = []
    const duplicate: string[] = []
    for (const g of games) {
      if (this.games.has(g.id)) duplicate.push(g.id)
      else {
        this.games.set(g.id, g)
        inserted.push(g.id)
      }
    }
    return { inserted, duplicate }
  }
  async list() {
    return [...this.games.values()]
  }
}

export interface ImportReport {
  imported: number
  duplicate: number
  /** Variants, set positions, unfinished games, games the user didn't play. */
  unsupported: number
  malformed: { index: number; error: string }[]
  /** A network or source failure; games before it are kept. */
  error?: string
  /** playedAt of the newest game seen, for the next refresh. */
  newest?: number
}

const BATCH = 50

export async function importGames(items: AsyncIterable<SourceItem>, source: Source, username: string, repo: GameRepo): Promise<ImportReport> {
  const report: ImportReport = { imported: 0, duplicate: 0, unsupported: 0, malformed: [] }
  let batch: Game[] = []
  const flush = async () => {
    const r = await repo.putMany(batch)
    report.imported += r.inserted.length
    report.duplicate += r.duplicate.length
    batch = []
  }
  let index = 0
  for await (const item of items) {
    if ('error' in item) {
      report.error = item.error
      break
    }
    const r = normalize(item.pgn, username, source)
    if (r.kind === 'ok') {
      batch.push(r.game)
      report.newest = Math.max(report.newest ?? 0, r.game.playedAt)
      if (batch.length >= BATCH) await flush()
    } else if (r.kind === 'unsupported') report.unsupported++
    else report.malformed.push({ index, error: r.error })
    index++
  }
  await flush()
  return report
}
