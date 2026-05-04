import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import peerReferrals from '@/lib/peer-referrals.json'

type Top5Entry = { rank: number; name: string; score: number | null; explanation: string }
const peerReferralsByName = peerReferrals as Record<string, Top5Entry[]>

type MatchedContact = {
  contactId: string | null
  contactName: string
  specialty: string | null
  state: string | null
  ownerName: string | null
  rank: number
  score: number | null
  explanation: string
}

type DvmRow = {
  dvmName: string
  totalContacts: number
  avgScore: number | null
  rankCounts: { rank1: number; rank2: number; rank3: number; rank4: number; rank5: number }
  contacts: MatchedContact[]
}

type DvmMatch = {
  rank: number
  dvmName: string
  score: number | null
  explanation: string
}

type ContactRow = {
  contactId: string | null
  contactName: string
  specialty: string | null
  state: string | null
  ownerName: string | null
  closestReferral: string | null
  totalMatches: number
  avgScore: number | null
  topScore: number | null
  dvmMatches: DvmMatch[]
}

export async function GET() {
  const [contacts, owners] = await Promise.all([
    prisma.contact.findMany({
      select: {
        contactId: true,
        firstName: true,
        lastName: true,
        specialty: true,
        state: true,
        ownerId: true,
        closestReferral: true,
      },
    }),
    prisma.owner.findMany(),
  ])

  const ownerMap = new Map(owners.map(o => [o.ownerId, `${o.firstName} ${o.lastName}`]))
  const contactByName = new Map<string, typeof contacts[number]>()
  for (const c of contacts) {
    const key = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim().toLowerCase().replace(/\s+/g, ' ')
    if (key) contactByName.set(key, c)
  }

  const dvmMap = new Map<string, DvmRow>()

  for (const [contactKey, top5] of Object.entries(peerReferralsByName)) {
    const dbContact = contactByName.get(contactKey)
    const contactName = dbContact
      ? `${dbContact.firstName ?? ''} ${dbContact.lastName ?? ''}`.trim()
      : contactKey.replace(/\b\w/g, c => c.toUpperCase())

    for (const entry of top5) {
      const dvmName = entry.name
      let row = dvmMap.get(dvmName)
      if (!row) {
        row = {
          dvmName,
          totalContacts: 0,
          avgScore: null,
          rankCounts: { rank1: 0, rank2: 0, rank3: 0, rank4: 0, rank5: 0 },
          contacts: [],
        }
        dvmMap.set(dvmName, row)
      }
      row.totalContacts++
      const rankKey = `rank${entry.rank}` as keyof DvmRow['rankCounts']
      row.rankCounts[rankKey]++
      row.contacts.push({
        contactId: dbContact?.contactId ?? null,
        contactName,
        specialty: dbContact?.specialty ?? null,
        state: dbContact?.state ?? null,
        ownerName: dbContact?.ownerId ? (ownerMap.get(dbContact.ownerId) ?? null) : null,
        rank: entry.rank,
        score: entry.score,
        explanation: entry.explanation,
      })
    }
  }

  const dvms = Array.from(dvmMap.values()).map(row => {
    const scores = row.contacts.map(c => c.score).filter((s): s is number => typeof s === 'number')
    row.avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null
    row.contacts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.rank - b.rank)
    return row
  })

  dvms.sort((a, b) => b.totalContacts - a.totalContacts || a.dvmName.localeCompare(b.dvmName))

  // Contact-first grouping ("External Targets"): one row per external contact,
  // expandable to show that contact's top 5 AOSN DVM matches.
  // Hide contacts who have since joined AOSN.
  const externalHide = new Set([
    'kristin bannon', 'ian spiegel', 'robert schick', 'stephen juriga',
    'alon kramer', 'alexander werner', 'brian palmeiro',
    'jacquelyn (jackie) campbell',
  ])
  const contactRows: ContactRow[] = []
  for (const [contactKey, top5] of Object.entries(peerReferralsByName)) {
    if (externalHide.has(contactKey)) continue
    const dbContact = contactByName.get(contactKey)
    const contactName = dbContact
      ? `${dbContact.firstName ?? ''} ${dbContact.lastName ?? ''}`.trim()
      : contactKey.replace(/\b\w/g, c => c.toUpperCase())

    const dvmMatches: DvmMatch[] = top5
      .map(entry => ({
        rank: entry.rank,
        dvmName: entry.name,
        score: entry.score,
        explanation: entry.explanation,
      }))
      .sort((a, b) => a.rank - b.rank)

    const scores = dvmMatches.map(m => m.score).filter((s): s is number => typeof s === 'number')
    const avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null
    const topScore = scores.length ? Math.max(...scores) : null

    contactRows.push({
      contactId: dbContact?.contactId ?? null,
      contactName,
      specialty: dbContact?.specialty ?? null,
      state: dbContact?.state ?? null,
      ownerName: dbContact?.ownerId ? (ownerMap.get(dbContact.ownerId) ?? null) : null,
      closestReferral: dbContact?.closestReferral ?? null,
      totalMatches: dvmMatches.length,
      avgScore,
      topScore,
      dvmMatches,
    })
  }

  contactRows.sort((a, b) => (b.topScore ?? 0) - (a.topScore ?? 0) || a.contactName.localeCompare(b.contactName))

  return NextResponse.json({
    dvms,
    contacts: contactRows,
    totalContactsScanned: Object.keys(peerReferralsByName).length,
    totalDvms: dvms.length,
  })
}
