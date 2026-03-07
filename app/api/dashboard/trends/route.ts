import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerIds = searchParams.get('ownerIds')?.split(',').filter(Boolean) ?? []
    const specialties = searchParams.get('specialties')?.split(',').filter(Boolean) ?? []
    const companyTypes = searchParams.get('companyTypes')?.split(',').filter(Boolean) ?? []
    
    // 1. Define stages that count as "Successful Path to Engagement"
    // We use a broader match to handle trailing spaces or minor HubSpot label changes
    const successStageKeywords = [
      'Engaged', 
      'NDA', 
      'Analysis', 
      'Committee', 
      'LOI', 
      'Diligence',
      'Closed Won'
    ]

    // Resolve Owner contacts for professional status filter
    const ownerContacts = await prisma.contact.findMany({
      where: { professionalStatus: 'Owner' },
      select: { contactId: true },
    })
    const ownerContactIds = ownerContacts.map(c => c.contactId)

    // 2. Fetch all deals first to find associated contacts
    const deals = await prisma.deal.findMany({
      where: {
        pipelineId: '705209413', // AOSN Acquisition
        contactId: { in: ownerContactIds },
        ...(ownerIds.length > 0 ? { ownerId: { in: ownerIds } } : {}),
        ...(specialties.length > 0 ? { specialty: { in: specialties } } : {}),
      },
      select: {
        contactId: true,
        dealName: true,
        stage: true,
        revenue: true,
        companyId: true
      }
    })

    // Filter deals locally based on stage keywords and company types
    let filteredDeals = deals.filter(d => 
      successStageKeywords.some(key => d.stage?.toLowerCase().includes(key.toLowerCase()))
    )

    if (companyTypes.length > 0) {
      const companies = await prisma.company.findMany({
        where: { 
          companyId: { in: filteredDeals.map(d => d.companyId).filter(Boolean) as string[] },
          companyType: { in: companyTypes }
        },
        select: { companyId: true }
      })
      const validCompanyIds = new Set(companies.map(c => c.companyId))
      filteredDeals = filteredDeals.filter(d => validCompanyIds.has(d.companyId ?? ''))
    }

    const contactIds = Array.from(new Set(filteredDeals.map(d => d.contactId!)))

    if (contactIds.length === 0) {
      return NextResponse.json({
        summary: { avgTouches: 0, avgDays: 0, totalSuccessfulLeads: 0, typeDistribution: { manualEmail: 0, automatedEmail: 0, calls: 0, meetings: 0 } },
        attribution: []
      })
    }

    // 3. Fetch all engagements for these successful contacts
    const engagements = await prisma.engagement.findMany({
      where: { contactId: { in: contactIds } },
      orderBy: { timestamp: 'asc' }
    })

    const contactEngs = new Map<string, any[]>()
    engagements.forEach(e => {
      if (!contactEngs.has(e.contactId!)) contactEngs.set(e.contactId!, [])
      contactEngs.get(e.contactId!)!.push(e)
    })

    const attribution = contactIds.map(cid => {
      const engs = contactEngs.get(cid) ?? []
      const deal = filteredDeals.find(d => d.contactId === cid)
      
      const counts = {
        EMAIL: engs.filter(e => e.type === 'EMAIL' && e.emailDirection !== 'AUTOMATED_EMAIL').length,
        AUTOMATED: engs.filter(e => e.emailDirection === 'AUTOMATED_EMAIL').length,
        CALL: engs.filter(e => e.type === 'CALL').length,
        MEETING: engs.filter(e => e.type === 'MEETING').length,
      }

      const firstTouch = engs[0]?.timestamp
      const lastTouch = engs[engs.length - 1]?.timestamp
      const durationDays = firstTouch && lastTouch 
        ? Math.ceil((lastTouch.getTime() - firstTouch.getTime()) / (1000 * 60 * 60 * 24))
        : 0

      return {
        contactId: cid,
        dealName: deal?.dealName,
        stage: deal?.stage,
        revenue: deal?.revenue,
        totalTouches: engs.length,
        durationDays,
        counts
      }
    })

    const summary = {
      avgTouches: attribution.reduce((sum, a) => sum + a.totalTouches, 0) / attribution.length,
      avgDays: attribution.reduce((sum, a) => sum + a.durationDays, 0) / attribution.length,
      totalSuccessfulLeads: attribution.length,
      typeDistribution: {
        manualEmail: attribution.reduce((sum, a) => sum + a.counts.EMAIL, 0),
        automatedEmail: attribution.reduce((sum, a) => sum + a.counts.AUTOMATED, 0),
        calls: attribution.reduce((sum, a) => sum + a.counts.CALL, 0),
        meetings: attribution.reduce((sum, a) => sum + a.counts.MEETING, 0),
      }
    }

    return NextResponse.json({ summary, attribution: attribution.sort((a, b) => b.totalTouches - a.totalTouches) })
  } catch (error: any) {
    console.error('Trends API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
