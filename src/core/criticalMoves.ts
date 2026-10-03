import type { Color } from 'chessops'
import { winPercent, type Score } from './winChance'

export interface Episode {
  /** The first avoidable move; this is the one that gets labeled. */
  firstPly: number
  plies: number[]
}

export const DEFAULT_THRESHOLD = 10
/** A critical move must also leave the player below this win% (about -2 pawns). */
export const DEFAULT_LOSING_BELOW = 33

/**
 * Finds the player's critical moves (a win% drop of more than `threshold` that
 * leaves them below `losingBelow`) and merges consecutive ones into episodes.
 *
 * `evals[i]` is the White-POV score after ply `i` (`evals[0]` is the start
 * position), or null when unknown. Ply `i` is White's move when `i` is odd.
 */
export function criticalEpisodes(
  evals: (Score | null)[],
  player: Color,
  threshold = DEFAULT_THRESHOLD,
  losingBelow = DEFAULT_LOSING_BELOW,
): Episode[] {
  const episodes: Episode[] = []
  let current: Episode | null = null
  for (let ply = player === 'white' ? 1 : 2; ply < evals.length; ply += 2) {
    const before = evals[ply - 1]
    const after = evals[ply]
    const critical =
      before != null &&
      after != null &&
      winPercent(before, player) - winPercent(after, player) > threshold &&
      winPercent(after, player) < losingBelow
    if (critical) {
      if (current) current.plies.push(ply)
      else episodes.push((current = { firstPly: ply, plies: [ply] }))
    } else {
      current = null
    }
  }
  return episodes
}
