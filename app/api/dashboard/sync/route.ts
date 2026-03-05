import { NextRequest, NextResponse } from 'next/server'
import { getContacts, refreshContacts } from '@/lib/hubspot/contacts'
import { refreshOwners } from '@/lib/hubspot/owners'
import { refreshCompanies } from '@/lib/hubspot/companies'
import { getDeals, refreshDeals } from '@/lib/hubspot/deals'
import { syncAllEngagements, syncEngagementType, getLastEngagementSync } from '@/lib/hubspot/engagements'
import { syncSequenceEnrollments } from '@/lib/hubspot/sequences'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const fullRefresh = body.fullRefresh === true
    const lookbackDays = parseInt(body.lookbackDays ?? '90', 10)

    // step=contacts|companies|engagements|sequences|deals|all (default: all)
    const step: string = body.step ?? 'all'

    const lastSync = await getLastEngagementSync()
    const sinceDateMs =
      fullRefresh || !lastSync
        ? Date.now() - lookbackDays * 24 * 60 * 60 * 1000
        : lastSync.getTime()

    console.log(`Sync step="${step}" fullRefresh=${fullRefresh} since=${new Date(sinceDateMs).toISOString()}`)

    // ── CONTACTS & OWNERS ─────────────────────────────────────────────
    if (step === 'contacts' || step === 'all') {
      const [contacts, owners] = await Promise.allSettled([
        fullRefresh ? refreshContacts() : getContacts(),
        refreshOwners(),
      ])
      await refreshCompanies()
      const contactCount = contacts.status === 'fulfilled' ? contacts.value.length : 0
      const ownerCount = owners.status === 'fulfilled' ? owners.value.length : 0
      console.log(`Contacts=${contactCount} Owners=${ownerCount}`)

      if (step === 'contacts') {
        return NextResponse.json({
          success: true, syncedAt: new Date().toISOString(),
          counts: { contacts: contactCount, owners: ownerCount },
        })
      }
    }

    // ── DEALS ─────────────────────────────────────────────────────────
    if (step === 'deals' || step === 'all') {
      const deals = await (fullRefresh ? refreshDeals() : getDeals())
      console.log(`Deals=${deals.length}`)

      if (step === 'deals') {
        return NextResponse.json({
          success: true, syncedAt: new Date().toISOString(),
          counts: { deals: deals.length },
        })
      }
    }

    // ── ENGAGEMENTS ───────────────────────────────────────────────────
    if (step === 'engagements' || step === 'all') {
      const engagementCounts = await syncAllEngagements(sinceDateMs)
      console.log('Engagement counts:', engagementCounts)

      if (step === 'engagements') {
        return NextResponse.json({
          success: true, syncedAt: new Date().toISOString(),
          counts: Object.fromEntries(
            Object.entries(engagementCounts).map(([k, v]) => [`engagement_${k}`, v])
          ),
        })
      }
    }

    // ── SEQUENCES ─────────────────────────────────────────────────────
    if (step === 'sequences' || step === 'all') {
      let enrollmentCount = 0
      try {
        enrollmentCount = await syncSequenceEnrollments(sinceDateMs)
      } catch (err: any) {
        console.warn('Sequence enrollment sync failed (non-fatal):', err?.message)
      }

      if (step === 'sequences') {
        return NextResponse.json({
          success: true, syncedAt: new Date().toISOString(),
          counts: { sequence_enrollments: enrollmentCount },
        })
      }
    }

    return NextResponse.json({ success: true, syncedAt: new Date().toISOString() })
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const { prisma } = await import('@/lib/db/prisma')
    const metas = await prisma.cacheMetadata.findMany({
      orderBy: { lastRefresh: 'desc' },
    })
    return NextResponse.json({ syncStatus: metas })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
