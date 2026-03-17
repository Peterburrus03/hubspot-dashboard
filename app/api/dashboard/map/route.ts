import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { readFileSync } from 'fs'
import { join } from 'path'

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
    const tier1Only = searchParams.get('tier1Only') === 'true'
    const specialties = searchParams.get('specialties')?.split(',').filter(Boolean) ?? []
    const companyTypes = searchParams.get('companyTypes')?.split(',').filter(Boolean) ?? []
    const leadStatuses = searchParams.get('leadStatuses')?.split(',').filter(Boolean) ?? []
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

    const baseWhere: any = {
      ...(ownerIds.length > 0 ? { ownerId: { in: ownerIds } } : {}),
      ...(tier1Only ? { tier1: true } : {}),
      ...(specialties.length > 0 ? { specialty: { in: specialties } } : {}),
      ...(leadStatuses.length > 0 ? { leadStatus: { in: leadStatuses } } : {}),
      professionalStatus: 'Owner',
      ...companyTypeFilter,
      ...locationWhere,
      ...(dealContactIdExclude ? { NOT: { contactId: { in: dealContactIdExclude } } } : {}),
      ...(!includeRemoved ? { OR: [{ leadStatus: null }, { leadStatus: { not: 'Requested Removal From List' } }] } : {}),
    }

    const [contacts, owners] = await Promise.all([
      prisma.contact.findMany({
        where: baseWhere,
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
          interestedResponseDate: true,
          notInterestedNowResponseDate: true,
          notInterestedAtAllResponseDate: true,
        },
      }),
      prisma.owner.findMany(),
    ])

    const ownerMap = new Map(owners.map(o => [o.ownerId, `${o.firstName} ${o.lastName}`]))

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
      const fullName = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()
      const key = normalizeName(fullName)
      const csvRow = csvByName.get(key)

      const disposition = contact.interestedResponseDate ? 'interested'
        : contact.notInterestedNowResponseDate ? 'notNow'
        : contact.notInterestedAtAllResponseDate ? 'notInterested'
        : 'fairGame'

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
      total: contacts.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      adgLocations,
    })
  } catch (error: any) {
    console.error('Map API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
