import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// POST — take a snapshot of current open pipeline deals
export async function POST(request: NextRequest) {
  // Verify cron secret in production
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

    return NextResponse.json({ ok: true, snapshotAt, count: deals.length })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}

// GET — return the most recent snapshot grouped by deal
export async function GET() {
  try {
    // Find the latest snapshot timestamp
    const latest = await prisma.dealSnapshot.findFirst({
      orderBy: { snapshotAt: 'desc' },
      select: { snapshotAt: true },
    })

    if (!latest) return NextResponse.json({ snapshotAt: null, deals: [] })

    // Get all deals from that snapshot
    const deals = await prisma.dealSnapshot.findMany({
      where: { snapshotAt: latest.snapshotAt },
      orderBy: { dealId: 'asc' },
    })

    return NextResponse.json({ snapshotAt: latest.snapshotAt, deals })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
