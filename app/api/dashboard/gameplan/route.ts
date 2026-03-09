import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { subDays } from 'date-fns'

const CANADIAN_PROVINCES = ['AB', 'ON', 'NB', 'MB', 'BC', 'QC', 'SK', 'PE', 'NL', 'NS',
                             'ab', 'on', 'nb', 'mb', 'bc', 'qc', 'sk', 'pe', 'nl', 'ns']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerIds = searchParams.get('ownerIds')?.split(',').filter(Boolean) ?? []
    const tier1Only = searchParams.get('tier1Only') === 'true'
    const specialties = searchParams.get('specialties')?.split(',').filter(Boolean) ?? []
    const companyTypes = searchParams.get('companyTypes')?.split(',').filter(Boolean) ?? []
    const leadStatuses = searchParams.get('leadStatuses')?.split(',').filter(Boolean) ?? []
    const dealStatuses = searchParams.get('dealStatuses')?.split(',').filter(Boolean) ?? []
    const locationFilter = searchParams.get('locationFilter') ?? 'all'

    const includeRemoved = searchParams.get('includeRemoved') !== 'false'

    // Company type filter — now on the Contact object directly
    const companyTypeFilter = companyTypes.length > 0 ? { practiceType: { in: companyTypes } } : {}

    // Location filter
    const locationWhere = locationFilter === 'us'
      ? { state: { notIn: CANADIAN_PROVINCES } }
      : locationFilter === 'international'
      ? { state: { in: CANADIAN_PROVINCES } }
      : {}

    // Resolve contact IDs to EXCLUDE for deal status filter
    let dealContactIdExclude: string[] | null = null
    if (dealStatuses.length > 0) {
      const matchingContacts = await prisma.contact.findMany({
        where: { dealStatus: { in: dealStatuses } },
        select: { contactId: true },
      })
      dealContactIdExclude = matchingContacts.map(c => c.contactId).filter(Boolean) as string[]
    }

    const baseWhere: any = {
      ...(ownerIds.length > 0 ? { ownerId: { in: ownerIds } } : {}),
      ...(tier1Only ? { tier1: true } : {}),
      ...(specialties.length > 0 ? { specialty: { in: specialties } } : {}),
      ...(leadStatuses.length > 0 ? { leadStatus: { in: leadStatuses } } : {}),
      professionalStatus: 'Owner',
      ...companyTypeFilter,
      ...locationWhere,
      ...(dealContactIdExclude ? { NOT: { contactId: { in: dealContactIdExclude } } } : {}),
      ...(!includeRemoved ? { OR: [{ leadStatus: null }, { leadStatus: { not: 'Requested Removal From List' } }] } : {}),
    }

    const tier1Contacts = await prisma.contact.findMany({
      where: { ...baseWhere, tier1: true }
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
      where: { ...baseWhere, contactId: { in: contactIdsForTriggers } }
    })
    const triggerContactMap = new Map(triggerContacts.map(c => [c.contactId, c]))

    for (const t of triggers) {
      const body = t.body?.toLowerCase() || ''
      const matchedWord = triggerWords.find(word => body.includes(word))

      if (matchedWord) {
        const contact = triggerContactMap.get(t.contactId!)
        if (contact) {
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

    // Addressable universe — all contacts bucketed by interest disposition
    const allContacts = await prisma.contact.findMany({
      where: baseWhere,
      select: {
        contactId: true,
        firstName: true,
        lastName: true,
        specialty: true,
        ownerId: true,
        leadStatus: true,
        interestedResponseDate: true,
        notInterestedNowResponseDate: true,
        notInterestedAtAllResponseDate: true,
      },
    })

    const universe = {
      interested:         allContacts.filter(c => c.interestedResponseDate != null),
      notInterestedNow:   allContacts.filter(c => !c.interestedResponseDate && c.notInterestedNowResponseDate != null),
      notInterestedAtAll: allContacts.filter(c => !c.interestedResponseDate && !c.notInterestedNowResponseDate && c.notInterestedAtAllResponseDate != null),
      // Fair game = no disposition set AND has an assigned owner
      fairGame:           allContacts.filter(c => !c.interestedResponseDate && !c.notInterestedNowResponseDate && !c.notInterestedAtAllResponseDate && c.ownerId != null),
    }

    // Enrich fair game contacts with deal stage
    const fairGameContactIds = universe.fairGame.map(c => c.contactId)
    const fairGameDeals = await prisma.deal.findMany({
      where: { contactId: { in: fairGameContactIds } },
      select: { contactId: true, stage: true },
    })
    const dealStageByContact = new Map(fairGameDeals.map(d => [d.contactId, d.stage]))

    const mapContacts = (list: typeof allContacts) => list.map(c => ({
      contactId: c.contactId,
      name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
      specialty: c.specialty,
      ownerName: ownerMap.get(c.ownerId ?? '') ?? 'Unassigned',
    }))

    const fairGameContacts = universe.fairGame.map(c => ({
      contactId: c.contactId,
      name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
      specialty: c.specialty,
      ownerName: ownerMap.get(c.ownerId ?? '') ?? 'Unassigned',
      leadStatus: c.leadStatus ?? null,
      dealStage: dealStageByContact.get(c.contactId) ?? null,
    }))

    return NextResponse.json({
      staleTier1s,
      actionableTriggers: actionableTriggers.slice(0, 20),
      universe: {
        total: allContacts.length,
        interested:         { count: universe.interested.length,         contacts: mapContacts(universe.interested) },
        fairGame:           { count: universe.fairGame.length,           contacts: fairGameContacts },
        notInterestedNow:   { count: universe.notInterestedNow.length,   contacts: mapContacts(universe.notInterestedNow) },
        notInterestedAtAll: { count: universe.notInterestedAtAll.length,  contacts: mapContacts(universe.notInterestedAtAll) },
      }
    })
  } catch (error: any) {
    console.error('Game Plan API error:', error)
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}
