// Engine lines run past the point where the mistake is punished. Motifs found in the
// mop-up afterwards (a clearance ten plies later) are noise, so cut the line there.
import { parseUci } from 'chessops/util'
import { Board, type Move } from './board'
import { materialDiff } from './util'

/**
 * The opponent's line (after the player's `move`) cut just after the opponent move that
 * first reaches the largest material gain, judged after the player's reply so a capture
 * that is simply taken back doesn't count. Lines ending in mate, or winning no material,
 * are kept whole.
 */
export function trimToGain(fen: string, move: string, line: string[]): string[] {
  const board = Board.fromFen(fen)
  const player = board.turn
  const start = materialDiff(board, player)
  board.push(parseUci(move) as Move)
  const lost: number[] = []
  for (const uci of line) {
    board.push(parseUci(uci) as Move)
    lost.push(start - materialDiff(board, player))
  }
  if (board.isCheckmate()) return line
  // after opponent ply i (even index), judge by the position after the player's reply
  let best = 0
  let cut = line.length
  for (let i = 0; i < line.length; i += 2) {
    const settled = lost[Math.min(i + 1, line.length - 1)]!
    if (settled > best) {
      best = settled
      cut = i + 1
    }
  }
  return best >= 1 ? line.slice(0, cut) : line
}
