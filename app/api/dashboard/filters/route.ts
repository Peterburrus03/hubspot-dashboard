import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import type { DashboardFilters } from '@/types/hubspot'

export async function GET() {
  try {
    // Only include owners who have contacts or deals in our shrunk world
    const [activeContactOwners, activeDealOwners] = await Promise.all([
      prisma.contact.findMany({ select: { ownerId: true }, distinct: ['ownerId'] }),
      prisma.deal.findMany({ 
        where: { pipelineId: '705209413' }, 
        select: { ownerId: true }, 
        distinct: ['ownerId'] 
      }),
    ])

    const activeOwnerIds = Array.from(new Set([
      ...activeContactOwners.map(o => o.ownerId),
      ...activeDealOwners.map(o => o.ownerId)
    ])).filter(Boolean) as string[]

    const [owners, specialties, companyTypes, leadStatuses, dealStatuses, professionalStatuses] = await Promise.all([
      prisma.owner.findMany({
        where: { ownerId: { in: activeOwnerIds } },
        orderBy: { lastName: 'asc' }
      }),
      prisma.contact.findMany({
        where: { specialty: { not: null } },
        select: { specialty: true },
        distinct: ['specialty'],
        orderBy: { specialty: 'asc' },
      }),
      prisma.contact.findMany({
        where: { practiceType: { not: null } },
        select: { practiceType: true },
        distinct: ['practiceType'],
        orderBy: { practiceType: 'asc' },
      }),
      prisma.contact.findMany({
        where: { leadStatus: { not: null } },
        select: { leadStatus: true },
        distinct: ['leadStatus'],
        orderBy: { leadStatus: 'asc' },
      }),
      prisma.contact.findMany({
        where: { dealStatus: { not: null } },
        select: { dealStatus: true },
        distinct: ['dealStatus'],
        orderBy: { dealStatus: 'asc' },
      }),
      prisma.contact.findMany({
        where: { professionalStatus: { not: null } },
        select: { professionalStatus: true },
        distinct: ['professionalStatus'],
        orderBy: { professionalStatus: 'asc' },
      }),
    ])

    const result: any = {
      owners: owners.map((o) => ({
        id: o.ownerId,
        name: [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || o.ownerId,
      })),
      specialties: specialties.map((s) => s.specialty!).filter(Boolean),
      companyTypes: companyTypes.map((c) => c.practiceType!).filter(Boolean),
      leadStatuses: leadStatuses.map((l) => l.leadStatus!).filter(Boolean),
      dealStatuses: dealStatuses.map((d) => d.dealStatus!).filter(Boolean),
      professionalStatuses: professionalStatuses.map((p) => p.professionalStatus!).filter(Boolean),
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Filters API error:', error)
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
