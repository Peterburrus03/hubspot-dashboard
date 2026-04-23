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

  return NextResponse.json({
    dvms,
    totalContactsScanned: Object.keys(peerReferralsByName).length,
    totalDvms: dvms.length,
  })
}
