// "Exposed king", checked later than cook.py's: cook.py looks at the king's pawn cover
// before the opponent's line, so it misses moves that let the opponent strip that cover
// first (…h5 gxh5 gxh5). Ours fires when the king had pawn cover before the player's
// move and has lost it by the time an opponent move gives check, or loses it to that check.
import { opposite, type Board, type Color } from './board'
import type { Puzzle } from './puzzle'

const squareFile = (s: number) => s & 7
const squareRank = (s: number) => s >> 3

/** The king of `color` sits on its own side and has no own pawn on the three squares in front of it. */
export function shelterGone(board: Board, color: Color): boolean {
  const king = board.king(color)
  if (king === undefined) return false
  const rank = squareRank(king)
  if (color === 'white' ? rank > 2 : rank < 5) return false
  const ahead = color === 'white' ? 8 : -8
  for (const df of [-1, 0, 1]) {
    const f = squareFile(king) + df
    if (f < 0 || f > 7) continue
    const p = board.pieceAt(king + ahead + df)
    if (p && p.role === 'pawn' && p.color === color) return false
  }
  return true
}

export function exposedKingLate(puzzle: Puzzle): boolean {
  const player = opposite(puzzle.pov)
  // only a cover that existed before the player's move and was lost in the line
  const start = puzzle.game.board()
  if (shelterGone(start, player)) return false
  const home = start.king(player)
  // opponent moves, not counting the last one (as in cook.py)
  for (let k = 1; k < puzzle.mainline.length - 1; k += 2) {
    const node = puzzle.mainline[k]!
    const before = node.parent.board()
    // the cover was taken from the king, not left behind by a king walk
    if (before.king(player) !== home) return false
    // checked after the move too, so a check that captures a cover pawn (Rxg6+) counts
    const after = node.board()
    if (after.isCheck() && (shelterGone(before, player) || shelterGone(after, player))) return true
  }
  return false
}

