import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { subMonths } from 'date-fns'
import * as XLSX from 'xlsx'

const CANADIAN_PROVINCES = ['AB', 'ON', 'NB', 'MB', 'BC', 'QC', 'SK', 'PE', 'NL', 'NS',
                             'ab', 'on', 'nb', 'mb', 'bc', 'qc', 'sk', 'pe', 'nl', 'ns']

const OPEN_LEAD_STATUSES = ['OPEN', 'NEW', 'CONNECTED']
const CLOSED_NURTURE_STATUSES = ['Closed and Nurturing']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerIds = searchParams.get('ownerIds')?.split(',').filter(Boolean) ?? []
    const tier1Only = searchParams.get('tier1Only') === 'true'
    const specialties = searchParams.get('specialties')?.split(',').filter(Boolean) ?? []
    const companyTypes = searchParams.get('companyTypes')?.split(',').filter(Boolean) ?? []
    const dealStatuses = searchParams.get('dealStatuses')?.split(',').filter(Boolean) ?? []
    const locationFilter = searchParams.get('locationFilter') ?? 'all'
    const includeRemoved = searchParams.get('includeRemoved') !== 'false'
    const sixMonthsAgo = subMonths(new Date(), 6)

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

    const TERMINAL_DEAL_STAGES = ['Closed Won', 'Closed Lost', 'Closed LOST', 'Closed PASS']
    const closedDealRows = await prisma.deal.findMany({
      where: { stage: { in: TERMINAL_DEAL_STAGES } },
      select: { contactId: true },
    })
    const closedDealContactIds = Array.from(new Set(
      closedDealRows.map(d => d.contactId).filter(Boolean) as string[]
    ))

    const columnExcludeIds = Array.from(new Set([
      ...(dealContactIdExclude ?? []),
      ...closedDealContactIds,
    ]))

    const baseWhereNoStatus: any = {
      ...(ownerIds.length > 0 ? { ownerId: { in: ownerIds } } : {}),
      ...(specialties.length > 0 ? { specialty: { in: specialties } } : {}),
      professionalStatus: 'Owner',
      ...companyTypeFilter,
      ...locationWhere,
      ...(columnExcludeIds.length > 0 ? { NOT: { contactId: { in: columnExcludeIds } } } : {}),
      ...(!includeRemoved ? { OR: [{ leadStatus: null }, { leadStatus: { not: 'Requested Removal From List' } }] } : {}),
    }

    const [tier1Contacts, openLeadContacts, closedNurtureContacts, owners] = await Promise.all([
      prisma.contact.findMany({ where: { ...baseWhereNoStatus, leadStatus: 'OPEN_DEAL' } }),
      prisma.contact.findMany({ where: { ...baseWhereNoStatus, leadStatus: { in: OPEN_LEAD_STATUSES } } }),
      prisma.contact.findMany({ where: { ...baseWhereNoStatus, leadStatus: { in: CLOSED_NURTURE_STATUSES } } }),
      prisma.owner.findMany(),
    ])

    // Filter closed nurture same as gameplan route
    const filteredClosedNurture = closedNurtureContacts.filter(c => {
      const hasDisposition = c.notInterestedNowResponseDate != null || c.notInterestedAtAllResponseDate != null
      if (!hasDisposition) return true
      const lastTouch = c.ipadShipmentDate ?? c.ipadCoverShipDate ?? null
      return !lastTouch || new Date(lastTouch) < sixMonthsAgo
    })

    const ownerMap = new Map(owners.map(o => [o.ownerId, `${o.firstName} ${o.lastName}`]))

    // Fetch closedNurtureReason for Open Deal contacts
    const openDealContactIds = tier1Contacts.map(c => c.contactId).filter(Boolean) as string[]
    const nurtureReasonRows = await prisma.$queryRaw<{ contactId: string; closedNurtureReason: string | null }[]>`
      SELECT "contactId", "closedNurtureReason"
      FROM deals
      WHERE "contactId" = ANY(${openDealContactIds})
        AND "closedNurtureReason" IS NOT NULL
    `
    const nurtureReasonMap = new Map(nurtureReasonRows.map(r => [r.contactId, r.closedNurtureReason]))

    const parseBucket = (reason: string | null | undefined): { bucket: string; context: string } | null => {
      if (!reason) return null
      const idx = reason.indexOf(' — ')
      if (idx === -1) return { bucket: reason, context: '' }
      return { bucket: reason.slice(0, idx).trim(), context: reason.slice(idx + 3).trim() }
    }

    // Label each contact with its funnel column
    const labelledContacts = [
      ...tier1Contacts.map(c => ({ contact: c, column: 'Open Deal' })),
      ...openLeadContacts.map(c => ({ contact: c, column: 'Initial Outreach' })),
      ...filteredClosedNurture.map(c => ({ contact: c, column: 'Closed & Nurture' })),
    ]

    const allIds = labelledContacts.map(({ contact }) => contact.contactId)

    const START_OF_2026 = new Date('2026-01-01T00:00:00.000Z')

    // Fetch per-contact, per-type counts split by pre/post 2026 + latest activity, in parallel
    const [pre2026Counts, ytdCounts, latestEngagements] = await Promise.all([
      prisma.engagement.groupBy({
        by: ['contactId', 'type'],
        where: { contactId: { in: allIds }, timestamp: { lt: START_OF_2026 } },
        _count: { _all: true },
      }),
      prisma.engagement.groupBy({
        by: ['contactId', 'type'],
        where: { contactId: { in: allIds }, timestamp: { gte: START_OF_2026 } },
        _count: { _all: true },
      }),
      prisma.engagement.findMany({
        where: { contactId: { in: allIds }, timestamp: { lte: new Date() } },
        orderBy: { timestamp: 'desc' },
        distinct: ['contactId'],
        select: { contactId: true, timestamp: true },
      }),
    ])
    const lastActivityMap = new Map(latestEngagements.map(e => [e.contactId, e.timestamp]))

    // Build nested maps: contactId -> type -> count (one per period)
    const buildCountMap = (rows: { contactId: string | null; type: string; _count: { _all: number } }[]) => {
      const map = new Map<string, Record<string, number>>()
      for (const row of rows) {
        if (!row.contactId) continue
        if (!map.has(row.contactId)) map.set(row.contactId, {})
        map.get(row.contactId)![row.type] = row._count._all
      }
      return map
    }
    const pre2026Map = buildCountMap(pre2026Counts)
    const ytdMap = buildCountMap(ytdCounts)

    const fmt = (d: Date | null | undefined) =>
      d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

    const rows = labelledContacts.map(({ contact: c, column }) => {
      const pre = pre2026Map.get(c.contactId) ?? {}
      const ytd = ytdMap.get(c.contactId) ?? {}
      const allCounts = { ...pre }
      for (const [k, v] of Object.entries(ytd)) allCounts[k] = (allCounts[k] ?? 0) + v
      const totalEngagements = Object.values(allCounts).reduce((s, n) => s + n, 0)
      const ipadTouch = (c.ipadShipmentDate ? 1 : 0) + (c.ipadCoverShipDate ? 1 : 0)
      const lastActivity = lastActivityMap.get(c.contactId) ?? c.ipadShipmentDate ?? c.ipadCoverShipDate ?? null

      const emails = (t: Record<string, number>) =>
        (t['EMAIL'] ?? 0) + (t['INCOMING_EMAIL'] ?? 0) + (t['AUTOMATED_EMAIL'] ?? 0)

      return {
        'Name': `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
        'Funnel Column': column,
        'Lead Status': c.leadStatus ?? '',
        'Specialty': c.specialty ?? '',
        'Owner': ownerMap.get(c.ownerId ?? '') ?? 'Unassigned',
        'Tier 1': c.tier1 ? 'Yes' : 'No',
        'City': c.city ?? '',
        'State': c.state ?? '',
        'Practice Type': c.practiceType ?? '',
        'Deal Status': c.dealStatus ?? '',
        'Nurture Category': column === 'Open Deal' ? (parseBucket(nurtureReasonMap.get(c.contactId))?.bucket ?? '') : '',
        'Nurture Context': column === 'Open Deal' ? (parseBucket(nurtureReasonMap.get(c.contactId))?.context ?? '') : '',
        'Last Activity': fmt(lastActivity),
        'Total Outreach': totalEngagements + ipadTouch,
        'Emails (Pre-2026)': emails(pre),
        'Emails (2026+)': emails(ytd),
        'Calls (Pre-2026)': pre['CALL'] ?? 0,
        'Calls (2026+)': ytd['CALL'] ?? 0,
        'Meetings (Pre-2026)': pre['MEETING'] ?? 0,
        'Meetings (2026+)': ytd['MEETING'] ?? 0,
        'Notes (Pre-2026)': pre['NOTE'] ?? 0,
        'Notes (2026+)': ytd['NOTE'] ?? 0,
        'Tasks (Pre-2026)': pre['TASK'] ?? 0,
        'Tasks (2026+)': ytd['TASK'] ?? 0,
        'iPad Shipped': c.ipadShipmentDate ? fmt(c.ipadShipmentDate) : '',
        'iPad Cover Shipped': c.ipadCoverShipDate ? fmt(c.ipadCoverShipDate) : '',
        'iPad Response': c.ipadResponse ? (c.ipadResponseType ?? 'Yes') : '',
        'Interested Date': fmt(c.interestedResponseDate),
        'Not Interested Now Date': fmt(c.notInterestedNowResponseDate),
        'Not Interested At All Date': fmt(c.notInterestedAtAllResponseDate),
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)

    // Auto-size columns
    const colWidths = Object.keys(rows[0] ?? {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String((r as any)[key] ?? '').length)) + 2,
    }))
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Gameplan Export')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="gameplan-export-${date}.xlsx"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
