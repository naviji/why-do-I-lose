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

export function defensiveMove({ fen, move, line }: { fen: string; move: string; line: string[] }): boolean {
  const before = Board.fromFen(fen)
  const player = before.turn
  const start = materialDiff(before, player)
  const real = before.copy()
  for (const uci of [move, ...line]) real.push(parseUci(uci) as Move)
  if (start - materialDiff(real, player) < 1) return false

  const passed = nullMove(before)
  if (!passed) return false
  // replay the line up to the opponent's first capture, and judge that capture on the
  // count rather than by the line's own replies, which were chosen for a different position
  for (let i = 0; i < line.length && i <= 2 * MAX_FORCING; i++) {
    const m = parseUci(line[i]!) as Move
    if (!passed.legalMoves().some(l => l.from === m.from && l.to === m.to && l.promotion === m.promotion)) return false
    if (i % 2 === 0 && passed.isCapture(m)) return see(passed, m) > 0
    passed.push(m)
  }
  return false
}
