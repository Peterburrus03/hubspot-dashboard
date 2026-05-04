import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const month = sp.get('month') // YYYY-MM

    let startDate: Date
    let endDate: Date

    if (month) {
      const [year, m] = month.split('-').map(Number)
      startDate = new Date(Date.UTC(year, m - 1, 1))
      endDate = new Date(Date.UTC(year, m, 1))
    } else {
      const now = new Date()
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    }

    const meetings = await prisma.engagement.findMany({
      where: {
        type: 'MEETING',
        timestamp: { gte: startDate, lt: endDate },
        body: { contains: 'new', mode: 'insensitive' },
      },
      select: {
        engagementId: true,
        timestamp: true,
        ownerId: true,
        contactId: true,
        body: true,
      },
      orderBy: { timestamp: 'asc' },
    })

    const contactIds = [...new Set(meetings.map(m => m.contactId).filter(Boolean) as string[])]

    const [contacts, owners] = await Promise.all([
      contactIds.length
        ? prisma.contact.findMany({
            where: { contactId: { in: contactIds } },
            select: { contactId: true, firstName: true, lastName: true, specialty: true, state: true },
          })
        : [],
      prisma.owner.findMany(),
    ])

    const contactMap = new Map(contacts.map(c => [c.contactId, c]))
    const ownerMap = new Map(owners.map(o => [o.ownerId, `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim()]))

    const result = meetings.map(m => {
      const contact = m.contactId ? contactMap.get(m.contactId) : null
      return {
        engagementId: m.engagementId,
        date: m.timestamp.toISOString().split('T')[0],
        timestamp: m.timestamp.toISOString(),
        title: m.body ?? null,
        ownerId: m.ownerId ?? null,
        ownerName: m.ownerId ? (ownerMap.get(m.ownerId) ?? null) : null,
        contactId: m.contactId ?? null,
        contactName: contact
          ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || null
          : null,
        specialty: contact?.specialty ?? null,
        state: contact?.state ?? null,
      }
    })

    return NextResponse.json({
      meetings: result,
      month: month ?? startDate.toISOString().slice(0, 7),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
