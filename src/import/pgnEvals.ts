import { isMate, parseComment, type Game, type PgnNodeData } from 'chessops/pgn'
import type { Score } from '../core/winChance'

/**
 * White-POV scores from Lichess `[%eval]` comments along the mainline.
 * Index 0 is the start position (always null); index i is the score after ply i.
 */
export function evalsFromPgn(game: Game<PgnNodeData>): (Score | null)[] {
  const evals: (Score | null)[] = [null]
  for (const node of game.moves.mainline()) {
    const ev = (node.comments ?? []).map(parseComment).find(c => c.evaluation)?.evaluation
    evals.push(!ev ? null : isMate(ev) ? { mate: ev.mate } : { cp: Math.round(ev.pawns * 100) })
  }
  return evals
}
