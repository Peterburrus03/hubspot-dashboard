import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

const Q1_START = new Date('2025-12-29')

const WEEKLY_BUDGET = [
  { total: 73, items: { "iPad Case Send": 70, "Tier 1 Campaigns": 6, "Intro Letters": 10, "Peer to Peer": 5, "LinkedIn": 2 } },
  { total: 65, items: { "iPad Case Send": 5, "Tier 1 Campaigns": 10, "Intro Letters": 10, "Tier 2 Emails": 5, "Peer to Peer": 5, "LinkedIn": 2 } },
  { total: 19, items: { "Tier 1 Campaigns": 10, "Intro Letters": 10, "Tier 2 Emails": 5, "Peer to Peer": 3, "LinkedIn": 2 } },
  { total: 20, items: { "iPad Case Send": 7, "Tier 1 Campaigns": 11, "Intro Letters": 10, "Tier 2 Emails": 6, "Peer to Peer": 2, "LinkedIn": 2 } },
  { total: 35, items: { "Tier 1 Campaigns": 12, "Intro Letters": 10, "Tier 2 Emails": 10, "Peer to Peer": 2, "LinkedIn": 2 } },
  { total: 39, items: { "iPad Case Send": 12, "Tier 1 Campaigns": 12, "Intro Letters": 10, "Tier 2 Emails": 10, "Peer to Peer": 2, "LinkedIn": 2 } },
  { total: 37, items: { "iPad Case Send": 7, "Tier 1 Campaigns": 12, "Intro Letters": 7, "Tier 2 Emails": 10, "Peer to Peer": 2, "LinkedIn": 2 } },
  { total: 34, items: { "Intro Letters": 6, "Tier 2 Emails": 7, "Gone Dark Emails": 12, "LinkedIn": 2, "Practice Gifts": 1 } },
  { total: 23, items: { "Intro Letters": 6, "Tier 2 Emails": 5, "Gone Dark Emails": 12, "LinkedIn": 2, "Practice Gifts": 1 } },
  { total: 22, items: { "Intro Letters": 6, "Tier 2 Emails": 3, "LinkedIn": 2, "Practice Gifts": 2 } },
  { total: 22, items: { "Intro Letters": 9, "LinkedIn": 2, "Practice Gifts": 2 } },
  { total: 0, items: { "LinkedIn": 2 } }
]

export async function GET() {
  try {
    const engagements = await prisma.engagement.findMany({
      where: { timestamp: { gte: Q1_START } }
    })

    const tier1Contacts = await prisma.contact.findMany({
      where: { tier1: true, professionalStatus: 'Owner' },
      select: { contactId: true }
    })
    const t1Ids = new Set(tier1Contacts.map(c => c.contactId))

    const weeklyActuals = Array(12).fill(0).map((_, i) => ({
      week: `Week ${i + 1}`,
      target: WEEKLY_BUDGET[i]?.total || 0,
      budgetDetails: WEEKLY_BUDGET[i]?.items || {},
      tier1: 0,
      tier2: 0,
      total: 0,
      ipad: i === 0 ? 111 : 0 
    }))

    engagements.forEach(e => {
      const diffTime = Math.abs(e.timestamp.getTime() - Q1_START.getTime())
      const weekIndex = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7))
      
      if (weekIndex >= 0 && weekIndex < 12) {
        if (t1Ids.has(e.contactId ?? '')) {
          weeklyActuals[weekIndex].tier1++
        } else {
          weeklyActuals[weekIndex].tier2++
        }
        weeklyActuals[weekIndex].total++
      }
    })

    let cumulativeActual = 0
    let cumulativeTarget = 0
    
    const report = weeklyActuals.map((w, i) => {
      cumulativeActual += (w.total + w.ipad)
      cumulativeTarget += w.target
      const delta = (w.total + w.ipad) - w.target
      
      return {
        ...w,
        actual: w.total + w.ipad,
        cumulativeActual,
        cumulativeTarget,
        delta,
        cumulativeDelta: cumulativeActual - cumulativeTarget
      }
    })

    return NextResponse.json({
      q1TotalTarget: 389,
      q1TotalActual: cumulativeActual,
      weeklyData: report
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
