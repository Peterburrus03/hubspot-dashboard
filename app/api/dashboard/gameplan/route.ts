import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { subDays, subMonths } from 'date-fns'

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
    const sixMonthsAgo = subMonths(new Date(), 6)

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

    // Always exclude contacts whose actual deal stage is terminally closed
    const TERMINAL_DEAL_STAGES = ['Closed Won', 'Closed Lost', 'Closed LOST', 'Closed PASS']
    const closedDealRows = await prisma.deal.findMany({
      where: { stage: { in: TERMINAL_DEAL_STAGES } },
      select: { contactId: true },
    })
    const closedDealContactIds = Array.from(new Set(
      closedDealRows.map(d => d.contactId).filter(Boolean) as string[]
    ))

    // Contacts with an active pipeline deal — excluded from every funnel column so
    // they surface only in the universe's "In Pipeline" bucket and are never
    // double-counted (e.g. a pipeline contact still tagged 'Closed and Nurturing'
    // would otherwise also land in the "Other" bucket).
    const ACTIVE_PIPELINE_STAGES = [
      'Engaged',
      'Presented to Growth Committee',
      'Data Collection (including NDA)',
      'LOI Extended',
      'LOI Signed/Diligence',
      'Pre-LOI Analysis',
    ]
    const pipelineDealRows = await prisma.deal.findMany({
      where: { stage: { in: ACTIVE_PIPELINE_STAGES } },
      select: { contactId: true },
    })
    const pipelineContactIds = Array.from(new Set(
      pipelineDealRows.map(d => d.contactId).filter(Boolean) as string[]
    ))

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

    // Base where without lead status restriction — used for fixed status columns.
    // Active-pipeline contacts are excluded here too so they can't be re-counted in
    // any column bucket; they belong solely to the universe's "In Pipeline" bucket.
    const columnExcludeIds = Array.from(new Set([
      ...(dealContactIdExclude ?? []),
      ...closedDealContactIds,
      ...pipelineContactIds,
    ]))
    const baseWhereNoStatus: any = {
      ...(ownerIds.length > 0 ? { ownerId: { in: ownerIds } } : {}),
      ...(specialties.length > 0 ? { specialty: { in: specialties } } : {}),
      professionalStatus: 'Owner',
      ...companyTypeFilter,
      ...locationWhere,
      ...(columnExcludeIds.length > 0 ? { NOT: { contactId: { in: columnExcludeIds } } } : {}),
      ...(!includeRemoved ? { OR: [{ leadStatus: null }, { leadStatus: { not: 'Requested Removal From List' } }] } : {}),
    }

    const HIDDEN_STATUSES = ['UNSUBSCRIBED', 'UNQUALIFIED', 'Disqualified']
    const OPEN_LEAD_STATUSES = ['OPEN', 'NEW', 'CONNECTED']
    const CLOSED_NURTURE_STATUSES = ['Closed and Nurturing']

    const owners = await prisma.owner.findMany()
    const ownerMap = new Map(owners.map(o => [o.ownerId, `${o.firstName} ${o.lastName}`]))

    // Fetch each column's contacts independently so status columns always show all contacts.
    // All three columns use baseWhereNoStatus, which now excludes active-pipeline contacts.
    const [tier1Contacts, openLeadContacts, closedNurtureContacts] = await Promise.all([
      prisma.contact.findMany({
        where: { ...baseWhereNoStatus, leadStatus: 'OPEN_DEAL' },
      }),
      prisma.contact.findMany({
        where: { ...baseWhereNoStatus, leadStatus: { in: OPEN_LEAD_STATUSES } },
      }),
      prisma.contact.findMany({
        where: { ...baseWhereNoStatus, leadStatus: { in: CLOSED_NURTURE_STATUSES } },
      }),
    ])

    const allColumnIds = Array.from(new Set([
      ...tier1Contacts.map(c => c.contactId),
      ...openLeadContacts.map(c => c.contactId),
      ...closedNurtureContacts.map(c => c.contactId),
    ]))

    // Fetch closedNurtureReason from deals for Open Deal contacts only
    const openDealContactIds = tier1Contacts.map(c => c.contactId).filter(Boolean) as string[]
    const nurtureReasonRows = await prisma.$queryRaw<{ contactId: string; closedNurtureReason: string | null }[]>`
      SELECT "contactId", "closedNurtureReason"
      FROM deals
      WHERE "contactId" = ANY(${openDealContactIds})
        AND "closedNurtureReason" IS NOT NULL
    `
    const nurtureReasonMap = new Map(nurtureReasonRows.map(r => [r.contactId, r.closedNurtureReason]))

    const [latestEngagements, engagementCounts] = await Promise.all([
      prisma.engagement.findMany({
        where: { contactId: { in: allColumnIds }, timestamp: { lte: new Date() } },
        orderBy: { timestamp: 'desc' },
        distinct: ['contactId'],
      }),
      prisma.engagement.groupBy({
        by: ['contactId'],
        where: { contactId: { in: allColumnIds } },
        _count: { _all: true },
      }),
    ])

    const engagementMap = new Map(latestEngagements.map(e => [e.contactId, e]))
    const countMap = new Map(engagementCounts.map(e => [e.contactId, e._count._all]))

    const sortByLastActivity = <T extends { lastActivity?: Date }>(arr: T[]): T[] =>
      arr.sort((a, b) => {
        if (!a.lastActivity) return -1
        if (!b.lastActivity) return 1
        return a.lastActivity.getTime() - b.lastActivity.getTime()
      })

    const buildEntry = (c: any) => {
      const lastEng = engagementMap.get(c.contactId)
      const ipadDate = c.ipadShipmentDate ?? c.ipadCoverShipDate ?? null
      const lastDate = lastEng?.timestamp ?? ipadDate ?? undefined
      return {
        contactId: c.contactId,
        name: `${c.firstName} ${c.lastName}`,
        specialty: c.specialty ?? null,
        ownerName: ownerMap.get(c.ownerId ?? '') ?? 'Unassigned',
        lastActivity: lastDate,
        status: c.leadStatus,
        tier1: c.tier1 ?? false,
        dealStatus: c.dealStatus ?? null,
        closedNurtureReason: nurtureReasonMap.get(c.contactId) ?? null,
        notes: c.notes ?? null,
        outreachCount: (countMap.get(c.contactId) ?? 0) + (c.ipadShipmentDate ? 1 : 0) + (c.ipadCoverShipDate ? 1 : 0),
      }
    }

    const staleTier1s = sortByLastActivity(tier1Contacts.map(buildEntry))
    const openLeads = sortByLastActivity(openLeadContacts.map(buildEntry))
    const closedNurture = sortByLastActivity(
      closedNurtureContacts.map(c => {
        const entry = buildEntry(c)
        const hasDisposition = c.notInterestedNowResponseDate != null || c.notInterestedAtAllResponseDate != null
        const lastEng = engagementMap.get(c.contactId)
        const lastTouch = lastEng?.timestamp ?? c.ipadShipmentDate ?? c.ipadCoverShipDate ?? null
        const hiddenByDisposition = hasDisposition && !!lastTouch && new Date(lastTouch) >= sixMonthsAgo
        return { ...entry, hiddenByDisposition }
      })
    )

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

    // Fetch open tasks (NOT_STARTED, due in the future) for all trigger contacts
    const now = new Date()
    const openTasks = await prisma.engagement.findMany({
      where: {
        contactId: { in: contactIdsForTriggers },
        type: 'TASK',
        taskStatus: 'NOT_STARTED',
        timestamp: { gt: now },
      },
      orderBy: { timestamp: 'asc' },
      select: { contactId: true, timestamp: true, body: true },
    })
    // Map contactId -> earliest open task
    const openTaskByContact = new Map<string, { timestamp: Date; body: string | null }>()
    for (const task of openTasks) {
      if (task.contactId && !openTaskByContact.has(task.contactId)) {
        openTaskByContact.set(task.contactId, { timestamp: task.timestamp, body: task.body })
      }
    }

    for (const t of triggers) {
      const body = t.body?.toLowerCase() || ''
      const matchedWord = triggerWords.find(word => body.includes(word))

      if (matchedWord) {
        const contact = triggerContactMap.get(t.contactId!)
        if (contact) {
          const openTask = openTaskByContact.get(contact.contactId)
          actionableTriggers.push({
            contactId: contact.contactId,
            contactName: `${contact.firstName} ${contact.lastName}`,
            ownerName: ownerMap.get(contact.ownerId ?? '') ?? 'Unassigned',
            activityType: t.type,
            body: t.body,
            timestamp: t.timestamp,
            trigger: matchedWord,
            coveredByTask: openTask
              ? { dueDate: openTask.timestamp, subject: openTask.body }
              : null,
          })
        }
      }
    }

    // In-pipeline contacts for the universe card (enriched with deal stage)
    const inPipelineContacts = await prisma.contact.findMany({
      where: { ...baseWhere, contactId: { in: pipelineContactIds } },
      select: { contactId: true, firstName: true, lastName: true, specialty: true, ownerId: true, leadStatus: true },
    })
    const inPipelineDeals = await prisma.deal.findMany({
      where: { contactId: { in: pipelineContactIds }, stage: { in: ACTIVE_PIPELINE_STAGES } },
      select: { contactId: true, stage: true },
    })
    const pipelineDealStageMap = new Map(inPipelineDeals.map(d => [d.contactId, d.stage]))

    // Addressable universe — built from column data so counts always match what's displayed
    const BIZ_MISMATCH_BUCKETS = ['Model / Financial Mismatch', 'Geography / Strategic Hold', 'Complex Ownership']

    function parseBucketName(reason: string | null | undefined): string | null {
      if (!reason) return null
      const idx = reason.indexOf(' — ')
      return (idx === -1 ? reason : reason.slice(0, idx)).trim()
    }

    type UniverseKey = 'inPipeline' | 'fairGame' | 'notNow' | 'notInterested' | 'businessModelMismatch' | 'other'
    function normalizeBucket(bucket: string | null): UniverseKey {
      if (!bucket) return 'other'
      if (bucket === 'Unresponsive') return 'fairGame'
      if (bucket === 'Too Early / Timing') return 'notNow'
      if (bucket === 'Not Interested') return 'notInterested'
      if (BIZ_MISMATCH_BUCKETS.includes(bucket) || bucket === 'Business Model Mismatch') return 'businessModelMismatch'
      return 'other'
    }

    type UniverseContact = { contactId: string; name: string; specialty: string | null; ownerName: string; dealStage?: string | null }
    const universeGroups: Record<UniverseKey, UniverseContact[]> = {
      inPipeline: [], fairGame: [], notNow: [], notInterested: [], businessModelMismatch: [], other: [],
    }

    for (const c of inPipelineContacts) {
      universeGroups.inPipeline.push({
        contactId: c.contactId,
        name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
        specialty: c.specialty ?? null,
        ownerName: ownerMap.get(c.ownerId ?? '') ?? 'Unassigned',
        dealStage: pipelineDealStageMap.get(c.contactId) ?? null,
      })
    }
    for (const c of staleTier1s) {
      universeGroups[normalizeBucket(parseBucketName(c.closedNurtureReason))].push(
        { contactId: c.contactId, name: c.name, specialty: c.specialty, ownerName: c.ownerName }
      )
    }
    for (const c of openLeads) {
      universeGroups.fairGame.push(
        { contactId: c.contactId, name: c.name, specialty: c.specialty, ownerName: c.ownerName }
      )
    }
    for (const c of closedNurture) {
      universeGroups[normalizeBucket(parseBucketName(c.notes))].push(
        { contactId: c.contactId, name: c.name, specialty: c.specialty, ownerName: c.ownerName }
      )
    }

    const total = (Object.values(universeGroups) as UniverseContact[][]).reduce((sum, arr) => sum + arr.length, 0)

    return NextResponse.json({
      staleTier1s,
      openLeads,
      closedNurture,
      actionableTriggers: actionableTriggers.slice(0, 20),
      universe: {
        total,
        inPipeline:            { count: universeGroups.inPipeline.length,            contacts: universeGroups.inPipeline },
        fairGame:              { count: universeGroups.fairGame.length,              contacts: universeGroups.fairGame },
        notNow:                { count: universeGroups.notNow.length,                contacts: universeGroups.notNow },
        notInterested:         { count: universeGroups.notInterested.length,         contacts: universeGroups.notInterested },
        businessModelMismatch: { count: universeGroups.businessModelMismatch.length, contacts: universeGroups.businessModelMismatch },
        other:                 { count: universeGroups.other.length,                 contacts: universeGroups.other },
      }
    })
  } catch (error: any) {
    console.error('Game Plan API error:', error)
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}
