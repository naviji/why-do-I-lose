// "Discovered attack", looser than cook.py's: an opponent move uncovers a line piece's
// attack on a player piece that is worth more than the attacker or undefended, and the
// player ends the line down material. Unlike cook.py, any piece may cash it in
// (fxg6 uncovers Rf2 on the queen, which then falls to Bxg6).
import { opposite } from './board'
import type { Puzzle } from './puzzle'
import { isHanging, materialDiff, rayPieceTypes, values } from './util'

const OPPONENT_MOVES = 2

export function discoveredAttackOnPiece(puzzle: Puzzle): boolean {
  const player = opposite(puzzle.pov)
  const lost = materialDiff(puzzle.game.board(), player) - materialDiff(puzzle.game.end().board(), player)
  for (let k = 1; k < puzzle.mainline.length && k < 2 * OPPONENT_MOVES; k += 2) {
    const node = puzzle.mainline[k]!
    const before = node.parent.board()
    const after = node.board()
    for (const [sq, piece] of after.pieceMap()) {
      if (piece.color !== player || piece.role === 'king') continue
      for (const from of after.attackers(puzzle.pov, sq)) {
        const attacker = after.pieceAt(from)!
        if (from === node.move.to || !rayPieceTypes.includes(attacker.role)) continue
        if (before.attackers(puzzle.pov, sq).has(from)) continue // not uncovered by this move
        if (values[piece.role] <= values[attacker.role] && !isHanging(after, piece, sq)) continue
        if (lost >= Math.min(values[piece.role], 3)) return true
      }
    }
  }
  return false
}
