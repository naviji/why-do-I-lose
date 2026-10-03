// "Losing exchange": the player's capture starts an exchange that loses material.
// Not a lichess-puzzler motif (cook.py only looks at the opponent's reply).
import { makeSquare, opposite, parseUci } from 'chessops/util'
import { Board, type Move, type Role, type Square } from './board'
import { materialDiff } from './util'

const VALUE: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 }
const ORDER: Role[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']

/**
 * Static exchange evaluation of a capture, in pawns, for the side making it.
 * Each side recaptures on the square with its cheapest attacker (x-rays included)
 * and may stop at any point. Pins are ignored.
 */
export function see(board: Board, move: Move): number {
  const b = board.pos.board
  const sq: Square = move.to
  const mover = board.pieceAt(move.from)
  if (!mover) throw new Error('no piece to move')
  const captured = board.isEnPassant(move) ? 'pawn' : board.pieceAt(sq)?.role
  if (!captured) return 0

  const gain: number[] = [VALUE[captured]]
  let occupied = b.occupied.without(move.from)
  if (board.isEnPassant(move)) occupied = occupied.without(sq + (mover.color === 'white' ? -8 : 8))
  let onSquare: Role = move.promotion ?? mover.role
  let side = opposite(mover.color)
  for (;;) {
    const attackers = board.pos.kingAttackers(sq, side, occupied).intersect(occupied)
    if (attackers.isEmpty()) break
    const role = ORDER.find(r => attackers.intersect(b[r]).nonEmpty())!
    const from = attackers.intersect(b[role]).first()!
    // a king may only recapture if the square is then safe
    if (role === 'king' && board.pos.kingAttackers(sq, opposite(side), occupied.without(from)).intersect(occupied).nonEmpty()) break
    gain.push(VALUE[onSquare] - gain[gain.length - 1]!)
    occupied = occupied.without(from)
    onSquare = role
    side = opposite(side)
  }
  for (let d = gain.length - 1; d > 0; d--) gain[d - 1] = -Math.max(-gain[d - 1]!, gain[d]!)
  return gain[0]!
}

export interface LosingExchange {
  square: string
  /** Exchange count on the square, in pawns (negative). */
  see: number
  /** Material the player is down at the end of the engine line, versus before the move. */
  materialLost: number
}

/** The player's move `move` from `fen`, followed by the opponent's best `line`. */
export function losingExchange({ fen, move, line }: { fen: string; move: string; line: string[] }): LosingExchange | null {
  const board = Board.fromFen(fen)
  const player = board.turn
  const m = parseUci(move) as Move
  if (!board.isCapture(m)) return null
  const count = see(board, m)
  if (count >= 0) return null
  const before = materialDiff(board, player)
  const after = board.copy()
  after.push(m)
  for (const uci of line) after.push(parseUci(uci) as Move)
  const materialLost = before - materialDiff(after, player)
  if (materialLost < 1) return null
  return { square: makeSquare(m.to), see: count, materialLost }
}
