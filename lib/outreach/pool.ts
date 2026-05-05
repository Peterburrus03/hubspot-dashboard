import { prisma } from '@/lib/db/prisma'
import { subMonths } from 'date-fns'

const TERMINAL_STAGES = ['Closed Won', 'Closed Lost', 'Closed LOST', 'Closed PASS']
const ACTIVE_PIPELINE_STAGES = [
  'Data Collection (including NDA)',
  'LOI Extended',
  'LOI Signed/Diligence',
  'Pre-LOI Analysis',
]
const OPEN_LEAD_STATUSES = ['OPEN', 'NEW', 'CONNECTED']
const CANADIAN_PROVINCES = [
  'AB', 'ON', 'NB', 'MB', 'BC', 'QC', 'SK', 'PE', 'NL', 'NS',
  'ab', 'on', 'nb', 'mb', 'bc', 'qc', 'sk', 'pe', 'nl', 'ns',
]

export interface OutreachPoolFilters {
  ownerIds?: string[]
  companyTypes?: string[]
  locationFilter?: 'all' | 'us' | 'international'
}

// Matches FilterBar defaults — used by cron so the stored pool equals the default view
export const DEFAULT_POOL_FILTERS: OutreachPoolFilters = {
  ownerIds: ['1995098221', '83426466', '48828284'],
  companyTypes: ['Private Practice', 'Private Hybrid Mobile'],
  locationFilter: 'us',
}

function parseBucket(field: string | null | undefined): string | null {
  if (!field) return null
  const idx = field.indexOf(' — ')
  return (idx === -1 ? field : field.slice(0, idx)).trim()
}

export function isUnresponsive(field: string | null | undefined): boolean {
  return parseBucket(field) === 'Unresponsive'
}

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function splitIntoThirds<T>(arr: T[]): [T[], T[], T[]] {
  const n = arr.length
  if (n === 0) return [[], [], []]
  const base = Math.floor(n / 3)
  const rem = n % 3
  const s1 = base + (rem > 0 ? 1 : 0)
  const s2 = base + (rem > 1 ? 1 : 0)
  return [arr.slice(0, s1), arr.slice(s1, s1 + s2), arr.slice(s1 + s2)]
}

export async function computeOutreachPool(
  filters: OutreachPoolFilters = DEFAULT_POOL_FILTERS
): Promise<{ contactId: string; lastActivity: Date | null }[]> {
  const sixMonthsAgo = subMonths(new Date(), 6)

  const ownerFilter = filters.ownerIds?.length ? { ownerId: { in: filters.ownerIds } } : {}
  const companyFilter = filters.companyTypes?.length ? { practiceType: { in: filters.companyTypes } } : {}
  const locationFilter =
    filters.locationFilter === 'us' ? { state: { notIn: CANADIAN_PROVINCES } }
    : filters.locationFilter === 'international' ? { state: { in: CANADIAN_PROVINCES } }
    : {}

  const [closedDealRows, pipelineDealRows] = await Promise.all([
    prisma.deal.findMany({ where: { stage: { in: TERMINAL_STAGES } }, select: { contactId: true } }),
    prisma.deal.findMany({ where: { stage: { in: ACTIVE_PIPELINE_STAGES } }, select: { contactId: true } }),
  ])

  const closedIds = Array.from(new Set(closedDealRows.map(d => d.contactId).filter(Boolean) as string[]))
  const pipelineIds = Array.from(new Set(pipelineDealRows.map(d => d.contactId).filter(Boolean) as string[]))
  const openDealExcludeIds = Array.from(new Set([...closedIds, ...pipelineIds]))

  const exclude = (ids: string[]) => ids.length ? { NOT: { contactId: { in: ids } } } : {}

  const baseWhere = { professionalStatus: 'Owner', ...ownerFilter, ...companyFilter, ...locationFilter }

  const [openLeadContacts, openDealContacts, closedNurtureContacts] = await Promise.all([
    prisma.contact.findMany({
      where: { ...baseWhere, leadStatus: { in: OPEN_LEAD_STATUSES }, ...exclude(closedIds) },
      select: { contactId: true },
    }),
    prisma.contact.findMany({
      where: { ...baseWhere, leadStatus: 'OPEN_DEAL', ...exclude(openDealExcludeIds) },
      select: { contactId: true },
    }),
    prisma.contact.findMany({
      where: { ...baseWhere, leadStatus: 'Closed and Nurturing', ...exclude(closedIds) },
      select: {
        contactId: true,
        notes: true,
        notInterestedNowResponseDate: true,
        notInterestedAtAllResponseDate: true,
        ipadShipmentDate: true,
        ipadCoverShipDate: true,
      },
    }),
  ])

  const openDealContactIds = openDealContacts.map(c => c.contactId)
  const nurtureReasonRows = openDealContactIds.length
    ? await prisma.$queryRaw<{ contactId: string; closedNurtureReason: string | null }[]>`
        SELECT "contactId", "closedNurtureReason" FROM deals
        WHERE "contactId" = ANY(${openDealContactIds}) AND "closedNurtureReason" IS NOT NULL
      `
    : []
  const nurtureReasonMap = new Map(nurtureReasonRows.map(r => [r.contactId, r.closedNurtureReason]))

  const allContactIds = Array.from(new Set([
    ...openLeadContacts.map(c => c.contactId),
    ...openDealContacts.map(c => c.contactId),
    ...closedNurtureContacts.map(c => c.contactId),
  ]))

  const latestEngagements = allContactIds.length
    ? await prisma.engagement.findMany({
        where: { contactId: { in: allContactIds }, timestamp: { lte: new Date() } },
        orderBy: { timestamp: 'desc' },
        distinct: ['contactId'],
        select: { contactId: true, timestamp: true },
      })
    : []
  const engMap = new Map(latestEngagements.map(e => [e.contactId, e.timestamp]))

  const seen = new Set<string>()
  const pool: { contactId: string; lastActivity: Date | null }[] = []

  const add = (contactId: string, fallback?: Date | null) => {
    if (seen.has(contactId)) return
    seen.add(contactId)
    pool.push({ contactId, lastActivity: engMap.get(contactId) ?? fallback ?? null })
  }

  for (const c of openLeadContacts) add(c.contactId)

  for (const c of openDealContacts) {
    if (isUnresponsive(nurtureReasonMap.get(c.contactId))) add(c.contactId)
  }

  for (const c of closedNurtureContacts) {
    if (!isUnresponsive(c.notes)) continue
    const hasDisposition = c.notInterestedNowResponseDate != null || c.notInterestedAtAllResponseDate != null
    const lastTouch = engMap.get(c.contactId) ?? c.ipadShipmentDate ?? c.ipadCoverShipDate ?? null
    if (hasDisposition && lastTouch && new Date(lastTouch) >= sixMonthsAgo) continue
    add(c.contactId, c.ipadShipmentDate ?? c.ipadCoverShipDate ?? null)
  }

  pool.sort((a, b) => {
    if (!a.lastActivity && !b.lastActivity) return 0
    if (!a.lastActivity) return -1
    if (!b.lastActivity) return 1
    return a.lastActivity.getTime() - b.lastActivity.getTime()
  })

  return pool
}

export async function initWeekAssignments(
  weekStart: Date,
  filters: OutreachPoolFilters = DEFAULT_POOL_FILTERS
): Promise<{ count: number; alreadyInitialized: boolean }> {
  const existing = await prisma.outreachWeekAssignment.count({ where: { weekStart } })
  if (existing > 0) return { count: existing, alreadyInitialized: true }

  const pool = await computeOutreachPool(filters)
  const allContactIds = pool.map(p => p.contactId)

  // Contacts already reached via 09 campaign in the past 14 days go into Week 1 (done)
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14)

  const recentCampaignRows = allContactIds.length
    ? await prisma.engagement.findMany({
        where: {
          type: 'TASK',
          taskStatus: 'COMPLETED',
          body: { startsWith: '09' },
          contactId: { in: allContactIds },
          timestamp: { gte: twoWeeksAgo },
        },
        select: { contactId: true },
      })
    : []

  const week1Ids = new Set(recentCampaignRows.map(r => r.contactId).filter(Boolean) as string[])

  const w1 = pool.filter(p => week1Ids.has(p.contactId))
  const remaining = pool.filter(p => !week1Ids.has(p.contactId))

  // Split the rest evenly into Week 2 (this week) and Week 3 (next week)
  const mid = Math.ceil(remaining.length / 2)
  const w2 = remaining.slice(0, mid)
  const w3 = remaining.slice(mid)

  const data = [
    ...w1.map(({ contactId }) => ({ weekStart, contactId, week: 1 })),
    ...w2.map(({ contactId }) => ({ weekStart, contactId, week: 2 })),
    ...w3.map(({ contactId }) => ({ weekStart, contactId, week: 3 })),
  ]

  await prisma.outreachWeekAssignment.createMany({ data, skipDuplicates: true })
  return { count: data.length, alreadyInitialized: false }
}
