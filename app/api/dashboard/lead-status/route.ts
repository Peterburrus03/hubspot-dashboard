import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

const CANADIAN_PROVINCES = ['AB', 'ON', 'NB', 'MB', 'BC', 'QC', 'SK', 'PE', 'NL', 'NS',
                             'ab', 'on', 'nb', 'mb', 'bc', 'qc', 'sk', 'pe', 'nl', 'ns']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const ownerIds = searchParams.get('ownerIds')?.split(',').filter(Boolean) ?? []
    const specialties = searchParams.get('specialties')?.split(',').filter(Boolean) ?? []
    const companyTypes = searchParams.get('companyTypes')?.split(',').filter(Boolean) ?? []
    const includeRemoved = searchParams.get('includeRemoved') !== 'false'
    const tier1Only = searchParams.get('tier1Only') === 'true'
    const locationFilter = searchParams.get('locationFilter') ?? 'all'

    const contactWhere: any = {}

    if (ownerIds.length > 0) contactWhere.ownerId = { in: ownerIds }
    if (specialties.length > 0) contactWhere.specialty = { in: specialties }
    if (!includeRemoved) {
      contactWhere.OR = [
        { leadStatus: null },
        { leadStatus: { not: 'Requested Removal From List' } },
      ]
    }
    if (tier1Only) contactWhere.tier1 = true

    if (companyTypes.length > 0) {
      contactWhere.practiceType = { in: companyTypes }
    }
    if (locationFilter === 'us') {
      contactWhere.state = { notIn: CANADIAN_PROVINCES }
    } else if (locationFilter === 'international') {
      contactWhere.state = { in: CANADIAN_PROVINCES }
    }

    const contacts = await prisma.contact.findMany({
      where: contactWhere,
      select: { leadStatus: true, ownerId: true },
    })

    const owners = await prisma.owner.findMany()
    const ownerMap = new Map(
      owners.map((o) => [
        o.ownerId,
        [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || o.ownerId,
      ])
    )

    // Group by lead status
    const statusMap = new Map<
      string,
      { total: number; byOwner: Map<string, number> }
    >()

    for (const contact of contacts) {
      const status = contact.leadStatus ?? 'No Status'
      if (!statusMap.has(status)) {
        statusMap.set(status, { total: 0, byOwner: new Map() })
      }
      const s = statusMap.get(status)!
      s.total++
      const oid = contact.ownerId ?? 'unassigned'
      s.byOwner.set(oid, (s.byOwner.get(oid) ?? 0) + 1)
    }

    const byStatus = [...statusMap.entries()]
      .map(([status, data]) => ({
        status,
        total: data.total,
        byOwner: [...data.byOwner.entries()]
          .map(([oid, count]) => ({
            ownerId: oid,
            ownerName: ownerMap.get(oid) ?? oid,
            count,
          }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total)

    return NextResponse.json({ byStatus, totalContacts: contacts.length })
  } catch (error: any) {
    console.error('Lead status API error:', error)
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
