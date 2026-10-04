// Tags a critical move: the player's move m followed by the opponent's best line,
// run through the ported lichess-puzzler tagger plus this app's own detectors.
import type { Score } from '../core/winChance'
import { cook } from './cook'
import { defensiveMove } from './defensiveMove'
import { discoveredAttackOnPiece } from './discovered'
import { counting } from './exchange'
import { exposedKingLate } from './exposedKing'
import { hangingAfterCheck } from './hangingAfterCheck'
import { hangingPawn } from './hangingPawn'
import { categories } from './categories'
import { lateLoss, mateThreat } from './fallback'
import { missedTactic } from './missed'
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
  /** The engine's whole better line, the position before the opponent's previous move, and that move. */
  betterLine?: string[]
  prevFen?: string
  prevMove?: string
}

export function tagMove(c: CriticalMove): string[] {
  const tags = tagAllowed(c)
  // nothing the opponent can punish: the mistake may be a tactic the player missed
  if (categories(tags)[0] === 'positionalMistake' && c.betterLine?.length && c.prevFen && c.prevMove)
    for (const t of missedTactic({ prevFen: c.prevFen, prevMove: c.prevMove, betterLine: c.betterLine }))
      if (!tags.includes(t)) tags.push(t)
  return tags
}

function tagAllowed({ fen, move, line: engineLine, lineScore, better }: CriticalMove): string[] {
  // a puzzle mainline ends on the solver's move: m + an odd number of opponent plies
  const full = engineLine.slice(0, MAX_PLIES - 1)
  let line = trimToGain(fen, move, full)
  if (line.length % 2 === 0) line = line.slice(0, -1)
  if (!line.length) return []
  const cp = 'mate' in lineScore ? (lineScore.mate > 0 ? 999999 : -999999) : lineScore.cp
  const puzzle = make(fen, [move, ...line], cp)
  let tags: string[] = cook(puzzle).filter(t => !META.has(t))
  if (!tags.includes('hangingPiece') && hangingAfterCheck(puzzle)) tags.push('hangingPiece')
  // a threat already on the board is a missed defence, not something the move left hanging
  if (defensiveMove({ fen, move, line: full, better })) {
    tags = tags.filter(t => t !== 'hangingPiece')
    tags.push('defensiveMove')
  } else if (hangingPawn(puzzle)) tags.push('hangingPawn')
  if (!tags.includes('discoveredAttack') && discoveredAttackOnPiece(puzzle)) tags.push('discoveredAttack')
  if (!tags.includes('exposedKing') && exposedKingLate(puzzle)) tags.push('exposedKing')
  if (counting({ fen, move, line })) tags.push('counting')
  // nothing above fired: look further into the line
  if (categories(tags)[0] === 'positionalMistake') {
    // a mate threat explains any material given up to stop it
    if (mateThreat(puzzle)) tags.push('mateThreat')
    else {
      const late = lateLoss(puzzle)
      if (late) tags.push(late)
    }
  }
  return tags
}
