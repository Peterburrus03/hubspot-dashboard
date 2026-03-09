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

// GET — return snapshot(s)
// ?list=true  → returns all available snapshot timestamps
// ?at=<iso>   → returns snapshot at that specific timestamp
// (default)   → returns the most recent snapshot
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Return list of all available snapshot timestamps
    if (searchParams.get('list') === 'true') {
      const rows = await prisma.dealSnapshot.findMany({
        distinct: ['snapshotAt'],
        orderBy: { snapshotAt: 'desc' },
        select: { snapshotAt: true },
      })
      return NextResponse.json(rows.map((r) => r.snapshotAt))
    }

    // Find the target snapshot timestamp
    const atParam = searchParams.get('at')
    let targetAt: Date | null = null

    if (atParam) {
      targetAt = new Date(atParam)
    } else {
      const latest = await prisma.dealSnapshot.findFirst({
        orderBy: { snapshotAt: 'desc' },
        select: { snapshotAt: true },
      })
      targetAt = latest?.snapshotAt ?? null
    }

    if (!targetAt) return NextResponse.json({ snapshotAt: null, deals: [] })

    const deals = await prisma.dealSnapshot.findMany({
      where: { snapshotAt: targetAt },
      orderBy: { dealId: 'asc' },
    })

    return NextResponse.json({ snapshotAt: targetAt, deals })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
