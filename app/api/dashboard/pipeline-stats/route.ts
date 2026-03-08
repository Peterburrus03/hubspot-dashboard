import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@/generated/prisma'

const PIPELINE_ID = '705209413'

function startOfWeek(d: Date): Date {
  // Use UTC so this matches DATE_TRUNC('week', ...) in Postgres
  const day = d.getUTCDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // roll back to Monday
  const result = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff))
  return result
}

function isoWeekLabel(d: Date): string {
  const weekOfMonth = Math.ceil(d.getDate() / 7)
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  return `W${weekOfMonth} ${month}`
}

export async function GET() {
  try {
    const now = new Date()
    const ytdStart = new Date(now.getFullYear(), 0, 1)
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const wtdStart = startOfWeek(now)
    const historyStart = ytdStart

    // Outreach = non-automated emails + calls + notes + meetings + completed tasks only
    const outreachWhere = (gte: Date) => ({
      timestamp: { gte },
      OR: [
        { type: 'CALL' },
        { type: 'NOTE' },
        { type: 'MEETING' },
        { type: 'TASK', taskStatus: 'COMPLETED' },
        { type: 'EMAIL', emailDirection: null },
        { type: 'EMAIL', emailDirection: { not: 'AUTOMATED_EMAIL' } },
      ],
    })

    const [ytdOutreach, mtdOutreach, wtdOutreach] = await Promise.all([
      prisma.engagement.count({ where: { ...outreachWhere(ytdStart), timestamp: { gte: ytdStart, lte: now } } }),
      prisma.engagement.count({ where: { ...outreachWhere(mtdStart), timestamp: { gte: mtdStart, lte: now } } }),
      prisma.engagement.count({ where: { ...outreachWhere(wtdStart), timestamp: { gte: wtdStart, lte: now } } }),
    ])

    // Deal milestone counts (AOSN pipeline only)
    const dealBase = { pipelineId: PIPELINE_ID }
    const [
      ytdNDAsResult,
      mtdNDAsResult,
      wtdNDAsResult,
      ytdNDADvmsResult,
      ytdLOIsResult,
      ytdAPAsResult,
      closedEBITDAResult,
    ] = await Promise.all([
      prisma.deal.count({ where: { ...dealBase, ndaSignedDate: { gte: ytdStart } } }),
      prisma.deal.count({ where: { ...dealBase, ndaSignedDate: { gte: mtdStart } } }),
      prisma.deal.count({ where: { ...dealBase, ndaSignedDate: { gte: wtdStart } } }),
      prisma.deal.aggregate({ where: { ...dealBase, ndaSignedDate: { gte: ytdStart } }, _sum: { numDvms: true } }),
      prisma.deal.count({ where: { ...dealBase, loiSignedDate: { gte: ytdStart } } }),
      prisma.deal.count({ where: { ...dealBase, stage: 'APA Signed' } }),
      prisma.deal.aggregate({ where: { ...dealBase, stage: 'Closed Won', closedDate: { gte: ytdStart } }, _sum: { ebitda: true } }),
    ])

    // Weekly outreach history — cap at now, dedupe emails by (contact, date), count only completed tasks
    type WeekRow = { week_start: Date; outreach: bigint }
    const weeklyOutreach = await prisma.$queryRaw<WeekRow[]>(Prisma.sql`
      SELECT
        DATE_TRUNC('week', timestamp) AS week_start,
        COUNT(*) FILTER (
          WHERE type = 'CALL'
             OR type = 'NOTE'
             OR type = 'MEETING'
             OR (type = 'TASK' AND "taskStatus" = 'COMPLETED')
        )
        + COUNT(DISTINCT CASE
            WHEN type = 'EMAIL' AND ("emailDirection" IS NULL OR "emailDirection" != 'AUTOMATED_EMAIL')
            THEN "contactId" || '|' || timestamp::date
          END)
        AS outreach
      FROM engagements
      WHERE timestamp >= ${historyStart}
        AND timestamp <= ${now}
      GROUP BY week_start
      ORDER BY week_start
    `)

    // Weekly NDA history
    type NdaRow = { week_start: Date; count: bigint }
    const weeklyNDAs = await prisma.$queryRaw<NdaRow[]>(Prisma.sql`
      SELECT
        DATE_TRUNC('week', "ndaSignedDate") AS week_start,
        COUNT(*) AS count
      FROM deals
      WHERE "ndaSignedDate" >= ${historyStart}
        AND "ndaSignedDate" <= ${now}
        AND "pipelineId" = ${PIPELINE_ID}
      GROUP BY week_start
      ORDER BY week_start
    `)

    const ndaByWeek = new Map(weeklyNDAs.map((r) => [r.week_start.toISOString(), Number(r.count)]))
    const weeklyHistory = weeklyOutreach.map((r) => ({
      week: isoWeekLabel(r.week_start),
      weekStart: r.week_start.toISOString(),
      outreach: Number(r.outreach),
      ndas: ndaByWeek.get(r.week_start.toISOString()) ?? 0,
    }))

    // Per-type breakdown for WTD / MTD / YTD
    type TypeBreakdown = { emails: number; calls: number; notes: number; meetings: number }
    async function typeBreakdown(gte: Date): Promise<TypeBreakdown> {
      const rows = await prisma.$queryRaw<{ type: string; cnt: bigint }[]>(Prisma.sql`
        SELECT type, COUNT(*) AS cnt
        FROM engagements
        WHERE timestamp >= ${gte}
          AND (
            type IN ('CALL','NOTE','MEETING')
            OR (type = 'EMAIL' AND ("emailDirection" IS NULL OR "emailDirection" != 'AUTOMATED_EMAIL'))
          )
        GROUP BY type
      `)
      const m = new Map(rows.map((r) => [r.type, Number(r.cnt)]))
      return { emails: m.get('EMAIL') ?? 0, calls: m.get('CALL') ?? 0, notes: m.get('NOTE') ?? 0, meetings: m.get('MEETING') ?? 0 }
    }

    const [wtdBreakdown, mtdBreakdown, ytdBreakdown] = await Promise.all([
      typeBreakdown(wtdStart),
      typeBreakdown(mtdStart),
      typeBreakdown(ytdStart),
    ])

    return NextResponse.json({
      actuals: {
        wtdOutreach,
        mtdOutreach,
        ytdOutreach,
        wtdNDAs: wtdNDAsResult,
        mtdNDAs: mtdNDAsResult,
        ytdNDAs: ytdNDAsResult,
        ytdNDADvms: ytdNDADvmsResult._sum.numDvms ?? 0,
        ytdLOIs: ytdLOIsResult,
        ytdAPAs: ytdAPAsResult,
        closedEBITDA: Math.round(closedEBITDAResult._sum.ebitda ?? 0),
        breakdown: { wtd: wtdBreakdown, mtd: mtdBreakdown, ytd: ytdBreakdown },
      },
      weeklyHistory,
    })
  } catch (error: any) {
    console.error('Pipeline stats error:', error)
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
