import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@/generated/prisma'

export async function GET() {
  try {
    const ytdStart = new Date(new Date().getFullYear(), 0, 1)

    // 1. Overall counts by type
    const byType = await prisma.engagement.groupBy({
      by: ['type'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })

    // 2. Email breakdown by direction
    const byDirection = await prisma.engagement.groupBy({
      by: ['emailDirection'],
      where: { type: 'EMAIL' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })

    // 3. Date range of all engagements
    const dateRange = await prisma.engagement.aggregate({
      _min: { timestamp: true },
      _max: { timestamp: true },
      _count: { id: true },
    })

    // 4. Weekly breakdown YTD — all types
    type WeekRow = {
      week_start: Date
      emails_manual: bigint
      emails_automated: bigint
      emails_incoming: bigint
      emails_other: bigint
      calls: bigint
      notes: bigint
      meetings: bigint
      tasks: bigint
      total: bigint
    }

    const weeklyBreakdown = await prisma.$queryRaw<WeekRow[]>(Prisma.sql`
      SELECT
        DATE_TRUNC('week', timestamp) AS week_start,
        COUNT(*) FILTER (WHERE type = 'EMAIL' AND ("emailDirection" IS NULL OR "emailDirection" NOT IN ('AUTOMATED_EMAIL','INCOMING_EMAIL'))) AS emails_manual,
        COUNT(*) FILTER (WHERE type = 'EMAIL' AND "emailDirection" = 'AUTOMATED_EMAIL')  AS emails_automated,
        COUNT(*) FILTER (WHERE type = 'EMAIL' AND "emailDirection" = 'INCOMING_EMAIL')   AS emails_incoming,
        COUNT(*) FILTER (WHERE type = 'EMAIL' AND "emailDirection" IS NOT NULL AND "emailDirection" NOT IN ('AUTOMATED_EMAIL','INCOMING_EMAIL')) AS emails_other,
        COUNT(*) FILTER (WHERE type = 'CALL')    AS calls,
        COUNT(*) FILTER (WHERE type = 'NOTE')    AS notes,
        COUNT(*) FILTER (WHERE type = 'MEETING') AS meetings,
        COUNT(*) FILTER (WHERE type = 'TASK')    AS tasks,
        COUNT(*)                                  AS total
      FROM engagements
      WHERE timestamp >= ${ytdStart}
      GROUP BY week_start
      ORDER BY week_start
    `)

    // 5. Unique owners with activity YTD
    const activeOwners = await prisma.engagement.groupBy({
      by: ['ownerId'],
      where: { timestamp: { gte: ytdStart } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })

    const ownerMap = new Map(
      (await prisma.owner.findMany()).map((o) => [
        o.ownerId,
        [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || o.ownerId,
      ])
    )

    return NextResponse.json({
      dateRange: {
        earliest: dateRange._min.timestamp,
        latest: dateRange._max.timestamp,
        total: dateRange._count.id,
      },
      byType: byType.map((r) => ({ type: r.type, count: r._count.id })),
      emailsByDirection: byDirection.map((r) => ({ direction: r.emailDirection ?? '(null)', count: r._count.id })),
      weeklyBreakdown: weeklyBreakdown.map((r) => ({
        week: r.week_start.toISOString().split('T')[0],
        emails_manual: Number(r.emails_manual),
        emails_automated: Number(r.emails_automated),
        emails_incoming: Number(r.emails_incoming),
        emails_other: Number(r.emails_other),
        calls: Number(r.calls),
        notes: Number(r.notes),
        meetings: Number(r.meetings),
        tasks: Number(r.tasks),
        total: Number(r.total),
        counted_as_outreach: Number(r.emails_manual) + Number(r.calls),
      })),
      activeOwners: activeOwners.map((r) => ({
        owner: ownerMap.get(r.ownerId ?? '') ?? r.ownerId ?? 'unknown',
        count: r._count.id,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
