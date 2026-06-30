import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  ACTIVE_PIPELINE_STAGES,
  TERMINAL_DEAL_STAGES,
  classifyContact,
} from '@/lib/universe'

const CANADIAN_PROVINCES = ['AB', 'ON', 'NB', 'MB', 'BC', 'QC', 'SK', 'PE', 'NL', 'NS',
                             'ab', 'on', 'nb', 'mb', 'bc', 'qc', 'sk', 'pe', 'nl', 'ns']

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

  return lines.slice(1).map(line => {
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    fields.push(current.trim())

    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = fields[i] ?? '' })
    return obj
  })
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerIds = searchParams.get('ownerIds')?.split(',').filter(Boolean) ?? []
    // Note: tier1Only and leadStatuses are intentionally NOT read here. The map universe
    // mirrors the Game Plan universe, which ignores both (tier1 is shown via marker size,
    // and bucketing supersedes a raw leadStatus filter).
    const specialties = searchParams.get('specialties')?.split(',').filter(Boolean) ?? []
    const companyTypes = searchParams.get('companyTypes')?.split(',').filter(Boolean) ?? []
    const dealStatuses = searchParams.get('dealStatuses')?.split(',').filter(Boolean) ?? []
    const locationFilter = searchParams.get('locationFilter') ?? 'all'
    const includeRemoved = searchParams.get('includeRemoved') !== 'false'

    const companyTypeFilter = companyTypes.length > 0 ? { practiceType: { in: companyTypes } } : {}
    const locationWhere = locationFilter === 'us'
      ? { state: { notIn: CANADIAN_PROVINCES } }
      : locationFilter === 'international'
      ? { state: { in: CANADIAN_PROVINCES } }
      : {}

    let dealContactIdExclude: string[] | null = null
    if (dealStatuses.length > 0) {
      const matchingContacts = await prisma.contact.findMany({
        where: { dealStatus: { in: dealStatuses } },
        select: { contactId: true },
      })
      dealContactIdExclude = matchingContacts.map(c => c.contactId).filter(Boolean) as string[]
    }

    // Active-pipeline and terminally-closed deal membership drive bucketing. Fetched
    // globally (NOT scoped to the owner set) because the universe includes pipeline
    // contacts regardless of professionalStatus — see the OR clause below.
    const [pipelineDealRows, terminalDealRows] = await Promise.all([
      prisma.deal.findMany({ where: { stage: { in: ACTIVE_PIPELINE_STAGES } }, select: { contactId: true } }),
      prisma.deal.findMany({ where: { stage: { in: TERMINAL_DEAL_STAGES } }, select: { contactId: true } }),
    ])
    const pipelineContactIdList = Array.from(new Set(pipelineDealRows.map(d => d.contactId).filter(Boolean) as string[]))
    const pipelineContactIds = new Set(pipelineContactIdList)
    const terminalContactIds = new Set(terminalDealRows.map(d => d.contactId).filter(Boolean) as string[])

    // Universe membership mirrors the Game Plan exactly: owner contacts (the funnel
    // columns) OR any active-pipeline contact regardless of professionalStatus. Like the
    // Game Plan universe, this intentionally ignores the tier1Only and leadStatuses
    // filters — the bucket is already derived from leadStatus / deal stage.
    // The dealStatuses exclude applies only to the owner/column branch — the Game Plan's
    // In Pipeline bucket never applies it, so pipeline contacts are never dropped by it.
    const ownerBranch: any = {
      professionalStatus: 'Owner',
      ...(dealContactIdExclude ? { NOT: { contactId: { in: dealContactIdExclude } } } : {}),
    }
    const andClauses: any[] = [
      { OR: [ownerBranch, { contactId: { in: pipelineContactIdList } }] },
    ]
    if (!includeRemoved) {
      andClauses.push({ OR: [{ leadStatus: null }, { leadStatus: { not: 'Requested Removal From List' } }] })
    }
    const universeFilter: any = {
      ...(ownerIds.length > 0 ? { ownerId: { in: ownerIds } } : {}),
      ...(specialties.length > 0 ? { specialty: { in: specialties } } : {}),
      ...companyTypeFilter,
      ...locationWhere,
      AND: andClauses,
    }

    const [contacts, owners] = await Promise.all([
      prisma.contact.findMany({
        where: universeFilter,
        select: {
          contactId: true,
          firstName: true,
          lastName: true,
          specialty: true,
          ownerId: true,
          leadStatus: true,
          tier1: true,
          city: true,
          state: true,
          notes: true,
        },
      }),
      prisma.owner.findMany(),
    ])

    const ownerMap = new Map(owners.map(o => [o.ownerId, `${o.firstName} ${o.lastName}`]))

    // closedNurtureReason (used to bucket OPEN_DEAL contacts), scoped to fetched contacts.
    const contactIds = contacts.map(c => c.contactId).filter(Boolean) as string[]
    const nurtureReasonRows = await prisma.deal.findMany({
      where: { contactId: { in: contactIds }, closedNurtureReason: { not: null } },
      select: { contactId: true, closedNurtureReason: true },
    })
    const nurtureReasonMap = new Map(
      nurtureReasonRows
        .filter(r => r.contactId)
        .map(r => [r.contactId as string, r.closedNurtureReason])
    )

    // Parse CSV and build name lookup
    const csvPath = join(process.cwd(), 'veterinary_specialists_geocoded.csv')
    const csvText = readFileSync(csvPath, 'utf-8')
    const csvRows = parseCSV(csvText)

    const csvByName = new Map<string, Record<string, string>>()
    for (const row of csvRows) {
      const key = normalizeName(row.Name ?? '')
      if (key) csvByName.set(key, row)
    }

    // Load verified manual mappings (from reviewed fuzzy match Excel)
    type ManualMapping = {
      hubspotName: string; csvName: string
      latitude: number; longitude: number
      clinic: string | null; city: string | null; state: string | null
    }
    let manualMappings: ManualMapping[] = []
    try {
      const mappingsPath = join(process.cwd(), 'name_mappings.json')
      manualMappings = JSON.parse(readFileSync(mappingsPath, 'utf-8'))
    } catch { /* file may not exist yet */ }

    const manualByName = new Map<string, ManualMapping>()
    for (const m of manualMappings) {
      manualByName.set(normalizeName(m.hubspotName), m)
    }

    // Cross-reference contacts with CSV
    const matched: any[] = []
    const unmatched: any[] = []

    for (const contact of contacts) {
      // Bucket the contact exactly as the Game Plan does. Contacts outside the
      // addressable universe (terminally closed deals, or lead statuses that map to
      // no column) classify to null and are dropped from the map entirely.
      const disposition = classifyContact({
        leadStatus: contact.leadStatus,
        isInPipeline: pipelineContactIds.has(contact.contactId),
        hasTerminalDeal: terminalContactIds.has(contact.contactId),
        closedNurtureReason: nurtureReasonMap.get(contact.contactId),
        notes: contact.notes,
      })
      if (!disposition) continue

      const fullName = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()
      const key = normalizeName(fullName)
      const csvRow = csvByName.get(key)

      const base = {
        contactId: contact.contactId,
        name: fullName,
        specialty: contact.specialty,
        ownerName: ownerMap.get(contact.ownerId ?? '') ?? 'Unassigned',
        leadStatus: contact.leadStatus,
        tier1: contact.tier1,
        city: contact.city,
        state: contact.state,
        disposition,
      }

      if (csvRow && csvRow.latitude && csvRow.longitude) {
        matched.push({
          ...base,
          latitude: parseFloat(csvRow.latitude),
          longitude: parseFloat(csvRow.longitude),
          clinic: csvRow.Final_Clinic || null,
          market: csvRow.Market || null,
          practiceTag: csvRow.Final_tag || null,
        })
      } else {
        // Fall back to manually verified mappings
        const manual = manualByName.get(key)
        if (manual) {
          matched.push({
            ...base,
            latitude: manual.latitude,
            longitude: manual.longitude,
            clinic: manual.clinic,
            market: null,
            practiceTag: null,
          })
        } else {
          unmatched.push(base)
        }
      }
    }

    // AOSN/ADG locations — distinct layer from the addressable universe
    const adgLocations = csvRows
      .filter(row => row.Final_Scaled_Tag?.includes('AOSN') && row.latitude && row.longitude)
      .map(row => ({
        name: row.Name,
        clinic: row.Final_Clinic,
        specialty: row.Specialty,
        city: row.Final_City,
        state: row.Final_State,
        market: row.Market,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        tag: row.Final_Scaled_Tag,
      }))

    return NextResponse.json({
      matched,
      unmatched,
      // total reflects the addressable universe (classified contacts only), so it
      // matches the Game Plan universe total rather than the raw contact count.
      total: matched.length + unmatched.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      adgLocations,
    })
  } catch (error: any) {
    console.error('Map API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
