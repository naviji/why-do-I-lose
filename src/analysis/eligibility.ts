import type { Game } from '../import/types'

/**
 * Every imported game is standard and finished (normalize rejects the rest). All results
 * are analysed: a losing mistake in a game that was later won still needs fixing.
 */
export const isAnalyzable = (game: Game): boolean => game.moves.length >= 4
