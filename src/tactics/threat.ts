// Threats: what the opponent could win if the side to move passed.
import { Board, type Color, type Move } from './board'
import { see } from './exchange'

/** The same position with the other side to move (a null move); undefined if that side would be in check. */
export function nullMove(board: Board): Board | undefined {
  if (board.isCheck()) return undefined
  const b = board.copy()
  b.pos.turn = b.turn === 'white' ? 'black' : 'white'
  b.pos.epSquare = undefined
  return b.isCheck() ? undefined : b
}

/** Captures `by` could make right now (with `by` to move) that win material on the count. */
export function winningCaptures(board: Board, by: Color): Move[] {
  const b = board.turn === by ? board : nullMove(board)
  if (!b) return []
  return b.legalMoves().filter(m => b.isCapture(m) && see(b, m) > 0)
}
