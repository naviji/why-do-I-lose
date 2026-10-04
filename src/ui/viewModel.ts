// Pure view models for the UI: names, links, import filters, ranking and the board.
// Components only render what these return.
import { parseFen } from 'chessops/fen'
import { makeSquare } from 'chessops/util'
import type { Piece } from 'chessops/types'

export type Site = 'lichess' | 'chesscom'
export type Speed = 'ultraBullet' | 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence' | 'daily'
export type Side = 'white' | 'black'

export interface ImportFilters {
  speeds: Speed[]
  rated: 'all' | 'rated' | 'casual'
  max: number | null // newest N games; null = all
  from?: number
  to?: number
  eloRange?: [number, number | null]
}

const NAMES: Record<string, string> = {
  hangingPiece: 'Hanging piece', hangingPawn: 'Hanging pawn', defensiveMove: 'Defensive move',
  discoveredAttack: 'Discovered attack', positionalMistake: 'Positional mistake', doubleCheck: 'Double check',
  pawnEndgame: 'Pawn endgame', exposedKing: 'Exposed king', kingsideAttack: 'Kingside attack',
  queensideAttack: 'Queenside attack', trappedPiece: 'Trapped piece', advancedPawn: 'Advanced pawn',
  backRankMate: 'Back rank mate', smotheredMate: 'Smothered mate', capturingDefender: 'Capturing the defender',
  xRayAttack: 'X-ray attack', flagged: 'Lost on time',
}

export function categoryName(tag: string): string {
  if (NAMES[tag]) return NAMES[tag]
  const words = tag.replace(/([A-Z])/g, ' $1').toLowerCase().trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Our own categories have no Lichess puzzle theme.
const NO_THEME = new Set(['counting', 'hangingPawn', 'positionalMistake', 'flagged'])

export function puzzleUrl(tag: string): string | null {
  return NO_THEME.has(tag) ? null : `https://lichess.org/training/${tag}`
}

const SPEEDS: Record<Site, Speed[]> = {
  lichess: ['ultraBullet', 'bullet', 'blitz', 'rapid', 'classical', 'correspondence'],
  chesscom: ['bullet', 'blitz', 'rapid', 'daily'],
}

export function speedsFor(site: Site): Speed[] {
  return SPEEDS[site]
}

export const SPEED_NAMES: Record<Speed, string> = {
  ultraBullet: 'UltraBullet', bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classical: 'Classical',
  correspondence: 'Correspondence', daily: 'Daily',
}

export function defaultFilters(): ImportFilters {
  return { speeds: ['blitz', 'rapid', 'classical'], rated: 'all', max: 500 }
}

export function filterSummary(f: ImportFilters): string {
  const parts = [f.speeds.map(s => SPEED_NAMES[s]).join(', ') || 'No time control']
  if (f.rated !== 'all') parts.push(f.rated)
  parts.push(f.max === null ? 'all games' : `${f.max} newest`)
  return parts.join(' · ')
}

export interface Ranked<T> { category: string; games: number; examples: T[] }

export function rankCategories<T extends { gameId: string; category: string }>(findings: T[]): Ranked<T>[] {
  const by = new Map<string, { games: Set<string>; examples: T[] }>()
  for (const f of findings) {
    const c = by.get(f.category) ?? { games: new Set(), examples: [] }
    c.games.add(f.gameId)
    c.examples.push(f)
    by.set(f.category, c)
  }
  return [...by].map(([category, c]) => ({ category, games: c.games.size, examples: c.examples }))
    .sort((a, b) => b.games - a.games || categoryName(a.category).localeCompare(categoryName(b.category)))
}

// How each category reads after "You most often ...".
const VERB: Record<string, string> = {
  defensiveMove: 'miss a defensive move', hangingPawn: 'hang a pawn', hangingPiece: 'hang a piece',
  positionalMistake: 'make a positional mistake', counting: 'lose material on the count',
  pawnEndgame: 'go wrong in a pawn endgame', flagged: 'lose on time',
}

function verb(tag: string): string {
  return VERB[tag] ?? `allow a ${categoryName(tag).toLowerCase()}`
}

export function headline(ranked: { category: string; games: number }[], analyzed: number): string | null {
  if (!ranked.length) return null
  const top = ranked.filter(r => r.games === ranked[0].games).slice(0, 3)
  const phrases = top.map(r => verb(r.category))
  const list = phrases.length === 1 ? phrases[0]
    : `${phrases.slice(0, -1).join(', ')}${phrases.length > 2 ? ',' : ''} or ${phrases[phrases.length - 1]}`
  const count = `${ranked[0].games} of ${analyzed} analyzed games`
  return `You most often ${list}: ${phrases.length > 1 ? 'each in ' : ''}${count}.`
}

export function analysisUrl(fen: string, side: Side): string {
  return `https://lichess.org/analysis/${fen.trim().replace(/ /g, '_')}?color=${side}`
}

export interface BoardSquare { square: string; light: boolean; piece: Piece | null }

export function boardSquares(fen: string, orientation: Side): BoardSquare[] {
  const board = parseFen(fen).unwrap().board
  const out: BoardSquare[] = []
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = orientation === 'white' ? 7 - row : row
      const file = orientation === 'white' ? col : 7 - col
      const sq = rank * 8 + file
      out.push({ square: makeSquare(sq), light: (rank + file) % 2 === 1, piece: board.get(sq) ?? null })
    }
  }
  return out
}
