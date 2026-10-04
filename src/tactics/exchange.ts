// "Counting": an exchange that loses on the count, started by the player's capture
// or by the opponent's reply. Not a lichess-puzzler motif.
import { makeSquare, opposite, parseUci } from 'chessops/util'
import { Board, type Move, type Role, type Square } from './board'
import { isHanging, materialDiff } from './util'

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

export interface Counting {
  square: string
  /** Exchange count on the square, in pawns, for whoever starts it. */
  see: number
  /** Material the player is down at the end of the engine line, versus before the move. */
  materialLost: number
  /** Who starts the exchange: the player's move itself, or the opponent's first reply. */
  by: 'player' | 'opponent'
}

/**
 * "Counting": material lost on an exchange that loses on the count.
 * Either the player's move `move` is a capture that loses on the count, or the
 * opponent's first reply captures a defended player piece and wins on the count
 * (an undefended piece is cook.py's hanging piece instead).
 */
export function counting({ fen, move, line }: { fen: string; move: string; line: string[] }): Counting | null {
  const board = Board.fromFen(fen)
  const player = board.turn
  const m = parseUci(move) as Move
  const result = playerStarts(board, m, line) ?? opponentStarts(board, m, line)
  if (!result) return null
  const end = board.copy()
  end.push(m)
  for (const uci of line) end.push(parseUci(uci) as Move)
  const materialLost = materialDiff(board, player) - materialDiff(end, player)
  if (materialLost < 1) return null
  return { ...result, materialLost }
}

type Start = Omit<Counting, 'materialLost'>

function playerStarts(board: Board, m: Move, line: string[]): Start | null {
  if (!board.isCapture(m)) return null
  // the opponent has to take back on that square; otherwise the loss comes from elsewhere
  const reply = line[0] ? (parseUci(line[0]) as Move) : undefined
  if (!reply || reply.to !== m.to) return null
  const count = see(board, m)
  return count < 0 ? { square: makeSquare(m.to), see: count, by: 'player' } : null
}

function opponentStarts(board: Board, m: Move, line: string[]): Start | null {
  if (!line[0] || board.isCapture(m)) return null
  const after = board.copy()
  after.push(m)
  if (after.isCheck()) return null
  const reply = parseUci(line[0]) as Move
  if (!after.isCapture(reply)) return null
  const target = after.pieceAt(reply.to)
  if (!target || isHanging(after, target, reply.to)) return null
  const count = see(after, reply)
  return count > 0 ? { square: makeSquare(reply.to), see: count, by: 'opponent' } : null
}
