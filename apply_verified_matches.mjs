// Reads yellow/green highlighted rows from match_analysis.xlsx
// and saves verified name mappings to name_mappings.json
import XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const HIGHLIGHT_COLORS = new Set(['FFFF00', 'C1F0C8']) // yellow + green

const wb = XLSX.readFile('match_analysis.xlsx', { cellStyles: true })
const ws = wb.Sheets['Fuzzy Matches (Review)']
const range = XLSX.utils.decode_range(ws['!ref'])

// Read header row to know column positions
const headers = []
for (let C = range.s.c; C <= range.e.c; C++) {
  const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })]
  headers.push(cell?.v ?? '')
}

const colIdx = (name) => headers.indexOf(name)

const mappings = []

for (let R = 1; R <= range.e.r; R++) {
  const cellA = ws[XLSX.utils.encode_cell({ r: R, c: 0 })]
  const fgColor = cellA?.s?.fgColor?.rgb
  if (!fgColor || !HIGHLIGHT_COLORS.has(fgColor)) continue

  const getVal = (colName) => {
    const idx = colIdx(colName)
    if (idx < 0) return ''
    const cell = ws[XLSX.utils.encode_cell({ r: R, c: idx })]
    return cell?.v ?? ''
  }

  const hubspotName = getVal('Contact Name')
  const csvName = getVal('CSV Name')
  const lat = getVal('Latitude')
  const lng = getVal('Longitude')
  const clinic = getVal('CSV Clinic')
  const city = getVal('CSV City')
  const state = getVal('CSV State')

  if (hubspotName && csvName && lat && lng) {
    mappings.push({
      hubspotName: hubspotName.trim(),
      csvName: csvName.trim(),
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      clinic: clinic || null,
      city: city || null,
      state: state || null,
    })
  }
}

writeFileSync(
  join(__dirname, 'name_mappings.json'),
  JSON.stringify(mappings, null, 2)
)

console.log(`Saved ${mappings.length} verified mappings to name_mappings.json`)
mappings.slice(0, 5).forEach(m => console.log(` · "${m.hubspotName}" → "${m.csvName}" (${m.latitude}, ${m.longitude})`))
