import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'AOSN Doctor - M&A Target Match (No Formulas).csv'
const OUT = 'lib/peer-referrals.json'

const normalizeName = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ')

const lines = readFileSync(SRC, 'utf8').split(/\r?\n/).filter(Boolean)
const [, ...rows] = lines

const byName = {}
let withReferrals = 0
let empty = 0
const dupes = []

for (const line of rows) {
  const cells = line.split(',')
  if (cells.length < 17) continue
  const fullName = cells[1].trim()
  if (!fullName) continue

  const top5 = []
  for (let i = 0; i < 5; i++) {
    const name = cells[2 + i * 3]?.trim()
    const scoreRaw = cells[3 + i * 3]?.trim()
    const explanation = cells[4 + i * 3]?.trim()
    if (!name) continue
    const score = Number(scoreRaw)
    top5.push({ rank: i + 1, name, score: Number.isFinite(score) ? score : null, explanation })
  }

  const key = normalizeName(fullName)
  if (byName[key]) dupes.push(fullName)
  byName[key] = top5
  if (top5.length) withReferrals++
  else empty++
}

writeFileSync(OUT, JSON.stringify(byName, null, 2))
console.log(`Wrote ${OUT}`)
console.log(`  contacts: ${Object.keys(byName).length}`)
console.log(`  with referrals: ${withReferrals}`)
console.log(`  empty: ${empty}`)
console.log(`  duplicates (last write wins): ${dupes.length}${dupes.length ? ' — ' + dupes.join(', ') : ''}`)
