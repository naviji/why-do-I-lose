import type { Color } from 'chessops'

/** Engine score from White's point of view. */
export type Score = { cp: number } | { mate: number }

// Lichess formula: https://github.com/lichess-org/lila/pull/11148 (ui/ceval/src/winningChances.ts)
const MULTIPLIER = -0.00368208

const rawWinningChances = (cp: number): number => 2 / (1 + Math.exp(MULTIPLIER * cp)) - 1

const winningChances = (score: Score): number => {
  if ('mate' in score) {
    const cp = (21 - Math.min(10, Math.abs(score.mate))) * 100
    return rawWinningChances(score.mate > 0 ? cp : -cp)
  }
  return rawWinningChances(Math.min(Math.max(-1000, score.cp), 1000))
}

/** Win percentage (0..100) for `pov`, given a White-POV score. */
export function winPercent(score: Score, pov: Color): number {
  const chances = winningChances(score)
  return 50 + 50 * (pov === 'white' ? chances : -chances)
}
