import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWeekStart, initWeekAssignments, DEFAULT_POOL_FILTERS, type OutreachPoolFilters } from '@/lib/outreach/pool'

async function findActiveWeekStart(): Promise<Date> {
  const now = getWeekStart()
  for (let i = 0; i < 3; i++) {
    const candidate = new Date(now)
    candidate.setUTCDate(candidate.getUTCDate() - i * 7)
    const count = await prisma.outreachWeekAssignment.count({ where: { weekStart: candidate } })
    if (count > 0) return candidate
  }
  return now
}

export async function GET() {
  try {
    const weekStart = await findActiveWeekStart()

    const assignments = await prisma.outreachWeekAssignment.findMany({ where: { weekStart } })
    if (assignments.length === 0) {
      return NextResponse.json({ initialized: false, weekStart: weekStart.toISOString(), weeks: null })
    }

    const contactIds = assignments.map(a => a.contactId)

    const [contacts, owners, latestEngagements, engagementCounts, completions] = await Promise.all([
      prisma.contact.findMany({
        where: { contactId: { in: contactIds } },
        select: {
          contactId: true, firstName: true, lastName: true,
          specialty: true, ownerId: true, tier1: true,
          dealStatus: true, leadStatus: true,
          practiceType: true, state: true,
          ipadShipmentDate: true, ipadCoverShipDate: true,
        },
      }),
      prisma.owner.findMany(),
      prisma.engagement.findMany({
        where: { contactId: { in: contactIds }, timestamp: { lte: new Date() } },
        orderBy: { timestamp: 'desc' },
        distinct: ['contactId'],
        select: { contactId: true, timestamp: true },
      }),
      prisma.engagement.groupBy({
        by: ['contactId'],
        where: { contactId: { in: contactIds } },
        _count: { _all: true },
      }),
      prisma.outreachCompletion.findMany({ where: { weekStart } }),
    ])

    const ownerMap = new Map(owners.map(o => [o.ownerId, `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim()]))
    const engMap = new Map(latestEngagements.map(e => [e.contactId, e.timestamp]))
    const countMap = new Map(engagementCounts.map(e => [e.contactId, e._count._all]))
    const completionMap = new Map(completions.map(c => [c.contactId, c]))
    const contactMap = new Map(contacts.map(c => [c.contactId, c]))

    const weeks: Record<number, any[]> = { 1: [], 2: [], 3: [] }

    for (const a of assignments) {
      const c = contactMap.get(a.contactId)
      if (!c) continue
      const comp = completionMap.get(a.contactId)
      weeks[a.week].push({
        contactId: c.contactId,
        name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
        specialty: c.specialty ?? null,
        ownerId: c.ownerId ?? null,
        ownerName: ownerMap.get(c.ownerId ?? '') ?? 'Unassigned',
        tier1: c.tier1 ?? false,
        dealStatus: c.dealStatus ?? null,
        status: c.leadStatus ?? null,
        lastActivity: engMap.get(c.contactId)?.toISOString() ?? null,
        outreachCount: (countMap.get(c.contactId) ?? 0) + (c.ipadShipmentDate ? 1 : 0) + (c.ipadCoverShipDate ? 1 : 0),
        practiceType: c.practiceType ?? null,
        state: c.state ?? null,
        completion: comp ? {
          contacted: comp.contacted,
          meetingSet: comp.meetingSet,
          meetingDate: comp.meetingDate?.toISOString() ?? null,
          meetingNotes: comp.meetingNotes ?? null,
        } : { contacted: false, meetingSet: false, meetingDate: null, meetingNotes: null },
      })
    }

    return NextResponse.json({ initialized: true, weekStart: weekStart.toISOString(), weeks })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const weekStart = await findActiveWeekStart()
    await prisma.outreachWeekAssignment.deleteMany({ where: { weekStart } })
    await prisma.outreachCompletion.deleteMany({ where: { weekStart } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const weekStart = getWeekStart()
    let filters: OutreachPoolFilters = DEFAULT_POOL_FILTERS
    try {
      const body = await request.json()
      if (body?.filters) filters = { ...DEFAULT_POOL_FILTERS, ...body.filters }
    } catch {}
    const result = await initWeekAssignments(weekStart, filters)
    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
