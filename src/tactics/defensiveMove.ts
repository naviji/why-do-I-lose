// "Defensive move": the opponent's threat was already on the board before the
// player's move, and the move did nothing about it. Tested with a null move: if the
// player had passed instead, the opponent's line still reaches a capture that wins on the count.
// Unlike cook.py's defensiveMove, this describes the player's move, not the solution.
import { parseUci } from 'chessops/util'
import { Board, type Move } from './board'
import { see } from './exchange'
import { MAX_FORCING } from './hangingPawn'
import { nullMove } from './threat'
import { materialDiff } from './util'

/**
 * `better` is the engine's best move instead of `move`. When given, it must stop the
 * threat: a threat that still works after the best move was never the player's to parry.
 */
export function defensiveMove({ fen, move, line, better }: { fen: string; move: string; line: string[]; better?: string }): boolean {
  const before = Board.fromFen(fen)
  const player = before.turn
  const start = materialDiff(before, player)
  const real = before.copy()
  for (const uci of [move, ...line]) real.push(parseUci(uci) as Move)
  if (start - materialDiff(real, player) < 1) return false

  const passed = nullMove(before)
  if (!passed || !threatWins(passed, line)) return false
  if (!better) return true
  const defended = before.copy()
  defended.push(parseUci(better) as Move)
  return !threatWins(defended, line)
}

/**
 * Replays the line up to the opponent's first capture (opponent to move in `board`) and
 * judges that capture on the count, not by the line's own replies, which were chosen
 * for a different position.
 */
function threatWins(board: Board, line: string[]): boolean {
  const b = board.copy()
  for (let i = 0; i < line.length && i <= 2 * MAX_FORCING; i++) {
    const m = parseUci(line[i]!) as Move
    if (!b.legalMoves().some(l => l.from === m.from && l.to === m.to && l.promotion === m.promotion)) return false
    if (i % 2 === 0 && b.isCapture(m)) return see(b, m) > 0
    b.push(m)
    // the player can simply win the piece that just moved (after d5, Nc4 is met by dxc4)
    if (i % 2 === 0 && b.legalMoves().some(r => r.to === m.to && see(b, r) > 0)) return false
  }
  return false
}
