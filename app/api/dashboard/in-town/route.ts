import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

const RESPONSE_WINDOW_DAYS = 5
const CHECK_IN_PREFIX = '08'

function isInbound(e: { emailDirection: string | null; callDirection: string | null; type: string }): boolean {
  const dir = (e.emailDirection ?? e.callDirection ?? '').toUpperCase()
  if (e.type === 'EMAIL') return dir.includes('INCOMING') || dir.includes('INBOUND')
  if (e.type === 'CALL') return dir.includes('INBOUND') || dir.includes('INCOMING')
  return false
}

export async function POST(request: NextRequest) {
  try {
    const { contactIds } = await request.json() as { contactIds: string[] }
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ checkIns: {} })
    }

    const checkInTasks = await prisma.engagement.findMany({
      where: {
        contactId: { in: contactIds },
        type: 'TASK',
        taskStatus: 'COMPLETED',
        body: { startsWith: CHECK_IN_PREFIX },
      },
      orderBy: { timestamp: 'desc' },
      select: { engagementId: true, contactId: true, timestamp: true, body: true },
    })

    if (checkInTasks.length === 0) {
      return NextResponse.json({ checkIns: {} })
    }

    // Pull inbound email/call engagements for these contacts within the earliest→latest window
    const earliest = new Date(Math.min(...checkInTasks.map(t => t.timestamp.getTime())))
    const latest = new Date(Math.max(...checkInTasks.map(t => t.timestamp.getTime())))
    const windowEnd = new Date(latest.getTime() + RESPONSE_WINDOW_DAYS * 86400000)

    const inboundCandidates = await prisma.engagement.findMany({
      where: {
        contactId: { in: contactIds },
        type: { in: ['EMAIL', 'CALL'] },
        timestamp: { gte: earliest, lte: windowEnd },
      },
      select: { contactId: true, timestamp: true, type: true, emailDirection: true, callDirection: true },
    })

    // Group inbound engagements by contact
    const inboundByContact = new Map<string, { timestamp: Date }[]>()
    for (const e of inboundCandidates) {
      if (!e.contactId) continue
      if (!isInbound(e)) continue
      if (!inboundByContact.has(e.contactId)) inboundByContact.set(e.contactId, [])
      inboundByContact.get(e.contactId)!.push({ timestamp: e.timestamp })
    }

    type CheckInRecord = {
      timestamp: string
      responded: boolean
      respondedAt: string | null
    }
    const perContact: Record<string, {
      count: number
      lastCheckInAt: string
      respondedCount: number
      awaitingCount: number
      tasks: CheckInRecord[]
    }> = {}

    for (const t of checkInTasks) {
      if (!t.contactId) continue
      const inbounds = inboundByContact.get(t.contactId) ?? []
      const windowEndForTask = t.timestamp.getTime() + RESPONSE_WINDOW_DAYS * 86400000
      const match = inbounds.find(i =>
        i.timestamp.getTime() > t.timestamp.getTime() &&
        i.timestamp.getTime() <= windowEndForTask
      )
      const record: CheckInRecord = {
        timestamp: t.timestamp.toISOString(),
        responded: !!match,
        respondedAt: match ? match.timestamp.toISOString() : null,
      }
      if (!perContact[t.contactId]) {
        perContact[t.contactId] = {
          count: 0,
          lastCheckInAt: record.timestamp,
          respondedCount: 0,
          awaitingCount: 0,
          tasks: [],
        }
      }
      const pc = perContact[t.contactId]
      pc.count++
      pc.tasks.push(record)
      if (record.responded) pc.respondedCount++
      else pc.awaitingCount++
      // tasks are fetched desc, so the first one recorded is the latest
      if (new Date(record.timestamp) > new Date(pc.lastCheckInAt)) {
        pc.lastCheckInAt = record.timestamp
      }
    }

    return NextResponse.json({ checkIns: perContact })
  } catch (error: any) {
    console.error('In-Town API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
