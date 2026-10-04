// Analyses one game: find the critical moves, then tag each from the opponent's best line.
// With Lichess's per-move scores the engine only searches around each critical move;
// without them (Chess.com, PGN, unanalysed games) it searches every position first.
import type { Color } from 'chessops'
import { normalizeMove } from 'chessops/chess'
import { makeFen } from 'chessops/fen'
import { parseUci } from 'chessops/util'
import { criticalEpisodes } from '../core/criticalMoves'
import { positionFromFen } from '../core/position'
import { winPercent, type Score } from '../core/winChance'
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
  /** The player's win chance (0-100, Lichess formula) before and after `played`. */
  winBefore: number
  winAfter: number
}

export interface GameAnalysis {
  gameId: string
  engine: EngineInfo
  settings: EngineSettings
  status: 'done'
  findings: Finding[]
}

/** Where a game's analysis is: scanning every position for its score, then tagging each critical move. */
export interface GameStep {
  stage: 'scan' | 'tag'
  done: number
  total: number
  /** Findings so far, so callers can show them before the game finishes. */
  findings: Finding[]
}

export async function analyseGame(
  game: AnalysisGame, engine: Engine, settings: EngineSettings, signal: AbortSignal, onStep?: (s: GameStep) => void,
): Promise<GameAnalysis> {
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
    for (let ply = 0; ply < fens.length; ply++) {
      onStep?.({ stage: 'scan', done: ply, total: fens.length, findings: [] })
      evals.push(whitePov((await engine.evaluate(fens[ply]!, scanSettings(settings), signal)).score, ply))
    }
  }

  const findings: Finding[] = []
  const episodes = criticalEpisodes(evals, game.player)
  for (const [i, { firstPly: ply }] of episodes.entries()) {
    onStep?.({ stage: 'tag', done: i, total: episodes.length, findings: [...findings] })
    const before = await search(ply - 1)
    const after = await search(ply)
    const played = game.moves[ply - 1]!
    const tags = tagMove({ fen: fens[ply - 1]!, move: played, line: after.pv, lineScore: after.score, better: before.pv[0] })
    findings.push({
      ply,
      played,
      better: before.pv[0] ?? null,
      line: after.pv,
      categories: categories(tags),
      winBefore: winPercent(evals[ply - 1]!, game.player),
      winAfter: winPercent(evals[ply]!, game.player),
    })
    onStep?.({ stage: 'tag', done: i + 1, total: episodes.length, findings: [...findings] })
  }
  return { gameId: game.id, engine: engine.info(), settings, status: 'done', findings }
}

/**
 * A lighter search for scoring every position of an unscored game: it only has to find the
 * critical moves, which then get the full search.
 */
export const scanSettings = (s: EngineSettings): EngineSettings =>
  ({ ...s, depth: Math.min(s.depth, 14), nodes: Math.min(s.nodes, 250_000) })

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
