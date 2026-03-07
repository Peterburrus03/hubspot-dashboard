import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const ownerIds = searchParams.get('ownerIds')?.split(',').filter(Boolean) ?? []
    const specialties = searchParams.get('specialties')?.split(',').filter(Boolean) ?? []
    const companyTypes = searchParams.get('companyTypes')?.split(',').filter(Boolean) ?? []
    const isOpenOnly = searchParams.get('isOpenOnly') === 'true' // Changed from !== 'false'

    const dealWhere: any = {
      pipelineId: '705209413' // AOSN Acquisition Pipeline
    }

    if (ownerIds.length > 0) dealWhere.ownerId = { in: ownerIds }
    if (specialties.length > 0) dealWhere.specialty = { in: specialties }
    
    if (isOpenOnly) dealWhere.isOpen = true

    if (companyTypes.length > 0) {
      const matchingCompanies = await prisma.company.findMany({
        where: { companyType: { in: companyTypes } },
        select: { companyId: true },
      })
      dealWhere.companyId = { in: matchingCompanies.map((c) => c.companyId) }
    }

    const deals = await prisma.deal.findMany({
      where: dealWhere,
    })

    const owners = await prisma.owner.findMany()
    const ownerMap = new Map(
      owners.map((o) => [
        o.ownerId,
        [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || o.ownerId,
      ])
    )

    // Group by stage
    const stageMap = new Map<
      string,
      { total: number; revenue: number; weighted: number; count: number }
    >()

    // Group by owner
    const ownerActivityMap = new Map<
      string,
      { total: number; revenue: number; weighted: number; count: number }
    >()

    for (const deal of deals) {
      const stage = deal.stage ?? 'Unknown Stage'
      if (!stageMap.has(stage)) {
        stageMap.set(stage, { total: 0, revenue: 0, weighted: 0, count: 0 })
      }
      const s = stageMap.get(stage)!
      s.count++
      s.revenue += deal.revenue ?? 0
      s.weighted += deal.weightedAmount ?? 0

      const oid = deal.ownerId ?? 'unassigned'
      if (!ownerActivityMap.has(oid)) {
        ownerActivityMap.set(oid, { total: 0, revenue: 0, weighted: 0, count: 0 })
      }
      const o = ownerActivityMap.get(oid)!
      o.count++
      o.revenue += deal.revenue ?? 0
      o.weighted += deal.weightedAmount ?? 0
    }

    const byStage = [...stageMap.entries()]
      .map(([stage, data]) => ({
        stage,
        ...data,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    const byOwner = [...ownerActivityMap.entries()]
      .map(([ownerId, data]) => ({
        ownerId,
        ownerName: ownerMap.get(ownerId) ?? ownerId,
        ...data,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    const summary = {
      totalDeals: deals.length,
      totalRevenue: deals.reduce((sum, d) => sum + (d.revenue ?? 0), 0),
      totalWeighted: deals.reduce((sum, d) => sum + (d.weightedAmount ?? 0), 0),
    }

    const dealsWithOwners = deals.map(d => ({
      ...d,
      ownerName: ownerMap.get(d.ownerId ?? '') ?? 'Unassigned',
    }))

    return NextResponse.json({ summary, byStage, byOwner, deals: dealsWithOwners })
  } catch (error: any) {
    console.error('Pipeline API error:', error)
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
