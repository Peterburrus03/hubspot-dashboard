import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWeekStart, findActiveCycle, initWeekAssignments } from '@/lib/outreach/pool'

// Vercel crons always send GET requests — this endpoint is called by the weekly cron
// and proxies the snapshot creation logic (identical to POST /api/snapshots)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const deals = await prisma.deal.findMany({
      where: { pipelineId: '705209413', isOpen: true },
      select: { dealId: true, dealName: true, stage: true, ebitda: true, probability: true, isOpen: true },
    })

    const snapshotAt = new Date()
    await prisma.dealSnapshot.createMany({
      data: deals.map((d) => ({
        snapshotAt,
        dealId: d.dealId,
        dealName: d.dealName,
        stage: d.stage,
        ebitda: d.ebitda,
        probability: d.probability,
        isOpen: d.isOpen,
      })),
    })

    // Only start a new 3-week outreach cycle when no cycle is currently active.
    // This cron runs every Monday — unconditionally initializing would restart
    // the cycle weekly and it would never reach weeks 2/3.
    const activeCycle = await findActiveCycle()
    const weekResult = activeCycle
      ? { count: 0, alreadyInitialized: true, activeCycleWeek: activeCycle.cycleWeek }
      : await initWeekAssignments(getWeekStart())

    return NextResponse.json({
      ok: true,
      snapshotAt,
      count: deals.length,
      weekAssignments: weekResult,
    })
  } catch (error: any) {
    console.error('Cron snapshot error:', error)
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
