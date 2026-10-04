// Last-resort detectors, used only when nothing else explains a critical move:
// - a player piece lost a few moves into the line, after a trade, a check or a quiet move
//   (cook.py's hangingPiece only looks at the opponent's first move);
// - a mate threat the player has to give material to stop.
import { opposite, type Board } from './board'
import type { Puzzle } from './puzzle'
import { nullMove } from './threat'
import { see } from './exchange'
import { isHanging, materialDiff } from './util'

/** Opponent moves to look through. */
const OPPONENT_MOVES = 3

/** 'hangingPiece' or (when the piece was already loose and attacked before the player's move) 'defensiveMove'. */
export function lateLoss(puzzle: Puzzle): 'hangingPiece' | 'defensiveMove' | null {
  const player = opposite(puzzle.pov)
  const lost = materialDiff(puzzle.game.board(), player) - materialDiff(puzzle.game.end().board(), player)
  const line = puzzle.mainline
  for (let k = 1; k < line.length && k < 2 * OPPONENT_MOVES; k += 2) {
    const before = line[k - 1]!.board()
    const to = line[k]!.move.to
    const piece = before.pieceAt(to)
    if (!piece || piece.color !== player || piece.role === 'pawn' || piece.role === 'king') continue
    // the capture wins material on the count (a loose piece, or a rook for a bishop)
    if (see(before, line[k]!.move) < 2) continue
    if (lost < 2) return null
    const start = puzzle.game.board()
    const there = start.pieceAt(to)
    const threatened = there?.role === piece.role && there.color === player && isHanging(start, there, to) && start.attackers(puzzle.pov, to).nonEmpty()
    return threatened ? 'defensiveMove' : 'hangingPiece'
  }
  return null
}

function mateInOne(board: Board): boolean {
  return board.legalMoves().some(m => {
    const b = board.copy()
    b.push(m)
    return b.isCheckmate()
  })
}

function mateInTwo(board: Board): boolean {
  return board.legalMoves().some(m => {
    const b = board.copy()
    b.push(m)
    if (b.isCheckmate()) return true
    const replies = b.legalMoves()
    return replies.length > 0 && replies.every(r => {
      const c = b.copy()
      c.push(r)
      return mateInOne(c)
    })
  })
}

/** After one of the opponent's first two moves, the opponent would mate in two if the player passed. */
export function mateThreat(puzzle: Puzzle): boolean {
  const player = opposite(puzzle.pov)
  const lost = materialDiff(puzzle.game.board(), player) - materialDiff(puzzle.game.end().board(), player)
  if (lost < 2 && !puzzle.game.end().board().isCheckmate()) return false
  for (let k = 1; k < puzzle.mainline.length && k < 4; k += 2) {
    const passed = nullMove(puzzle.mainline[k]!.board())
    if (passed && mateInTwo(passed)) return true
  }
  return false
}
