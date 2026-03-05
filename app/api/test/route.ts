import { NextResponse } from 'next/server'
import { getDeals, getOwners } from '@/lib/hubspot'

export async function GET() {
  try {
    // Test fetching owners (smaller dataset)
    console.log('Testing HubSpot connection...')
    const owners = await getOwners(true) // Force refresh to test API

    console.log('Testing deals fetch...')
    const deals = await getDeals(true) // Force refresh

    return NextResponse.json({
      success: true,
      message: 'HubSpot connection successful!',
      data: {
        ownersCount: owners.length,
        dealsCount: deals.length,
        sampleOwner: owners[0] || null,
        sampleDeal: deals[0] || null,
      }
    })
  } catch (error) {
    console.error('HubSpot connection test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
