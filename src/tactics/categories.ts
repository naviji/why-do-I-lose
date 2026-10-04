// What the dashboard shows for a critical move: its motif tags, minus tags that only
// describe the context (castling, mate length, endgame type), or "positional mistake"
// when no motif explains the loss.
const CONTEXT = new Set([
  'castling', 'quietMove', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5', 'rookEndgame', 'bishopEndgame',
  'knightEndgame', 'queenEndgame', 'queenRookEndgame', 'promotion', 'enPassant',
])

export function categories(tags: string[]): string[] {
  const motifs = tags.filter(t => !CONTEXT.has(t))
  return motifs.length ? motifs : ['positionalMistake']
}
