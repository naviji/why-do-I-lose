// IndexedDB storage for imported games and finished analyses, so they survive a reload.
// Same interfaces as the in-memory repos; the factory is injectable for tests.
import { analysisKey, type AnalysisRepo } from '../analysis/job'
import type { GameAnalysis } from '../analysis/analyseGame'
import type { EngineInfo, EngineSettings } from '../engine/engine'
import type { GameRepo } from '../import/importGames'
import type { Game } from '../import/types'

const DB_NAME = 'why-do-i-lose'
const VERSION = 1
const GAMES = 'games'
const ANALYSES = 'analyses'

export function openAppDb(factory: IDBFactory = indexedDB, name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(GAMES)) db.createObjectStore(GAMES, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(ANALYSES)) db.createObjectStore(ANALYSES)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(tx.error)
  })

const result = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

export class IdbGameRepo implements GameRepo {
  constructor(private readonly db: IDBDatabase) {}

  async putMany(games: Game[]) {
    const tx = this.db.transaction(GAMES, 'readwrite')
    const store = tx.objectStore(GAMES)
    const inserted: string[] = []
    const duplicate: string[] = []
    const seen = new Set<string>()
    const existing = await Promise.all(games.map((g) => result(store.getKey(g.id))))
    games.forEach((g, i) => {
      if (existing[i] !== undefined || seen.has(g.id)) duplicate.push(g.id)
      else {
        seen.add(g.id)
        store.put(g)
        inserted.push(g.id)
      }
    })
    await done(tx)
    return { inserted, duplicate }
  }

  async list() {
    return result(this.db.transaction(GAMES).objectStore(GAMES).getAll() as IDBRequest<Game[]>)
  }
}

export class IdbAnalysisRepo implements AnalysisRepo {
  constructor(private readonly db: IDBDatabase) {}

  async put(a: GameAnalysis) {
    const tx = this.db.transaction(ANALYSES, 'readwrite')
    tx.objectStore(ANALYSES).put(a, analysisKey(a.gameId, a.engine, a.settings))
    await done(tx)
  }

  async get(gameId: string, engine: EngineInfo, settings: EngineSettings) {
    const store = this.db.transaction(ANALYSES).objectStore(ANALYSES)
    return result(store.get(analysisKey(gameId, engine, settings)) as IDBRequest<GameAnalysis | undefined>)
  }

  async list() {
    return result(this.db.transaction(ANALYSES).objectStore(ANALYSES).getAll() as IDBRequest<GameAnalysis[]>)
  }
}
