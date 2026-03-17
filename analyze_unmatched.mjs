// Run with: node analyze_unmatched.mjs
import { PrismaClient } from './generated/prisma/index.js'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Fuse from 'fuse.js'
import XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseCSV(csv) {
  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  return lines.slice(1).map(line => {
    const fields = []
    let cur = '', inQ = false
    for (const c of line) {
      if (c === '"') inQ = !inQ
      else if (c === ',' && !inQ) { fields.push(cur.trim()); cur = '' }
      else cur += c
    }
    fields.push(cur.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = fields[i] ?? '' })
    return obj
  })
}

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
}

// ── Main ───────────────────────────────────────────────────────────────────────

const CANADIAN_PROVINCES = ['AB','ON','NB','MB','BC','QC','SK','PE','NL','NS',
                             'ab','on','nb','mb','bc','qc','sk','pe','nl','ns']

// Broad filter: all Private Practice owners in the US, no lead status or owner restriction
const contacts = await prisma.contact.findMany({
  where: {
    professionalStatus: 'Owner',
    practiceType: { in: ['Private Practice', 'Private Hybrid Mobile'] },
    state: { notIn: CANADIAN_PROVINCES },
  },
  select: {
    contactId: true, firstName: true, lastName: true,
    specialty: true, city: true, state: true, ownerId: true,
    interestedResponseDate: true,
    notInterestedNowResponseDate: true,
    notInterestedAtAllResponseDate: true,
  }
})

const owners = await prisma.owner.findMany()
await prisma.$disconnect()

const ownerMap = new Map(owners.map(o => [o.ownerId, `${o.firstName} ${o.lastName}`]))

// Parse CSV
const csvRows = parseCSV(readFileSync(join(__dirname, 'veterinary_specialists_geocoded.csv'), 'utf-8'))
const csvWithCoords = csvRows.filter(r => r.latitude && r.longitude)

// Exact match lookup
const exactByName = new Map()
for (const row of csvWithCoords) {
  exactByName.set(normalize(row.Name), row)
}

// Fuse fuzzy search on CSV names
const fuse = new Fuse(csvWithCoords, {
  keys: ['Name'],
  threshold: 0.4,       // 0=exact, 1=anything — 0.4 is fairly lenient
  includeScore: true,
  minMatchCharLength: 3,
})

// ── Build rows ─────────────────────────────────────────────────────────────────

const exactMatched = []
const fuzzyMatched = []
const noMatch = []

for (const c of contacts) {
  const fullName = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
  const key = normalize(fullName)
  const disposition = c.interestedResponseDate ? 'Interested'
    : c.notInterestedNowResponseDate ? 'Not Now'
    : c.notInterestedAtAllResponseDate ? 'Not Interested'
    : 'Fair Game'
  const owner = ownerMap.get(c.ownerId ?? '') ?? 'Unassigned'

  const base = {
    'Contact Name': fullName,
    'Specialty': c.specialty ?? '',
    'City': c.city ?? '',
    'State': c.state ?? '',
    'Disposition': disposition,
    'Owner': owner,
  }

  const exactRow = exactByName.get(key)
  if (exactRow) {
    exactMatched.push({
      ...base,
      'Match Type': 'Exact',
      'CSV Name': exactRow.Name,
      'CSV Clinic': exactRow.Final_Clinic,
      'CSV City': exactRow.Final_City,
      'CSV State': exactRow.Final_State,
      'Match Score': '100%',
      'Latitude': exactRow.latitude,
      'Longitude': exactRow.longitude,
    })
  } else {
    // Fuzzy search
    const results = fuse.search(fullName)
    const best = results[0]

    if (best) {
      const score = Math.round((1 - best.score) * 100)
      const row = {
        ...base,
        'Match Type': 'Fuzzy',
        'CSV Name': best.item.Name,
        'CSV Clinic': best.item.Final_Clinic,
        'CSV City': best.item.Final_City,
        'CSV State': best.item.Final_State,
        'Match Score': `${score}%`,
        'Latitude': best.item.latitude,
        'Longitude': best.item.longitude,
      }
      fuzzyMatched.push(row)
    } else {
      noMatch.push({
        ...base,
        'Match Type': 'No Match',
        'CSV Name': '',
        'CSV Clinic': '',
        'CSV City': '',
        'CSV State': '',
        'Match Score': '0%',
        'Latitude': '',
        'Longitude': '',
      })
    }
  }
}

// ── Write Excel ────────────────────────────────────────────────────────────────

const wb = XLSX.utils.book_new()

// Sheet 1: Fuzzy matches — the ones worth reviewing
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet(fuzzyMatched),
  'Fuzzy Matches (Review)'
)

// Sheet 2: No match at all
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet(noMatch.length ? noMatch : [{ Note: 'All contacts matched!' }]),
  'No Match'
)

// Sheet 3: Exact matches (for reference)
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet(exactMatched),
  'Exact Matches'
)

// Sheet 4: Full summary
const summary = [
  { Category: 'Total Addressable Universe', Count: contacts.length },
  { Category: 'Exact Matches', Count: exactMatched.length },
  { Category: 'Fuzzy Matches', Count: fuzzyMatched.length },
  { Category: 'No Match', Count: noMatch.length },
  { Category: 'Total Mappable (Exact + Fuzzy)', Count: exactMatched.length + fuzzyMatched.length },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary')

const outPath = join(__dirname, 'match_analysis.xlsx')
XLSX.writeFile(wb, outPath)

console.log('\n── Match Analysis ──────────────────────────')
console.log(`Total universe:     ${contacts.length}`)
console.log(`Exact matches:      ${exactMatched.length}`)
console.log(`Fuzzy matches:      ${fuzzyMatched.length}`)
console.log(`No match:           ${noMatch.length}`)
console.log(`Total mappable:     ${exactMatched.length + fuzzyMatched.length}`)
console.log(`\nExcel saved to: match_analysis.xlsx`)
