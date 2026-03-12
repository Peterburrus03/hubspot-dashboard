import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

const Q1_START = new Date('2026-01-05')

// Weekly outreach goals keyed by ISO week number
const WEEKLY_GOALS: Record<number, number> = {
  // January–February (ISO weeks 2–9) — original marketing plan budgets
  2: 73, 3: 65, 4: 19, 5: 20,
  6: 35, 7: 39, 8: 37, 9: 34,
  // March (ISO weeks 10–13)
  10: 74, 11: 74, 12: 74, 13: 74,
  // April (ISO weeks 14–18)
  14: 74, 15: 74, 16: 74, 17: 74, 18: 74,
  // May (ISO weeks 19–22)
  19: 74, 20: 74, 21: 74, 22: 74,
  // June (ISO weeks 23–27)
  23: 64, 24: 64, 25: 64, 26: 64, 27: 64,
  // July (ISO weeks 28–31)
  28: 60, 29: 60, 30: 60, 31: 60,
  // August (ISO weeks 32–36)
  32: 60, 33: 60, 34: 60, 35: 60, 36: 60,
  // September deadline week
  37: 0,
}
const DEFAULT_WEEKLY_GOAL = 68

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function weekGoal(weekStart: Date): number {
  const iso = getISOWeek(weekStart)
  return WEEKLY_GOALS[iso] ?? DEFAULT_WEEKLY_GOAL
}

export async function GET() {
  try {
    const now = new Date()

    const engagements = await prisma.engagement.findMany({
      where: {
        timestamp: { gte: Q1_START, lte: now },
        OR: [
          { type: 'CALL' },
          { type: 'MEETING' },
          { type: 'TASK', taskStatus: 'COMPLETED' },
          { type: 'EMAIL', emailDirection: null },
          { type: 'EMAIL', emailDirection: { not: 'AUTOMATED_EMAIL' } },
        ],
      },
      select: { type: true, timestamp: true, contactId: true, emailDirection: true, taskStatus: true },
    })

    const tier1Contacts = await prisma.contact.findMany({
      where: { tier1: true, professionalStatus: 'Owner' },
      select: { contactId: true }
    })
    const t1Ids = new Set(tier1Contacts.map(c => c.contactId))

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const weeklyActuals = Array(12).fill(0).map((_, i) => {
      const weekStart = new Date(Q1_START.getTime() + i * 7 * 24 * 60 * 60 * 1000)
      const monthLabel = MONTHS[weekStart.getUTCMonth()]
      return {
        week: `Wk ${i + 1} ${monthLabel}`,
        target: weekGoal(weekStart),
        tier1: 0,
        tier2: 0,
        total: 0,
        ipad: i === 0 ? 111 : 0
      }
    })

    // Track seen email (contactId, date) pairs per week to deduplicate threads
    const seenEmailKeys = new Set<string>()

    engagements.forEach(e => {
      // Deduplicate emails: count only 1 per contact per calendar day
      if (e.type === 'EMAIL') {
        const day = e.timestamp.toISOString().split('T')[0]
        const key = (e.contactId ?? 'none') + '|' + day
        if (seenEmailKeys.has(key)) return
        seenEmailKeys.add(key)
      }

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

    const q1TotalTarget = weeklyActuals.reduce((sum, w) => sum + w.target, 0)

    const anchor = { week: '', target: 0, tier1: 0, tier2: 0, total: 0, ipad: 0, actual: 0, cumulativeActual: 0, cumulativeTarget: 0, delta: 0, cumulativeDelta: 0 }

    return NextResponse.json({
      q1TotalTarget,
      q1TotalActual: cumulativeActual,
      weeklyData: [anchor, ...report]
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
