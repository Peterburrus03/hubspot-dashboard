import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWeekStart } from '@/lib/outreach/pool'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { contactId, contacted, meetingSet, meetingDate, meetingNotes } = body

    if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 })

    const weekStart = getWeekStart()
    const update: any = {}
    if (contacted !== undefined) update.contacted = contacted
    if (meetingSet !== undefined) update.meetingSet = meetingSet
    if (meetingDate !== undefined) update.meetingDate = meetingDate ? new Date(meetingDate) : null
    if (meetingNotes !== undefined) update.meetingNotes = meetingNotes

    const comp = await prisma.outreachCompletion.upsert({
      where: { weekStart_contactId: { weekStart, contactId } },
      create: { weekStart, contactId, ...update },
      update,
    })

    return NextResponse.json({
      ok: true,
      completion: {
        contacted: comp.contacted,
        meetingSet: comp.meetingSet,
        meetingDate: comp.meetingDate?.toISOString() ?? null,
        meetingNotes: comp.meetingNotes ?? null,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
