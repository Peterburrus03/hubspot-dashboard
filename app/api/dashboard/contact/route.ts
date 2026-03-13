import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

const TASK_CATEGORIES: Record<string, string> = {
  '01': 'Text',
  '02': 'Postal / Snail Mail Letter',
  '03': 'Greeting Card / Gift Card',
  '04': 'FedEx Letter',
  '05': 'LinkedIn Outreach',
  '06': 'Peer to Peer',
  '07': 'Other',
}

function getTaskCategory(body: string | null | undefined): string {
  if (!body) return 'Uncategorized'
  const prefix = body.substring(0, 2)
  return TASK_CATEGORIES[prefix] ?? 'Uncategorized'
}

export async function GET(request: NextRequest) {
  const contactId = request.nextUrl.searchParams.get('contactId')
  if (!contactId) return NextResponse.json({ error: 'Missing contactId' }, { status: 400 })

  const daysParam = request.nextUrl.searchParams.get('days')
  const sinceDate = daysParam ? new Date(Date.now() - parseInt(daysParam) * 86400000) : undefined

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
      where: {
        contactId,
        ...(sinceDate ? { timestamp: { gte: sinceDate } } : {}),
        NOT: { type: 'TASK', taskStatus: { not: 'COMPLETED' } },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
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

  // Annotate tasks with their category label, filter out notes
  const taskCategoryMap: Record<string, number> = {}
  const timeline = allEvents
    .filter(e => e.type !== 'NOTE')
    .map(e => {
      if (e.type === 'TASK') {
        const cat = getTaskCategory((e as any).body)
        taskCategoryMap[cat] = (taskCategoryMap[cat] ?? 0) + 1
        return { ...e, taskCategory: cat }
      }
      return e
    })

  const taskCategories = Object.entries(taskCategoryMap)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({ engagements: timeline, taskCategories, ipad: contact })
}
