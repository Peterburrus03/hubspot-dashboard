import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@/generated/prisma'
import { CAMPAIGNS } from '@/lib/campaigns'

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const ownerIds = sp.get('ownerIds')?.split(',').filter(Boolean) ?? []
    const specialties = sp.get('specialties')?.split(',').filter(Boolean) ?? []
    const companyTypes = sp.get('companyTypes')?.split(',').filter(Boolean) ?? []
    const includeRemoved = sp.get('includeRemoved') !== 'false'
    const tier1Only = sp.get('tier1Only') === 'true'
    const locationFilter = sp.get('locationFilter') ?? 'all'

    const ownerFilter = ownerIds.length
      ? Prisma.sql`AND e."ownerId" = ANY(${ownerIds}::text[])`
      : Prisma.empty
    const specialtyFilter = specialties.length
      ? Prisma.sql`AND c.specialty = ANY(${specialties}::text[])`
      : Prisma.empty
    const removedFilter = includeRemoved
      ? Prisma.empty
      : Prisma.sql`AND (c."leadStatus" IS NULL OR c."leadStatus" != 'Requested Removal From List')`
    const tier1Filter = tier1Only
      ? Prisma.sql`AND c."tier1" = true`
      : Prisma.empty
    const ownerStatusFilter = Prisma.sql`AND c."professionalStatus" = 'Owner'`
    const companyFilter = companyTypes.length
      ? Prisma.sql`AND c."practiceType" = ANY(${companyTypes}::text[])`
      : Prisma.empty
    const locationSqlFilter = locationFilter === 'us'
      ? Prisma.sql`AND UPPER(c."state") != ALL(${['AB','ON','NB','MB','BC','QC','SK','PE','NL','NS']}::text[])`
      : locationFilter === 'international'
      ? Prisma.sql`AND UPPER(c."state") = ANY(${['AB','ON','NB','MB','BC','QC','SK','PE','NL','NS']}::text[])`
      : Prisma.empty

    const owners = await prisma.owner.findMany()
    const ownerMap = new Map(
      owners.map((o) => [
        o.ownerId,
        [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || o.ownerId,
      ])
    )

    const results = await Promise.all(
      CAMPAIGNS.map(async (camp) => {
        const start = new Date(camp.startDate + 'T00:00:00.000Z')
        const end = new Date(camp.endDate + 'T23:59:59.999Z')
        const tagPattern = camp.tag + '%'

        const rows = await prisma.$queryRaw<{ owner_id: string | null; cnt: bigint }[]>(Prisma.sql`
          SELECT e."ownerId" AS owner_id, COUNT(*) AS cnt
          FROM engagements e
          LEFT JOIN contacts c ON c."contactId" = e."contactId"
          WHERE e.type = 'TASK'
            AND e."taskStatus" = 'COMPLETED'
            AND e.body LIKE ${tagPattern}
            AND e.timestamp >= ${start}
            AND e.timestamp <= ${end}
            ${ownerFilter}
            ${specialtyFilter}
            ${removedFilter}
            ${companyFilter}
            ${tier1Filter}
            ${ownerStatusFilter}
            ${locationSqlFilter}
          GROUP BY e."ownerId"
        `)

        const byOwner = rows
          .map((r) => ({
            ownerId: r.owner_id ?? 'unknown',
            ownerName: ownerMap.get(r.owner_id ?? '') ?? 'Unknown',
            count: Number(r.cnt),
          }))
          .sort((a, b) => b.count - a.count)

        const total = byOwner.reduce((s, r) => s + r.count, 0)

        return {
          id: camp.id,
          label: camp.label,
          tag: camp.tag,
          startDate: camp.startDate,
          endDate: camp.endDate,
          total,
          byOwner,
        }
      })
    )

    return NextResponse.json({ campaigns: results })
  } catch (error: any) {
    console.error('Campaigns API error:', error)
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
