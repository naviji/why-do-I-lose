import type { Color } from 'chessops'
import type { Score } from '../core/winChance'

export type Source = 'lichess' | 'chesscom' | 'pgn'
export type Speed = 'ultraBullet' | 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence'

export interface Game {
  /** `lichess:<id>`, `chesscom:<id>` or `pgn:<fingerprint>`. */
  id: string
  source: Source
  player: Color
  result: 'win' | 'loss' | 'draw'
  termination: 'normal' | 'time' | 'other'
  speed: Speed
  /** Milliseconds since 1970. */
  playedAt: number
  /** Standard UCI from the start position. */
  moves: string[]
  /** White-POV score after each ply (index 0 = start), from Lichess `[%eval]`. */
  evals?: (Score | null)[]
  /** Seconds left after each ply, from `[%clk]`. */
  clocks?: (number | null)[]
  pgn: string
}
