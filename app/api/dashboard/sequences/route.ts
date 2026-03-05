import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')! + 'T23:59:59.999Z')
      : new Date()

    const ownerIds = searchParams.get('ownerIds')?.split(',').filter(Boolean) ?? []
    const includeRemoved = searchParams.get('includeRemoved') !== 'false'

    const where: any = {
      enrolledAt: { gte: startDate, lte: endDate },
      sequenceId: { not: null },
    }
    if (ownerIds.length > 0) where.ownerId = { in: ownerIds }

    if (!includeRemoved) {
      const removed = await prisma.contact.findMany({
        where: { leadStatus: 'Requested Removal From List' },
        select: { contactId: true },
      })
      const removedIds = removed.map((c) => c.contactId)
      if (removedIds.length > 0) {
        where.contactId = { notIn: removedIds }
      }
    }

    const enrollments = await prisma.sequenceEnrollment.findMany({
      where,
      select: {
        sequenceId: true,
        sequenceName: true,
        ownerId: true,
        status: true,
        contactId: true,
      },
    })

    // Load owners for name mapping
    const owners = await prisma.owner.findMany()
    const ownerMap = new Map(
      owners.map((o) => [
        o.ownerId,
        [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || o.ownerId,
      ])
    )

    // Group by sequence
    const sequenceMap = new Map<
      string,
      {
        sequenceId: string
        sequenceName: string
        total: number
        active: number
        finished: number
        unenrolled: number
        byOwner: Map<string, number>
      }
    >()

    for (const enr of enrollments) {
      const sid = enr.sequenceId!
      if (!sequenceMap.has(sid)) {
        sequenceMap.set(sid, {
          sequenceId: sid,
          sequenceName: enr.sequenceName || sid,
          total: 0,
          active: 0,
          finished: 0,
          unenrolled: 0,
          byOwner: new Map(),
        })
      }
      const seq = sequenceMap.get(sid)!
      seq.total++

      const status = (enr.status ?? '').toUpperCase()
      if (status === 'ACTIVE') seq.active++
      else if (status === 'FINISHED') seq.finished++
      else if (status === 'UNENROLLED' || status === 'ERRORED') seq.unenrolled++

      const oid = enr.ownerId ?? 'unknown'
      seq.byOwner.set(oid, (seq.byOwner.get(oid) ?? 0) + 1)
    }

    const sequences = [...sequenceMap.values()]
      .map((s) => ({
        sequenceId: s.sequenceId,
        sequenceName: s.sequenceName,
        totalEnrolled: s.total,
        active: s.active,
        finished: s.finished,
        unenrolled: s.unenrolled,
        byOwner: [...s.byOwner.entries()]
          .map(([oid, count]) => ({
            ownerId: oid,
            ownerName: ownerMap.get(oid) ?? oid,
            count,
          }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.totalEnrolled - a.totalEnrolled)

    return NextResponse.json({ sequences })
  } catch (error: any) {
    console.error('Sequences API error:', error)
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
