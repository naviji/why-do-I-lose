// Usage: npx tsx scripts/tag-candidates.ts <candidates.json>
// Tags each candidate in place (see src/tactics/tag.ts) and prints tag counts.
import { readFileSync, writeFileSync } from 'node:fs'
import { tagMove } from '../src/tactics/tag'

const [path] = process.argv.slice(2)
if (!path) throw new Error('usage: tag-candidates <candidates.json>')
const candidates = JSON.parse(readFileSync(path, 'utf8'))
const counts: Record<string, number> = {}
for (const c of candidates) {
  c.tags = tagMove(c)
  for (const t of c.tags) counts[t] = (counts[t] ?? 0) + 1
}
writeFileSync(path, JSON.stringify(candidates, null, 2) + '\n')
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', '))
