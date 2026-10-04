// Missed tactics: the motif in the engine's better line, with the player as the solver.
// The puzzle starts from the opponent's previous move, as cook.py expects, and only
// counts when the line actually wins material (or mates).
import { cook } from './cook'
import { make } from './puzzle'
import { trimToGain } from './trim'
import { materialDiff } from './util'

const MOTIFS = new Set([
  'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'hangingPiece', 'trappedPiece', 'deflection',
  'attraction', 'interference', 'intermezzo', 'capturingDefender', 'xRayAttack', 'advancedPawn', 'mate',
  'backRankMate', 'smotheredMate', 'anastasiaMate', 'arabianMate', 'bodenMate', 'dovetailMate', 'hookMate',
  'doubleBishopMate', 'attackingF2F7',
])
/** Material the better line must win, in pawns. */
export const MIN_GAIN = 2

export interface MissedInput {
  /** Position before the opponent's previous move. */
  prevFen: string
  prevMove: string
  /** The engine's best line instead of the player's move, starting with the better move. */
  betterLine: string[]
}

export function missedTactic({ prevFen, prevMove, betterLine }: MissedInput): string[] {
  let line = trimToGain(prevFen, prevMove, betterLine.slice(0, 11))
  if (line.length % 2 === 0) line = line.slice(0, -1)
  if (!line.length) return []
  const puzzle = make(prevFen, [prevMove, ...line])
  const end = puzzle.game.end().board()
  const mated = end.isCheckmate()
  const gain = materialDiff(end, puzzle.pov) - materialDiff(puzzle.mainline[0]!.board(), puzzle.pov)
  if (!mated && gain < MIN_GAIN) return []
  return cook(puzzle).filter(t => MOTIFS.has(t))
}
