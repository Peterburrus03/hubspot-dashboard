import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  const contactId = request.nextUrl.searchParams.get('contactId')
  if (!contactId) return NextResponse.json({ error: 'Missing contactId' }, { status: 400 })

  const [contact, engagements, owners] = await Promise.all([
    prisma.contact.findUnique({
      where: { contactId },
      select: {
        ipadCoverShipDate: true,
        ipadShipmentDate: true,
        ipadGroup: true,
        ipadResponse: true,
        ipadResponseType: true,
      }
    }),
    prisma.engagement.findMany({
      where: { contactId },
      orderBy: { timestamp: 'desc' },
      take: 50,
      select: {
        engagementId: true,
        type: true,
        timestamp: true,
        emailDirection: true,
        emailSubject: true,
        callDirection: true,
        callDuration: true,
        callDisposition: true,
        body: true,
        ownerId: true,
      }
    }),
    prisma.owner.findMany(),
  ])

  const ownerMap = new Map(owners.map(o => [o.ownerId, `${o.firstName} ${o.lastName}`]))

  // Synthesize iPad events into the timeline
  const ipadEvents: any[] = []
  if (contact?.ipadCoverShipDate) {
    ipadEvents.push({
      engagementId: 'ipad-cover-shipped',
      type: 'IPAD_COVER_SHIPPED',
      timestamp: contact.ipadCoverShipDate,
      ownerName: '',
    })
  }
  if (contact?.ipadShipmentDate) {
    ipadEvents.push({
      engagementId: 'ipad-shipped',
      type: 'IPAD_SHIPPED',
      timestamp: contact.ipadShipmentDate,
      ipadGroup: contact.ipadGroup,
      ownerName: '',
    })
  }
  if (contact?.ipadResponse && contact?.ipadShipmentDate) {
    ipadEvents.push({
      engagementId: 'ipad-response',
      type: 'IPAD_RESPONSE',
      timestamp: contact.ipadShipmentDate, // best proxy — response date not stored separately
      ipadResponseType: contact.ipadResponseType,
      ownerName: '',
    })
  }

  const allEvents = [
    ...engagements.map(e => ({ ...e, ownerName: ownerMap.get(e.ownerId ?? '') ?? 'Unknown' })),
    ...ipadEvents,
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({ engagements: allEvents, ipad: contact })
}
