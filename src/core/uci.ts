import type { Position } from 'chessops/chess'
import type { Move } from 'chessops/types'
import { normalizeMove } from 'chessops/chess'
import { makeUci } from 'chessops/util'

/** UCI with castling as king e1g1/e1c1 (chessops uses king-takes-rook, e1h1). */
export function standardUci(pos: Position, move: Move): string {
  const m = normalizeMove(pos, move)
  if ('from' in m && pos.board.getRole(m.from) === 'king' && pos.board.rook.has(m.to) && pos.board.getColor(m.to) === pos.turn) {
    const toFile = m.to > m.from ? 6 : 2
    return makeUci({ from: m.from, to: (m.from & ~7) | toFile })
  }
  return makeUci(m)
}
