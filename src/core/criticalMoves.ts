import type { Color } from 'chessops'
import { winPercent, type Score } from './winChance'

export interface Episode {
  /** The first avoidable move; this is the one that gets labeled. */
  firstPly: number
  plies: number[]
}

export const DEFAULT_THRESHOLD = 10

/**
 * Finds the player's critical moves and merges consecutive ones into episodes.
 *
 * `evals[i]` is the White-POV score after ply `i` (`evals[0]` is the start
 * position), or null when unknown. Ply `i` is White's move when `i` is odd.
 */
export function criticalEpisodes(
  evals: (Score | null)[],
  player: Color,
  threshold = DEFAULT_THRESHOLD,
): Episode[] {
  const episodes: Episode[] = []
  let current: Episode | null = null
  for (let ply = player === 'white' ? 1 : 2; ply < evals.length; ply += 2) {
    const before = evals[ply - 1]
    const after = evals[ply]
    const critical =
      before != null && after != null && winPercent(before, player) - winPercent(after, player) > threshold
    if (critical) {
      if (current) current.plies.push(ply)
      else episodes.push((current = { firstPly: ply, plies: [ply] }))
    } else {
      current = null
    }
  }
  return episodes
}
