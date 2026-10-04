// Test double: a table from position to result. Unknown positions throw, so every test
// lists the positions it relies on.
import type { Engine, EngineInfo, EngineSettings, EvalResult } from './engine'

/** FEN without the halfmove and fullmove counters, which don't change the search. */
export const positionKey = (fen: string): string => fen.split(' ').slice(0, 4).join(' ')

export class FakeEngine implements Engine {
  searches = 0
  private readonly table: Map<string, EvalResult>

  constructor(
    table: Record<string, EvalResult>,
    private readonly engineInfo: EngineInfo = { name: 'Fake', version: '1' },
  ) {
    this.table = new Map(Object.entries(table).map(([fen, r]) => [positionKey(fen), r]))
  }

  info(): EngineInfo {
    return this.engineInfo
  }

  async evaluate(fen: string, _settings: EngineSettings, signal: AbortSignal): Promise<EvalResult> {
    signal.throwIfAborted()
    const result = this.table.get(positionKey(fen))
    if (!result) throw new Error(`no scripted eval for ${fen}`)
    this.searches++
    return result
  }

  dispose(): void {}
}
