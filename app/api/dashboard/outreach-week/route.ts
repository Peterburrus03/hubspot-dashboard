import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWeekStart, initWeekAssignments, DEFAULT_POOL_FILTERS, type OutreachPoolFilters } from '@/lib/outreach/pool'

async function findActiveCycle(): Promise<{ weekStart: Date; cycleWeek: number } | null> {
  const now = getWeekStart()
  for (let i = 0; i < 3; i++) {
    const candidate = new Date(now)
    candidate.setUTCDate(candidate.getUTCDate() - i * 7)
    const count = await prisma.outreachWeekAssignment.count({ where: { weekStart: candidate } })
    if (count > 0) return { weekStart: candidate, cycleWeek: i + 1 }
  }
  return null
}

export async function GET() {
  try {
    const cycle = await findActiveCycle()

    if (!cycle) {
      return NextResponse.json({ initialized: false, weekStart: null, cycleWeek: null, cycleEnds: null, weeks: null })
    }

    const { weekStart, cycleWeek } = cycle
    const cycleEnds = new Date(weekStart)
    cycleEnds.setUTCDate(cycleEnds.getUTCDate() + 21)

    const assignments = await prisma.outreachWeekAssignment.findMany({ where: { weekStart } })
    const contactIds = assignments.map(a => a.contactId)

    // Week 1 date window — anyone with a completed 09-tag task in this range is auto-contacted
    const week1End = new Date(weekStart)
    week1End.setUTCDate(week1End.getUTCDate() + 7)

    const [contacts, owners, latestEngagements, engagementCounts, completions, campaignTouches] = await Promise.all([
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
      prisma.engagement.findMany({
        where: {
          type: 'TASK',
          taskStatus: 'COMPLETED',
          body: { startsWith: '09' },
          contactId: { in: contactIds },
          timestamp: { gte: weekStart, lt: week1End },
        },
        select: { contactId: true },
      }),
    ])

    const ownerMap = new Map(owners.map(o => [o.ownerId, `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim()]))
    const engMap = new Map(latestEngagements.map(e => [e.contactId, e.timestamp]))
    const countMap = new Map(engagementCounts.map(e => [e.contactId, e._count._all]))
    const completionMap = new Map(completions.map(c => [c.contactId, c]))
    const contactMap = new Map(contacts.map(c => [c.contactId, c]))
    const autoContactedSet = new Set(campaignTouches.map(e => e.contactId).filter(Boolean) as string[])

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
        completion: {
          contacted: (comp?.contacted ?? false) || autoContactedSet.has(c.contactId),
          meetingSet: comp?.meetingSet ?? false,
          meetingDate: comp?.meetingDate?.toISOString() ?? null,
          meetingNotes: comp?.meetingNotes ?? null,
        },
      })
    }

    return NextResponse.json({
      initialized: true,
      weekStart: weekStart.toISOString(),
      cycleWeek,
      cycleEnds: cycleEnds.toISOString(),
      weeks,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cycle = await findActiveCycle()
    if (cycle) {
      await prisma.outreachWeekAssignment.deleteMany({ where: { weekStart: cycle.weekStart } })
      await prisma.outreachCompletion.deleteMany({ where: { weekStart: cycle.weekStart } })
    }
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
