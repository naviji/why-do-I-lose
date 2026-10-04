// Analyses one loss: find the critical moves, then tag each from the opponent's best line.
// With Lichess's per-move scores the engine only searches around each critical move;
// without them (Chess.com, PGN, unanalysed games) it searches every position first.
import type { Color } from 'chessops'
import { normalizeMove } from 'chessops/chess'
import { makeFen } from 'chessops/fen'
import { parseUci } from 'chessops/util'
import { criticalEpisodes } from '../core/criticalMoves'
import { positionFromFen } from '../core/position'
import type { Score } from '../core/winChance'
import type { Engine, EngineInfo, EngineSettings, EvalResult } from '../engine/engine'
import { categories } from '../tactics/categories'
import { tagMove } from '../tactics/tag'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export interface AnalysisGame {
  id: string
  player: Color
  /** Standard UCI from the start position. */
  moves: string[]
  /** White-POV score after each ply (index 0 = start), e.g. Lichess `[%eval]`; absent if unknown. */
  evals?: (Score | null)[]
}

export interface Finding {
  /** The critical player move: ply 1 is White's first move. */
  ply: number
  played: string
  better: string | null
  /** The opponent's best line after `played`. */
  line: string[]
  categories: string[]
}

export interface GameAnalysis {
  gameId: string
  engine: EngineInfo
  settings: EngineSettings
  status: 'done'
  findings: Finding[]
}

export async function analyseGame(game: AnalysisGame, engine: Engine, settings: EngineSettings, signal: AbortSignal): Promise<GameAnalysis> {
  signal.throwIfAborted()
  const fens = positions(game.moves)
  const cache = new Map<number, EvalResult>()
  const search = async (ply: number): Promise<EvalResult> => {
    let r = cache.get(ply)
    if (!r) cache.set(ply, (r = await engine.evaluate(fens[ply]!, settings, signal)))
    return r
  }

  let evals = game.evals
  if (!evals || evals.length < fens.length) {
    evals = []
    for (let ply = 0; ply < fens.length; ply++) evals.push(whitePov((await search(ply)).score, ply))
  }

  const findings: Finding[] = []
  for (const { firstPly: ply } of criticalEpisodes(evals, game.player)) {
    const before = await search(ply - 1)
    const after = await search(ply)
    const played = game.moves[ply - 1]!
    const tags = tagMove({ fen: fens[ply - 1]!, move: played, line: after.pv, lineScore: after.score, better: before.pv[0] })
    findings.push({ ply, played, better: before.pv[0] ?? null, line: after.pv, categories: categories(tags) })
  }
  return { gameId: game.id, engine: engine.info(), settings, status: 'done', findings }
}

/** FEN before each ply: index i is the position after ply i (0 = start). */
function positions(moves: string[]): string[] {
  const pos = positionFromFen(START)
  const fens = [makeFen(pos.toSetup())]
  for (const uci of moves) {
    // castling arrives as e1g1; chessops plays it as king-takes-rook
    pos.play(normalizeMove(pos, parseUci(uci)!))
    fens.push(makeFen(pos.toSetup()))
  }
  return fens
}

/** Side-to-move score after `ply` turned to White's point of view (White moves on odd plies). */
const whitePov = (score: Score, ply: number): Score => {
  const sign = ply % 2 === 0 ? 1 : -1
  return 'mate' in score ? { mate: sign * score.mate } : { cp: sign * score.cp }
}
