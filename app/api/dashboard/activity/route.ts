import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@/generated/prisma'

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
    const specialties = searchParams.get('specialties')?.split(',').filter(Boolean) ?? []
    const companyTypes = searchParams.get('companyTypes')?.split(',').filter(Boolean) ?? []
    const includeRemoved = searchParams.get('includeRemoved') !== 'false'
    const tier1Only = searchParams.get('tier1Only') === 'true'

    // Build WHERE clause fragments using tagged template (sql-safe)
    const ownerFilter =
      ownerIds.length > 0
        ? Prisma.sql`AND e."ownerId" = ANY(${ownerIds}::text[])`
        : Prisma.empty
    const specialtyFilter =
      specialties.length > 0
        ? Prisma.sql`AND c.specialty = ANY(${specialties}::text[])`
        : Prisma.empty
    const removedFilter = includeRemoved
      ? Prisma.empty
      : Prisma.sql`AND (c."leadStatus" IS NULL OR c."leadStatus" != 'Requested Removal From List')`
    const tier1Filter = tier1Only
      ? Prisma.sql`AND c."tier1" = true`
      : Prisma.empty

    // Company type filter — resolve company IDs first (small list)
    let companyFilter = Prisma.empty
    if (companyTypes.length > 0) {
      const matchingCompanies = await prisma.company.findMany({
        where: { companyType: { in: companyTypes } },
        select: { companyId: true },
      })
      const companyIds = matchingCompanies.map((c) => c.companyId)
      if (companyIds.length > 0) {
        companyFilter = Prisma.sql`AND c."companyId" = ANY(${companyIds}::text[])`
      } else {
        // No matching companies → no results
        return NextResponse.json({
          summary: { totalEmails: 0, totalCalls: 0, totalNotes: 0, totalMeetings: 0, totalTasks: 0, totalSequenceTouches: 0 },
          byOwner: [],
        })
      }
    }

    // ── Owner activity aggregation ────────────────────────────────────
    type OwnerRow = {
      owner_id: string
      emails: bigint
      calls: bigint
      notes: bigint
      meetings: bigint
      tasks: bigint
      seq_touches: bigint
      contacts_reached: bigint
    }

    const ownerRows = await prisma.$queryRaw<OwnerRow[]>(Prisma.sql`
      SELECT
        e."ownerId"                                                                                                    AS owner_id,
        COUNT(CASE WHEN e.type = 'EMAIL' AND (e."emailDirection" IS NULL OR e."emailDirection" != 'AUTOMATED_EMAIL') THEN 1 END) AS emails,
        COUNT(CASE WHEN e.type = 'CALL'    THEN 1 END)                                                                AS calls,
        COUNT(CASE WHEN e.type = 'NOTE'    THEN 1 END)                                                                AS notes,
        COUNT(CASE WHEN e.type = 'MEETING' THEN 1 END)                                                                AS meetings,
        COUNT(CASE WHEN e.type = 'TASK'    THEN 1 END)                                                                AS tasks,
        COUNT(CASE WHEN e.type = 'EMAIL' AND e."emailDirection" = 'AUTOMATED_EMAIL' THEN 1 END)                       AS seq_touches,
        COUNT(DISTINCT e."contactId")                                                                                  AS contacts_reached
      FROM engagements e
      LEFT JOIN contacts c   ON c."contactId"  = e."contactId"
      LEFT JOIN companies comp ON comp."companyId" = c."companyId"
      WHERE e.timestamp >= ${startDate}
        AND e.timestamp <= ${endDate}
        ${ownerFilter}
        ${specialtyFilter}
        ${removedFilter}
        ${companyFilter}
        ${tier1Filter}
      GROUP BY e."ownerId"
    `)

    // Add sequence enrollment counts per owner (separate table)
    const enrollmentRows = await prisma.$queryRaw<{ owner_id: string; cnt: bigint }[]>(
      Prisma.sql`
        SELECT se."ownerId" AS owner_id, COUNT(*) AS cnt
        FROM sequence_enrollments se
        LEFT JOIN contacts c   ON c."contactId"    = se."contactId"
        LEFT JOIN companies comp ON comp."companyId" = c."companyId"
        WHERE se."enrolledAt" >= ${startDate}
          AND se."enrolledAt" <= ${endDate}
          ${ownerIds.length > 0 ? Prisma.sql`AND se."ownerId" = ANY(${ownerIds}::text[])` : Prisma.empty}
          ${specialtyFilter}
          ${removedFilter}
          ${companyFilter}
          ${tier1Filter}
        GROUP BY se."ownerId"
      `
    )

    const enrollmentMap = new Map(
      enrollmentRows.map((r) => [r.owner_id ?? 'unknown', Number(r.cnt)])
    )

    // ── Contact-level follow-up data ──────────────────────────────────
    type ContactRow = {
      contact_id: string
      owner_id: string
      touch_count: bigint
      last_touch: Date
      first_name: string | null
      last_name: string | null
      email: string | null
    }

    const contactRows = await prisma.$queryRaw<ContactRow[]>(Prisma.sql`
      SELECT
        e."contactId"   AS contact_id,
        e."ownerId"     AS owner_id,
        COUNT(*)        AS touch_count,
        MAX(e.timestamp) AS last_touch,
        c."firstName"   AS first_name,
        c."lastName"    AS last_name,
        c.email
      FROM engagements e
      LEFT JOIN contacts c   ON c."contactId"    = e."contactId"
      LEFT JOIN companies comp ON comp."companyId" = c."companyId"
      WHERE e.timestamp >= ${startDate}
        AND e.timestamp <= ${endDate}
        AND e."contactId" IS NOT NULL
        ${ownerFilter}
        ${specialtyFilter}
        ${removedFilter}
        ${companyFilter}
        ${tier1Filter}
      GROUP BY e."contactId", e."ownerId", c."firstName", c."lastName", c.email
      ORDER BY touch_count DESC
      LIMIT 500
    `)

    // ── Load owners for name mapping ──────────────────────────────────
    const owners = await prisma.owner.findMany()
    const ownerMap = new Map(
      owners.map((o) => [
        o.ownerId,
        [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || o.ownerId,
      ])
    )

    // ── Build follow-up map per owner ─────────────────────────────────
    const followUpsByOwner = new Map<
      string,
      { contactId: string; contactName: string; touchCount: number; lastTouch: string | null }[]
    >()

    for (const row of contactRows) {
      const oid = row.owner_id ?? 'unknown'
      if (!followUpsByOwner.has(oid)) followUpsByOwner.set(oid, [])
      followUpsByOwner.get(oid)!.push({
        contactId: row.contact_id ?? '',
        contactName:
          [row.first_name, row.last_name].filter(Boolean).join(' ') ||
          row.email ||
          row.contact_id ||
          'Unknown',
        touchCount: Number(row.touch_count),
        lastTouch: row.last_touch ? new Date(row.last_touch).toISOString() : null,
      })
    }

    // ── Assemble per-owner response ───────────────────────────────────
    const byOwner = ownerRows.map((row) => {
      const oid = row.owner_id ?? 'unknown'
      const seqTouches = Number(row.seq_touches) + (enrollmentMap.get(oid) ?? 0)
      return {
        ownerId: oid,
        ownerName: ownerMap.get(oid) ?? oid,
        emails: Number(row.emails),
        calls: Number(row.calls),
        notes: Number(row.notes),
        meetings: Number(row.meetings),
        tasks: Number(row.tasks),
        sequenceTouches: seqTouches,
        contactsReached: Number(row.contacts_reached),
        followUps: followUpsByOwner.get(oid) ?? [],
      }
    })

    byOwner.sort(
      (a, b) =>
        b.emails + b.calls + b.notes + b.meetings + b.sequenceTouches -
        (a.emails + a.calls + a.notes + a.meetings + a.sequenceTouches)
    )

    const summary = {
      totalEmails: byOwner.reduce((s, r) => s + r.emails, 0),
      totalCalls: byOwner.reduce((s, r) => s + r.calls, 0),
      totalNotes: byOwner.reduce((s, r) => s + r.notes, 0),
      totalMeetings: byOwner.reduce((s, r) => s + r.meetings, 0),
      totalTasks: byOwner.reduce((s, r) => s + r.tasks, 0),
      totalSequenceTouches: byOwner.reduce((s, r) => s + r.sequenceTouches, 0),
    }

    return NextResponse.json({ summary, byOwner })
  } catch (error: any) {
    console.error('Activity API error:', error)
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
