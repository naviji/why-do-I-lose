/** A completed search line. The score is from the side to move's point of view. */
export interface UciInfo {
  depth: number
  score: { cp: number } | { mate: number }
  pv: string[]
}

export function parseInfo(line: string): UciInfo | null {
  const t = line.trim().split(/\s+/)
  if (t[0] !== 'info' || t.includes('lowerbound') || t.includes('upperbound')) return null
  const depth = t.indexOf('depth')
  const score = t.indexOf('score')
  const pv = t.indexOf('pv')
  if (depth < 0 || score < 0 || pv < 0) return null
  const value = Number(t[score + 2])
  return {
    depth: Number(t[depth + 1]),
    score: t[score + 1] === 'mate' ? { mate: value } : { cp: value },
    pv: t.slice(pv + 1),
  }
}
