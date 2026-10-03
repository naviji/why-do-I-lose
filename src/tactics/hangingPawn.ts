// "Hanging pawn": cook.py's hanging_piece deliberately skips pawns. This mirrors it
// for pawns, and requires the engine line to leave the player a pawn down.
import type { Puzzle } from './puzzle'
import { isHanging, materialDiff, values } from './util'

export function hangingPawn(puzzle: Puzzle): boolean {
  if (puzzle.mainline.length < 2) return false
  const [first, reply] = puzzle.mainline as [(typeof puzzle.mainline)[0], (typeof puzzle.mainline)[0]]
  const to = reply.move.to
  const afterFirst = first.board()
  const captured = afterFirst.pieceAt(to)
  // a pawn taken while dealing with a check isn't a pawn the player left hanging
  if (afterFirst.isCheck()) return false
  if (!captured || captured.role !== 'pawn' || captured.color === puzzle.pov) return false
  if (!isHanging(afterFirst, captured, to)) return false
  // recapturing what the player's move just took is a trade
  const playerCapture = puzzle.game.board().pieceAt(first.move.to)
  if (playerCapture && values[playerCapture.role] >= values.pawn && first.move.to === to) return false
  const player = captured.color
  const before = materialDiff(puzzle.game.board(), player)
  const end = puzzle.game.end().board()
  return before - materialDiff(end, player) >= 1
}
