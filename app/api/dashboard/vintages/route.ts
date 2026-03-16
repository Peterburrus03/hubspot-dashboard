import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@/generated/prisma'

const PIPELINE_ID = '705209413'

function getQuarterKey(date: Date): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1
  return `Q${q} ${date.getUTCFullYear()}`
}

function avg(arr: number[]): number | null {
  return arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null
}

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000)
}

function fmtDate(d: Date | null): string | null {
  if (!d) return null
  return d.toISOString().split('T')[0]
}

export async function GET() {
  try {
    type DealRow = {
      dealId: string
      dealName: string | null
      dealCreatedAt: Date | null
      engagedDate: Date | null
      ndaSignedDate: Date | null
      loiSignedDate: Date | null
      integrationCompletionDate: Date | null
      officialClosedDate: Date | null
      stage: string | null
    }

    const deals = await prisma.$queryRaw<DealRow[]>(Prisma.sql`
      SELECT
        "dealId",
        "dealName",
        "dealCreatedAt",
        COALESCE("engagedDate", "qualifiedToBuyDate") AS "engagedDate",
        "ndaSignedDate",
        "loiSignedDate",
        "integrationCompletionDate",
        "officialClosedDate",
        stage
      FROM deals
      WHERE "pipelineId" = ${PIPELINE_ID}
        AND "dealCreatedAt" IS NOT NULL
    `)

    type DealDetail = {
      dealId: string
      dealName: string | null
      stage: string | null
      dealCreatedAt: string | null
      engagedDate: string | null
      ndaSignedDate: string | null
      loiSignedDate: string | null
      integrationCompletionDate: string | null
      officialClosedDate: string | null
      milestone: string
    }

    type Cohort = {
      engaged: number
      ndas: number
      lois: number
      apas: number
      closed: number
      daysToNda: number[]
      daysNdaToLoi: number[]
      daysLoiToApa: number[]
      daysApaToClose: number[]
      deals: DealDetail[]
    }

    const cohorts = new Map<string, Cohort>()

    for (const deal of deals) {
      const key = getQuarterKey(deal.dealCreatedAt!)
      if (!cohorts.has(key)) {
        cohorts.set(key, { engaged: 0, ndas: 0, lois: 0, apas: 0, closed: 0, daysToNda: [], daysNdaToLoi: [], daysLoiToApa: [], daysApaToClose: [], deals: [] })
      }
      const c = cohorts.get(key)!
      c.engaged++

      const engagedDate = deal.engagedDate
      let milestone = 'Engaged'

      if (deal.ndaSignedDate) {
        c.ndas++
        milestone = 'NDA'
        if (engagedDate) c.daysToNda.push(daysBetween(engagedDate, deal.ndaSignedDate))

        if (deal.loiSignedDate) {
          c.lois++
          milestone = 'LOI'
          c.daysNdaToLoi.push(daysBetween(deal.ndaSignedDate, deal.loiSignedDate))

          const isApa = !!deal.integrationCompletionDate || deal.stage === 'APA Signed' || deal.stage === 'Closed Won' || !!deal.officialClosedDate
          if (isApa) {
            c.apas++
            milestone = 'APA'
            if (deal.integrationCompletionDate && deal.loiSignedDate) {
              c.daysLoiToApa.push(daysBetween(deal.loiSignedDate, deal.integrationCompletionDate))
            }
            if (deal.officialClosedDate) {
              c.closed++
              milestone = 'Closed'
              if (deal.integrationCompletionDate) {
                c.daysApaToClose.push(daysBetween(deal.integrationCompletionDate, deal.officialClosedDate))
              }
            }
          }
        }
      }

      c.deals.push({
        dealId: deal.dealId,
        dealName: deal.dealName,
        stage: deal.stage,
        dealCreatedAt: fmtDate(deal.dealCreatedAt),
        engagedDate: fmtDate(deal.engagedDate),
        ndaSignedDate: fmtDate(deal.ndaSignedDate),
        loiSignedDate: fmtDate(deal.loiSignedDate),
        integrationCompletionDate: fmtDate(deal.integrationCompletionDate),
        officialClosedDate: fmtDate(deal.officialClosedDate),
        milestone,
      })
    }

    // Fixed quarter range Q1 2024 → Q4 2026
    const allQuarters: string[] = []
    for (const year of [2024, 2025, 2026]) {
      for (const q of [1, 2, 3, 4]) allQuarters.push(`Q${q} ${year}`)
    }

    const emptyC: Cohort = { engaged: 0, ndas: 0, lois: 0, apas: 0, closed: 0, daysToNda: [], daysNdaToLoi: [], daysLoiToApa: [], daysApaToClose: [], deals: [] }

    const vintages = allQuarters.map((quarter) => {
      const c = cohorts.get(quarter) ?? emptyC
      return {
        quarter,
        engaged: c.engaged,
        ndas: c.ndas,
        ndaConv: c.engaged > 0 ? Math.round((c.ndas / c.engaged) * 100) : 0,
        avgDaysToNda: avg(c.daysToNda),
        lois: c.lois,
        loiConv: c.ndas > 0 ? Math.round((c.lois / c.ndas) * 100) : 0,
        avgDaysNdaToLoi: avg(c.daysNdaToLoi),
        apas: c.apas,
        avgDaysLoiToApa: avg(c.daysLoiToApa),
        apaConv: c.lois > 0 ? Math.round((c.apas / c.lois) * 100) : 0,
        closed: c.closed,
        closedConv: c.apas > 0 ? Math.round((c.closed / c.apas) * 100) : 0,
        avgDaysApaToClose: avg(c.daysApaToClose),
        deals: c.deals.sort((a, b) => (b.milestone > a.milestone ? 1 : -1)),
      }
    })

    return NextResponse.json({ vintages })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
