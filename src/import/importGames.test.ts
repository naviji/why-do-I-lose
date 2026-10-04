import lichess from '../../test/fixtures/api/lichess-kramford.pgn?raw'
import { describe, expect, it } from 'vitest'
import { importGames, MemoryGameRepo } from './importGames'
import { pgnFileSource, type SourceItem } from './sources'


async function* items(...list: SourceItem[]) {
  yield* list
}

describe('importGames', () => {
  it('imports the games the user played and reports the rest', async () => {
    const repo = new MemoryGameRepo()
    const report = await importGames(pgnFileSource(lichess), 'lichess', 'kramford', repo)
    expect(report).toMatchObject({ imported: 196, duplicate: 0, unsupported: 4, malformed: [] })
    expect((await repo.list()).filter(g => g.result === 'loss')).toHaveLength(82)
  })

  it('re-importing the same file adds nothing', async () => {
    const repo = new MemoryGameRepo()
    await importGames(pgnFileSource(lichess), 'lichess', 'kramford', repo)
    expect(await importGames(pgnFileSource(lichess), 'lichess', 'kramford', repo)).toMatchObject({ imported: 0, duplicate: 196 })
  })

  it('keeps going past a broken game and says which one it was', async () => {
    const good = '[White "kramford"]\n[Black "x"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
    const report = await importGames(items({ pgn: good }, { pgn: '[White "kramford"]\n[Result "0-1"]\n\n1. e5 0-1' }), 'pgn', 'kramford', new MemoryGameRepo())
    expect(report.imported).toBe(1)
    expect(report.malformed).toEqual([{ index: 1, error: 'illegal move e5 at ply 1' }])
  })

  it('reports a network failure and keeps what arrived before it', async () => {
    const good = '[White "kramford"]\n[Black "x"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
    const repo = new MemoryGameRepo()
    const report = await importGames(items({ pgn: good }, { error: 'network down' }), 'pgn', 'kramford', repo)
    expect(report).toMatchObject({ imported: 1, error: 'network down' })
    expect(await repo.list()).toHaveLength(1)
  })

  it('sets the checkpoint to just after the newest game', async () => {
    const report = await importGames(pgnFileSource(lichess), 'lichess', 'kramford', new MemoryGameRepo())
    expect(report.newest).toBeGreaterThan(Date.parse('2026-06-24T17:14:19Z') - 1)
  })
})
