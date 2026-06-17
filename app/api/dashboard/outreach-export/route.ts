import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWeekStart } from '@/lib/outreach/pool'
import { getActiveCampaign } from '@/lib/campaigns'
import { format } from 'date-fns'

async function findActiveCycle(): Promise<{ weekStart: Date } | null> {
  const now = getWeekStart()
  for (let i = 0; i < 3; i++) {
    const candidate = new Date(now)
    candidate.setUTCDate(candidate.getUTCDate() - i * 7)
    const count = await prisma.outreachWeekAssignment.count({ where: { weekStart: candidate } })
    if (count > 0) return { weekStart: candidate }
  }
  return null
}

function csvCell(val: string | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toWeekLabel(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return `Week of ${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(2)}`
}

export async function GET() {
  const cycle = await findActiveCycle()
  if (!cycle) return NextResponse.json({ error: 'No active cycle' }, { status: 404 })

  const { weekStart } = cycle
  const assignments = await prisma.outreachWeekAssignment.findMany({
    where: { weekStart },
    orderBy: [{ week: 'asc' }],
  })
  const contactIds = assignments.map(a => a.contactId)
  if (contactIds.length === 0) {
    return new NextResponse('', { headers: { 'Content-Type': 'text/csv' } })
  }

  const campaign = getActiveCampaign()
  const campaignTag = campaign?.tag ?? '10'
  const campaignLabel = campaign?.label ?? 'Campaign Mailed'

  const [contacts, mailerTasks] = await Promise.all([
    prisma.contact.findMany({
      where: { contactId: { in: contactIds } },
      select: {
        contactId: true,
        firstName: true,
        lastName: true,
        email: true,
        specialty: true,
        city: true,
        state: true,
        leadStatus: true,
        dealStatus: true,
        notes: true,
        closestReferral: true,
        companyId: true,
      },
    }),
    prisma.engagement.findMany({
      where: {
        type: 'TASK',
        taskStatus: 'COMPLETED',
        body: { startsWith: campaignTag },
        contactId: { in: contactIds },
      },
      orderBy: { timestamp: 'asc' },
      select: { contactId: true, timestamp: true },
    }),
  ])

  const companyIds = Array.from(new Set(contacts.map(c => c.companyId).filter(Boolean) as string[]))
  const companies = companyIds.length
    ? await prisma.company.findMany({
        where: { companyId: { in: companyIds } },
        select: { companyId: true, companyName: true, numDvms: true },
      })
    : []

  const companyMap = new Map(companies.map(c => [c.companyId, c]))
  const contactMap = new Map(contacts.map(c => [c.contactId, c]))

  const mailerDateMap = new Map<string, Date>()
  for (const t of mailerTasks) {
    if (t.contactId && !mailerDateMap.has(t.contactId)) {
      mailerDateMap.set(t.contactId, t.timestamp)
    }
  }

  const headers = [
    'Week',
    'First Name',
    'Last Name',
    'Email',
    'Contact Specialty',
    'Company Name',
    '# DVMs in Practice (Inc Residents)',
    campaignLabel,
    'Street Address',
    'City',
    'State',
    'Lead Status',
    'Deal Status',
    'Referral Name',
    'Referral Status',
    'Notes',
  ]

  const rows: string[][] = [headers]

  for (const a of assignments) {
    const c = contactMap.get(a.contactId)
    if (!c) continue
    const company = c.companyId ? companyMap.get(c.companyId) : undefined
    const mailerDate = mailerDateMap.get(a.contactId)

    rows.push([
      String(a.week),
      c.firstName ?? '',
      c.lastName ?? '',
      c.email ?? '',
      c.specialty ?? '',
      company?.companyName ?? '',
      company?.numDvms != null ? String(company.numDvms) : '',
      mailerDate ? toWeekLabel(mailerDate) : '',
      '', // Street address not in DB
      c.city ?? '',
      c.state ?? '',
      c.leadStatus ?? '',
      c.dealStatus ?? '',
      c.closestReferral ?? '',
      '', // Referral status not in DB
      c.notes ?? '',
    ])
  }

  const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="outreach-cycle-${format(weekStart, 'yyyy-MM-dd')}.csv"`,
    },
  })
}
