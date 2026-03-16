import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@/generated/prisma'

const PIPELINE_ID = '705209413'

// Deals closed before 2026 tracking began, or excluded by agreement — never count toward closed EBITDA
const EXCLUDED_CLOSED_DEAL_IDS = [
  '20861205806', // Great Lakes Vet Dermatology (Stepnik) — Brookfield, WI
  '38221572192', // Dentistry for Animals (Force) — Aptos, CA
  '44585896885', // OREV Specialty Vet Care (Kramer) — Portland, OR
  '38447478071', // Vet Dentistry & Oral Surgery of NM (Bannon) — Algodones, NM
  '42920468852', // Veterinary Cancer & Surgery Specialists (Wooldridge) — Portland, OR
  '42920526097', // Van Lue Veterinary Surgical (Van Lue) — Oviedo, FL
]

function startOfWeek(d: Date): Date {
  // Use UTC so this matches DATE_TRUNC('week', ...) in Postgres
  const day = d.getUTCDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // roll back to Monday
  const result = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff))
  return result
}

const Q1_START_MS = Date.UTC(2026, 0, 5) // Jan 5, 2026
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function isoWeekLabel(d: Date): string {
  const weekNum = Math.round((d.getTime() - Q1_START_MS) / (7 * 24 * 60 * 60 * 1000)) + 1
  const month = MONTHS[d.getUTCMonth()]
  return `Wk ${weekNum} ${month}`
}

export async function GET() {
  try {
    const now = new Date()
    const ytdStart = new Date(now.getFullYear(), 0, 1)
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const wtdStart = startOfWeek(now)
    const lastWeekStart = new Date(wtdStart); lastWeekStart.setDate(wtdStart.getDate() - 7)
    const lastWeekEnd = new Date(wtdStart); lastWeekEnd.setMilliseconds(-1)
    const qtdStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const historyStart = ytdStart

    // Restrict all outreach counts to Owner contacts only (matches activity tab)
    const ownerContactIds = (await prisma.contact.findMany({
      where: { professionalStatus: 'Owner' },
      select: { contactId: true },
    })).map(c => c.contactId)

    // Outreach = deduplicated non-automated emails + calls + meetings + completed tasks
    // Uses raw SQL for consistent email deduplication across all periods
    async function countOutreach(gte: Date, lte: Date = now): Promise<number> {
      const rows = await prisma.$queryRaw<{ cnt: bigint }[]>(Prisma.sql`
        SELECT
          COUNT(*) FILTER (
            WHERE type IN ('CALL', 'MEETING')
               OR (type = 'TASK' AND "taskStatus" = 'COMPLETED')
          )
          + COUNT(DISTINCT CASE
              WHEN type = 'EMAIL' AND ("emailDirection" IS NULL OR "emailDirection" != 'AUTOMATED_EMAIL')
              THEN "contactId" || '|' || timestamp::date
            END)
          AS cnt
        FROM engagements
        WHERE timestamp >= ${gte}
          AND timestamp <= ${lte}
          AND "contactId" = ANY(${ownerContactIds}::text[])
      `)
      return Number(rows[0]?.cnt ?? 0)
    }

    const [ytdOutreach, mtdOutreach, wtdOutreach, lastWeekOutreach, qtdOutreach] = await Promise.all([
      countOutreach(ytdStart),
      countOutreach(mtdStart),
      countOutreach(wtdStart),
      countOutreach(lastWeekStart, lastWeekEnd),
      countOutreach(qtdStart),
    ])

    // Deal milestone counts (AOSN pipeline only)
    const dealBase = { pipelineId: PIPELINE_ID }
    const [
      ytdNDAsResult,
      mtdNDAsResult,
      wtdNDAsResult,
      lastWeekNDAsResult,
      qtdNDAsResult,
      ytdNDADvmsResult,
      ytdLOIsResult,
      ytdAPAsResult,
      closedEBITDAResult,
    ] = await Promise.all([
      prisma.deal.count({ where: { ...dealBase, ndaSignedDate: { gte: ytdStart } } }),
      prisma.deal.count({ where: { ...dealBase, ndaSignedDate: { gte: mtdStart } } }),
      prisma.deal.count({ where: { ...dealBase, ndaSignedDate: { gte: wtdStart } } }),
      prisma.deal.count({ where: { ...dealBase, ndaSignedDate: { gte: lastWeekStart, lte: lastWeekEnd } } }),
      prisma.deal.count({ where: { ...dealBase, ndaSignedDate: { gte: qtdStart } } }),
      prisma.deal.aggregate({ where: { ...dealBase, ndaSignedDate: { gte: ytdStart } }, _sum: { numDvms: true } }),
      prisma.deal.count({ where: { ...dealBase, loiSignedDate: { gte: ytdStart } } }),
      prisma.deal.count({ where: { ...dealBase, stage: 'APA Signed' } }),
      prisma.deal.aggregate({ where: { ...dealBase, stage: 'Closed Won', closedDate: { gte: ytdStart }, dealId: { notIn: EXCLUDED_CLOSED_DEAL_IDS } }, _sum: { ebitda: true } }),
    ])

    // Weekly outreach history — owner contacts only, dedupe emails by (contact, date)
    type WeekRow = { week_start: Date; outreach: bigint }
    const weeklyOutreach = await prisma.$queryRaw<WeekRow[]>(Prisma.sql`
      SELECT
        DATE_TRUNC('week', timestamp) AS week_start,
        COUNT(*) FILTER (
          WHERE type = 'CALL'
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
        AND "contactId" = ANY(${ownerContactIds}::text[])
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

    // iPad campaign — 111 touches hardcoded for week of Jan 5 (matches overview)
    const IPAD_WEEK = new Date('2026-01-05T00:00:00.000Z').toISOString()
    const IPAD_COUNT = 111

    const ndaByWeek = new Map(weeklyNDAs.map((r) => [r.week_start.toISOString(), Number(r.count)]))
    const weeklyHistory = weeklyOutreach.map((r) => {
      const ws = r.week_start.toISOString()
      const ipad = ws === IPAD_WEEK ? IPAD_COUNT : 0
      return {
        week: isoWeekLabel(r.week_start),
        weekStart: ws,
        outreach: Number(r.outreach) + ipad,
        ndas: ndaByWeek.get(ws) ?? 0,
      }
    })

    // Per-type breakdown for WTD / MTD / YTD / Last Week / QTD — owner contacts, emails deduped
    type TypeBreakdown = { emails: number; calls: number; meetings: number }
    async function typeBreakdown(gte: Date, lte: Date = now): Promise<TypeBreakdown> {
      const rows = await prisma.$queryRaw<{ type: string; cnt: bigint }[]>(Prisma.sql`
        SELECT type, COUNT(DISTINCT CASE WHEN type = 'EMAIL' THEN "contactId" || '|' || timestamp::date ELSE "engagementId"::text END) AS cnt
        FROM engagements
        WHERE timestamp >= ${gte} AND timestamp <= ${lte}
          AND "contactId" = ANY(${ownerContactIds}::text[])
          AND (
            type IN ('CALL','MEETING')
            OR (type = 'EMAIL' AND ("emailDirection" IS NULL OR "emailDirection" != 'AUTOMATED_EMAIL'))
          )
        GROUP BY type
      `)
      const m = new Map(rows.map((r) => [r.type, Number(r.cnt)]))
      return { emails: m.get('EMAIL') ?? 0, calls: m.get('CALL') ?? 0, meetings: m.get('MEETING') ?? 0 }
    }

    const [wtdBreakdown, mtdBreakdown, ytdBreakdown, lastWeekBreakdown, qtdBreakdown] = await Promise.all([
      typeBreakdown(wtdStart),
      typeBreakdown(mtdStart),
      typeBreakdown(ytdStart),
      typeBreakdown(lastWeekStart, lastWeekEnd),
      typeBreakdown(qtdStart),
    ])

    const ipadWeekDate = new Date(IPAD_WEEK)
    return NextResponse.json({
      actuals: {
        wtdOutreach,
        mtdOutreach: ipadWeekDate >= mtdStart ? mtdOutreach + IPAD_COUNT : mtdOutreach,
        ytdOutreach: ipadWeekDate >= ytdStart ? ytdOutreach + IPAD_COUNT : ytdOutreach,
        lastWeekOutreach: ipadWeekDate >= lastWeekStart && ipadWeekDate < wtdStart ? lastWeekOutreach + IPAD_COUNT : lastWeekOutreach,
        qtdOutreach: ipadWeekDate >= qtdStart ? qtdOutreach + IPAD_COUNT : qtdOutreach,
        wtdNDAs: wtdNDAsResult,
        mtdNDAs: mtdNDAsResult,
        ytdNDAs: ytdNDAsResult,
        lastWeekNDAs: lastWeekNDAsResult,
        qtdNDAs: qtdNDAsResult,
        ytdNDADvms: ytdNDADvmsResult._sum.numDvms ?? 0,
        ytdLOIs: ytdLOIsResult,
        ytdAPAs: ytdAPAsResult,
        closedEBITDA: Math.round(closedEBITDAResult._sum.ebitda ?? 0),
        breakdown: { wtd: wtdBreakdown, mtd: mtdBreakdown, ytd: ytdBreakdown, lastWeek: lastWeekBreakdown, qtd: qtdBreakdown },
      },
      weeklyHistory,
      lastWeekStart: lastWeekStart.toISOString(),
    })
  } catch (error: any) {
    console.error('Pipeline stats error:', error)
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
