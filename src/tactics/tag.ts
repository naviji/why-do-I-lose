// Tags a critical move: the player's move m followed by the opponent's best line,
// run through the ported lichess-puzzler tagger plus this app's own detectors.
import type { Score } from '../core/winChance'
import { cook } from './cook'
import { defensiveMove } from './defensiveMove'
import { discoveredAttackOnPiece } from './discovered'
import { counting } from './exchange'
import { exposedKingLate, openedFileAttack } from './exposedKing'
import { hangingPawn } from './hangingPawn'
import { make } from './puzzle'
import { trimToGain } from './trim'

export const MAX_PLIES = 12
// cook.py's defensiveMove describes the opponent's solution; ours (below) describes the player's move
const META = new Set(['defensiveMove', 'equality', 'advantage', 'crushing', 'oneMove', 'short', 'long', 'veryLong'])

export interface CriticalMove {
  fen: string
  /** The player's move, standard UCI. */
  move: string
  /** The opponent's best line after it. */
  line: string[]
  /** Engine score of the line, from the opponent's (side to move) point of view. */
  lineScore: Score
  /** The engine's best move instead of `move`. */
  better?: string
}

export function tagMove({ fen, move, line: engineLine, lineScore, better }: CriticalMove): string[] {
  // a puzzle mainline ends on the solver's move: m + an odd number of opponent plies
  const full = engineLine.slice(0, MAX_PLIES - 1)
  let line = trimToGain(fen, move, full)
  if (line.length % 2 === 0) line = line.slice(0, -1)
  if (!line.length) return []
  const cp = 'mate' in lineScore ? (lineScore.mate > 0 ? 999999 : -999999) : lineScore.cp
  const puzzle = make(fen, [move, ...line], cp)
  let tags: string[] = cook(puzzle).filter(t => !META.has(t))
  // a threat already on the board is a missed defence, not something the move left hanging
  if (defensiveMove({ fen, move, line: full, better })) {
    tags = tags.filter(t => t !== 'hangingPiece')
    tags.push('defensiveMove')
  } else if (hangingPawn(puzzle)) tags.push('hangingPawn')
  if (!tags.includes('discoveredAttack') && discoveredAttackOnPiece(puzzle)) tags.push('discoveredAttack')
  if (!tags.includes('exposedKing') && (exposedKingLate(puzzle) || openedFileAttack(puzzle))) tags.push('exposedKing')
  if (counting({ fen, move, line })) tags.push('counting')
  return tags
}
