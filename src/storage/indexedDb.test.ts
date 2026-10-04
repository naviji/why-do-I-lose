import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import type { GameAnalysis } from '../analysis/analyseGame'
import { DEFAULT_SETTINGS } from '../engine/engine'
import type { Game } from '../import/types'
import { IdbAnalysisRepo, IdbGameRepo, openAppDb } from './indexedDb'

const game = (id: string, playedAt = 1): Game =>
  ({ id, source: 'lichess', playedAt, pgn: `[Event "${id}"]` }) as unknown as Game

const analysis = (gameId: string, depth = DEFAULT_SETTINGS.depth): GameAnalysis => ({
  gameId,
  engine: { name: 'Stockfish', version: '19' },
  settings: { ...DEFAULT_SETTINGS, depth },
  status: 'done',
  findings: [{ ply: 3, played: 'e2e4', better: 'd2d4', line: ['e7e5'], categories: ['fork'], winBefore: 55, winAfter: 20 }],
})

describe('IndexedDB storage', () => {
  it('keeps games across a reopen and reports duplicates', async () => {
    const factory = new IDBFactory()
    const first = new IdbGameRepo(await openAppDb(factory))
    expect(await first.putMany([game('a'), game('b')])).toEqual({ inserted: ['a', 'b'], duplicate: [] })
    expect(await first.putMany([game('b'), game('c')])).toEqual({ inserted: ['c'], duplicate: ['b'] })

    const reopened = new IdbGameRepo(await openAppDb(factory))
    expect((await reopened.list()).map((g) => g.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('reports a duplicate inside one batch once', async () => {
    const repo = new IdbGameRepo(await openAppDb(new IDBFactory()))
    expect(await repo.putMany([game('a'), game('a')])).toEqual({ inserted: ['a'], duplicate: ['a'] })
  })

  it('keeps analyses across a reopen, keyed by game, engine and settings', async () => {
    const factory = new IDBFactory()
    const first = new IdbAnalysisRepo(await openAppDb(factory))
    await first.put(analysis('a'))
    await first.put(analysis('a', 12))
    await first.put(analysis('a')) // same key replaces

    const reopened = new IdbAnalysisRepo(await openAppDb(factory))
    const a = analysis('a')
    expect(await reopened.get('a', a.engine, a.settings)).toEqual(a)
    expect(await reopened.get('a', a.engine, { ...a.settings, depth: 99 })).toBeUndefined()
    expect(await reopened.list()).toHaveLength(2)
  })
})
