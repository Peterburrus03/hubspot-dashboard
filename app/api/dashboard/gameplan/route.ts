import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { subDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerIds = searchParams.get('ownerIds')?.split(',').filter(Boolean) ?? []


    const tier1Contacts = await prisma.contact.findMany({
      where: {
        tier1: true,
        ...(ownerIds.length > 0 ? { ownerId: { in: ownerIds } } : {})
      }
    })


    const owners = await prisma.owner.findMany()
    const ownerMap = new Map(owners.map(o => [o.ownerId, `${o.firstName} ${o.lastName}`]))

    const contactIds = tier1Contacts.map(c => c.contactId)
    const latestEngagements = await prisma.engagement.findMany({
      where: { contactId: { in: contactIds } },
      orderBy: { timestamp: 'desc' },
      distinct: ['contactId']
    })

    const engagementMap = new Map(latestEngagements.map(e => [e.contactId, e]))

    const fourWeeksAgo = subDays(new Date(), 28)
    const staleTier1s = tier1Contacts.map(c => {
      const lastEng = engagementMap.get(c.contactId)
      const lastDate = lastEng?.timestamp
      const isStale = !lastDate || lastDate < fourWeeksAgo
      
      return {
        contactId: c.contactId,
        name: `${c.firstName} ${c.lastName}`,
        ownerName: ownerMap.get(c.ownerId ?? '') ?? 'Unassigned',
        lastActivity: lastDate,
        status: c.leadStatus,
        isStale
      }
    }).filter(c => c.isStale).sort((a, b) => {
      if (!a.lastActivity) return -1
      if (!b.lastActivity) return 1
      return a.lastActivity.getTime() - b.lastActivity.getTime()
    })

    const twoWeeksAgo = subDays(new Date(), 14)
    const triggerWords = ['gift', 'lunch', 'card', 'ipad', 'visit', 'dinner', 'coffee']
    
    const triggers = await prisma.engagement.findMany({
      where: {
        timestamp: { gte: twoWeeksAgo },
        body: { not: null }
      },
      orderBy: { timestamp: 'desc' }
    })

    const actionableTriggers = []
    const contactIdsForTriggers = Array.from(new Set(triggers.map(t => t.contactId).filter(Boolean) as string[]))
    const triggerContacts = await prisma.contact.findMany({
      where: { contactId: { in: contactIdsForTriggers } }
    })
    const triggerContactMap = new Map(triggerContacts.map(c => [c.contactId, c]))

    for (const t of triggers) {
      const body = t.body?.toLowerCase() || ''
      const matchedWord = triggerWords.find(word => body.includes(word))
      
      if (matchedWord) {
        const contact = triggerContactMap.get(t.contactId!)
        if (contact && (!ownerIds.length || ownerIds.includes(contact.ownerId ?? ''))) {
          actionableTriggers.push({
            contactId: contact.contactId,
            contactName: `${contact.firstName} ${contact.lastName}`,
            ownerName: ownerMap.get(contact.ownerId ?? '') ?? 'Unassigned',
            activityType: t.type,
            body: t.body,
            timestamp: t.timestamp,
            trigger: matchedWord
          })
        }
      }
    }

    const sevenDaysAgo = subDays(new Date(), 7)
    const recentEnrollments = await prisma.sequenceEnrollment.findMany({
      where: {
        enrolledAt: { gte: sevenDaysAgo },
        ...(ownerIds.length > 0 ? { ownerId: { in: ownerIds } } : {})
      },
      orderBy: { enrolledAt: 'desc' },
      take: 10
    })

    const enrollmentContactIds = recentEnrollments.map(se => se.contactId).filter(Boolean) as string[]
    const enrollmentContacts = await prisma.contact.findMany({
      where: { contactId: { in: enrollmentContactIds } }
    })
    const enrollmentContactMap = new Map(enrollmentContacts.map(c => [c.contactId, c]))
    const enrollmentDetails = recentEnrollments.map((se) => {
      const contact = enrollmentContactMap.get(se.contactId ?? '')
      return {
        contactId: se.contactId,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown',
        sequenceName: se.sequenceName,
        enrolledAt: se.enrolledAt,
        ownerName: ownerMap.get(se.ownerId ?? '') ?? 'Unassigned'
      }
    })

    return NextResponse.json({
      staleTier1s,
      actionableTriggers: actionableTriggers.slice(0, 20),
      recentEnrollments: enrollmentDetails
    })
  } catch (error: any) {
    console.error('Game Plan API error:', error)
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}
