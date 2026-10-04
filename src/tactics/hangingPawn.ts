// "Hanging pawn": cook.py's hanging_piece deliberately skips pawns. This mirrors it
// for pawns, and requires the engine line to leave the player a pawn down.
//
// The opponent may first make up to MAX_FORCING forcing moves before taking the pawn:
// a check, or a move that threatens to win material (Nc4 hitting a rook, Ra8, Nxb6).
import type { Board } from './board'
import type { ChildNode, Puzzle } from './puzzle'
import { winningCaptures } from './threat'
import { isHanging, isInBadSpot, materialDiff } from './util'

export const MAX_FORCING = 2

/** The opponent's move gives check, attacks a loose player piece, or threatens a winning capture. */
function isForcing(node: ChildNode, pov: Board['turn']): boolean {
  const after = node.board()
  if (after.isCheck()) return true
  for (const sq of after.attacks(node.move.to)) {
    const piece = after.pieceAt(sq)
    if (piece && piece.color !== pov && piece.role !== 'king' && isInBadSpot(after, sq)) return true
  }
  return winningCaptures(after, pov).length > 0
}

function isForcedReply(node: ChildNode): boolean {
  const before = node.parent.board()
  if (before.isCheck()) return true
  const prev = node.parent as ChildNode
  return prev.move !== undefined && prev.move.to === node.move.to && !!prev.parent.board().pieceAt(prev.move.to)
}

export function hangingPawn(puzzle: Puzzle): boolean {
  const line = puzzle.mainline
  // opponent moves are at odd indices
  for (let k = 1, forcing = 0; k < line.length && forcing <= MAX_FORCING; k += 2) {
    if (pawnWon(puzzle, k)) return true
    // answering a check or taking back a piece is forced: it neither needs to be forcing
    // nor uses up one of the forcing moves
    if (isForcedReply(line[k]!)) continue
    if (!isForcing(line[k]!, puzzle.pov)) return false
    forcing++
  }
  return false
}

function pawnWon(puzzle: Puzzle, k: number): boolean {
  const node = puzzle.mainline[k]!
  const prev = puzzle.mainline[k - 1]!
  const to = node.move.to
  const before = prev.board()
  const captured = before.pieceAt(to)
  // a pawn taken while dealing with a check isn't a pawn the player left hanging
  if (before.isCheck()) return false
  if (!captured || captured.role !== 'pawn' || captured.color === puzzle.pov) return false
  if (!isHanging(before, captured, to)) return false
  // recapturing what the player's previous move just took is a trade
  if (prev.move.to === to && prev.parent.board().pieceAt(to)) return false
  const player = captured.color
  const start = materialDiff(puzzle.game.board(), player)
  return start - materialDiff(puzzle.game.end().board(), player) >= 1
}
