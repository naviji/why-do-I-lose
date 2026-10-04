// cook.py's hangingPiece only looks at the opponent's first move. An opponent who checks
// first and takes the loose piece next (Qe8+ Qg8 axb4) is still winning a hanging piece.
import { isHanging, materialDiff, values } from './util'
import type { Puzzle } from './puzzle'

export function hangingAfterCheck(puzzle: Puzzle): boolean {
  const line = puzzle.mainline
  if (line.length < 4 || !line[1]!.board().isCheck()) return false
  const to = line[3]!.move.to
  const start = line[0]!.board()
  const piece = start.pieceAt(to)
  if (!piece || piece.role === 'pawn' || piece.role === 'king' || piece.color === puzzle.pov) return false
  // the same piece, loose already right after the player's move and still loose when taken
  // taken by a piece that already attacked it, not by the checking piece (that's a fork or skewer)
  if (line[3]!.move.from === line[1]!.move.to || !start.attackers(puzzle.pov, to).has(line[3]!.move.from)) return false
  if (line[2]!.move.from === to || line[2]!.move.to === to) return false
  if (!isHanging(start, piece, to) || !isHanging(line[2]!.board(), piece, to)) return false
  const player = piece.color
  return materialDiff(start, player) - materialDiff(puzzle.game.end().board(), player) >= values[piece.role] - 1
}
