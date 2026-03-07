import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@/generated/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')! + 'T23:59:59.999Z')
      : new Date()

    const ownerIds = searchParams.get('ownerIds')?.split(',').filter(Boolean) ?? []

    const ownerFilter =
      ownerIds.length > 0
        ? Prisma.sql`AND e."ownerId" = ANY(${ownerIds}::text[])`
        : Prisma.empty

    type ActivityRow = {
      timestamp: Date
      type: string
      body: string | null
      contact_id: string | null
      owner_id: string | null
      first_name: string | null
      last_name: string | null
      email_addr: string | null
      specialty: string | null
      tier1: boolean | null
      company_name: string | null
      num_dvms: number | null
    }

    const rows = await prisma.$queryRaw<ActivityRow[]>(Prisma.sql`
      SELECT
        e.timestamp,
        e.type,
        e.body,
        e."contactId"       AS contact_id,
        e."ownerId"         AS owner_id,
        c."firstName"       AS first_name,
        c."lastName"        AS last_name,
        c.email             AS email_addr,
        c.specialty,
        c.tier1,
        comp."companyName"  AS company_name,
        comp."numDvms"      AS num_dvms
      FROM engagements e
      LEFT JOIN contacts c    ON c."contactId"  = e."contactId"
      LEFT JOIN companies comp ON comp."companyId" = c."companyId"
      WHERE e.timestamp >= ${startDate}
        AND e.timestamp <= ${endDate}
        AND e.type IN ('EMAIL', 'CALL', 'NOTE', 'MEETING', 'TASK')
        AND (e."emailDirection" IS NULL OR e."emailDirection" != 'AUTOMATED_EMAIL')
        ${ownerFilter}
      ORDER BY e.timestamp DESC
      LIMIT 500
    `)

    const owners = await prisma.owner.findMany()
    const ownerMap = new Map(
      owners.map((o) => [
        o.ownerId,
        [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || o.ownerId,
      ])
    )

    const TOUCH_TYPE_MAP: Record<string, string> = {
      EMAIL: 'Email',
      CALL: 'Call',
      NOTE: 'Note',
      MEETING: 'Meeting',
      TASK: 'Task',
    }

    const activity = rows.map((row) => {
      const contactName =
        [row.first_name, row.last_name].filter(Boolean).join(' ') ||
        row.email_addr ||
        'Unknown'
      const touchType = TOUCH_TYPE_MAP[row.type] ?? row.type
      return {
        date: row.timestamp.toISOString().slice(0, 10),
        time: row.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }),
        contact: contactName,
        tier: row.tier1 ? 'Tier 1' : 'Non-Tier 1',
        practice: row.company_name ?? '',
        specialty: row.specialty ?? '',
        touchType,
        dvms: row.num_dvms ?? 0,
        notes: row.body ? row.body.slice(0, 500) : '',
        engaged: ['EMAIL', 'CALL', 'MEETING'].includes(row.type),
        owner: ownerMap.get(row.owner_id ?? '') ?? row.owner_id ?? 'Unknown',
      }
    })

    return NextResponse.json({ activity })
  } catch (error: any) {
    console.error('Activity Log API error:', error)
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
