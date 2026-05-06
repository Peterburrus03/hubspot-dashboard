import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

const WIN_STAGES = [
  'Engaged',
  'Mutual Interest',
  'Discussion',
  'Data Collection (including NDA)',
  'Pre-LOI Analysis',
  'LOI Extended',
  'LOI Signed/Diligence',
  'Closed Won',
]

const STAGE_RANK: Record<string, number> = {
  'Closed Won': 8,
  'LOI Signed/Diligence': 7,
  'LOI Extended': 6,
  'Pre-LOI Analysis': 5,
  'Data Collection (including NDA)': 4,
  'Discussion': 3,
  'Mutual Interest': 2,
  'Engaged': 1,
}

const CANADIAN_PROVINCES = [
  'AB', 'ON', 'NB', 'MB', 'BC', 'QC', 'SK', 'PE', 'NL', 'NS',
  'ab', 'on', 'nb', 'mb', 'bc', 'qc', 'sk', 'pe', 'nl', 'ns',
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const ownerIds = searchParams.get('ownerIds')?.split(',').filter(Boolean)
    const companyTypes = searchParams.get('companyTypes')?.split(',').filter(Boolean)
    const locationFilter = searchParams.get('locationFilter') ?? 'all'

    const ownerFilter = ownerIds?.length ? { ownerId: { in: ownerIds } } : {}
    const companyFilter = companyTypes?.length ? { practiceType: { in: companyTypes } } : {}
    const locationWhere =
      locationFilter === 'us' ? { state: { notIn: CANADIAN_PROVINCES } }
      : locationFilter === 'international' ? { state: { in: CANADIAN_PROVINCES } }
      : {}

    // Contacts in active pipeline / closed won
    const pipelineDeals = await prisma.deal.findMany({
      where: { stage: { in: WIN_STAGES } },
      select: { contactId: true, stage: true },
    })

    const dealMap = new Map<string, string>()
    for (const d of pipelineDeals) {
      if (!d.contactId || !d.stage) continue
      const existing = dealMap.get(d.contactId)
      if (!existing || (STAGE_RANK[d.stage] ?? 0) > (STAGE_RANK[existing] ?? 0)) {
        dealMap.set(d.contactId, d.stage)
      }
    }
    const pipelineContactIds = Array.from(dealMap.keys())
    if (!pipelineContactIds.length) return NextResponse.json({ wins: [] })

    // Which of those contacts got the 09 mailer?
    const mailerRows = await prisma.engagement.findMany({
      where: {
        type: 'TASK',
        taskStatus: 'COMPLETED',
        body: { startsWith: '09' },
        contactId: { in: pipelineContactIds },
      },
      orderBy: { timestamp: 'asc' },
      distinct: ['contactId'],
      select: { contactId: true, timestamp: true },
    })

    const mailerMap = new Map(mailerRows.map(r => [r.contactId, r.timestamp]))
    const winIds = mailerRows.map(r => r.contactId).filter(Boolean) as string[]
    if (!winIds.length) return NextResponse.json({ wins: [] })

    const [contacts, owners] = await Promise.all([
      prisma.contact.findMany({
        where: {
          contactId: { in: winIds },
          professionalStatus: 'Owner',
          ...ownerFilter,
          ...companyFilter,
          ...locationWhere,
        },
        select: { contactId: true, firstName: true, lastName: true, specialty: true, ownerId: true },
      }),
      prisma.owner.findMany(),
    ])

    const ownerMap = new Map(owners.map(o => [o.ownerId, `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim()]))

    const wins = contacts
      .map(c => ({
        contactId: c.contactId,
        name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
        specialty: c.specialty ?? null,
        ownerName: ownerMap.get(c.ownerId ?? '') ?? 'Unassigned',
        dealStage: dealMap.get(c.contactId) ?? '',
        mailerDate: mailerMap.get(c.contactId)?.toISOString() ?? null,
      }))
      .sort((a, b) => {
        const ra = STAGE_RANK[a.dealStage] ?? 0
        const rb = STAGE_RANK[b.dealStage] ?? 0
        return rb - ra
      })

    return NextResponse.json({ wins })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
