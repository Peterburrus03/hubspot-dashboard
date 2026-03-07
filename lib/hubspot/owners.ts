import { getClient, getCachedData, setCachedData } from './client'
import { prisma } from '../db/prisma'
import type { HubSpotOwner, Owner } from '@/types/hubspot'

function transformOwner(hubspotOwner: any): Owner {
  return {
    ownerId: String(hubspotOwner.id),
    firstName: hubspotOwner.firstName,
    lastName: hubspotOwner.lastName,
    email: hubspotOwner.email,
  }
}

async function fetchAllOwnersFromHubSpot(): Promise<any[]> {
  const client = getClient()

  try {
    const response = await client.crm.owners.ownersApi.getPage()
    const results = response.results || []
    console.log(`Fetched ${results.length} owners from HubSpot`)
    return results
  } catch (error) {
    console.error('Error fetching owners from HubSpot:', error)
    throw error
  }
}

async function syncOwnersToDatabase(owners: Owner[]): Promise<void> {
  try {
    await Promise.all(
      owners.map((owner) =>
        prisma.owner.upsert({
          where: { ownerId: owner.ownerId },
          update: {
            ...owner,
            lastSyncedAt: new Date(),
          },
          create: {
            ...owner,
            lastSyncedAt: new Date(),
          },
        })
      )
    )

    await prisma.cacheMetadata.upsert({
      where: { cacheKey: 'owners' },
      update: {
        lastRefresh: new Date(),
        recordCount: owners.length,
        status: 'success',
        errorMessage: null,
      },
      create: {
        cacheKey: 'owners',
        lastRefresh: new Date(),
        recordCount: owners.length,
        status: 'success',
      },
    })

    console.log(`Synced ${owners.length} owners to database`)
  } catch (error) {
    console.error('Error syncing owners to database:', error)
    throw error
  }
}

export async function getOwners(forceRefresh = false): Promise<Owner[]> {
  if (!forceRefresh) {
    const cached = getCachedData<Owner[]>('owners')
    if (cached) {
      console.log('Returning owners from in-memory cache')
      return cached
    }

    const dbOwners = await prisma.owner.findMany({
      orderBy: { lastName: 'asc' },
    })

    if (dbOwners.length > 0) {
      const metadata = await prisma.cacheMetadata.findUnique({
        where: { cacheKey: 'owners' },
      })

      if (metadata && metadata.lastRefresh) {
        const cacheAge = Date.now() - metadata.lastRefresh.getTime()
        const maxAge = parseInt(process.env.CACHE_TTL_MINUTES || '60', 10) * 60 * 1000

        if (cacheAge < maxAge) {
          console.log('Returning owners from database cache')
          const owners = dbOwners.map((o) => ({
            ownerId: o.ownerId,
            firstName: o.firstName || undefined,
            lastName: o.lastName || undefined,
            email: o.email || undefined,
          }))

          setCachedData('owners', owners)
          return owners
        }
      }
    }
  }

  console.log('Fetching fresh owners from HubSpot')
  const hubspotOwners = await fetchAllOwnersFromHubSpot()
  const owners = hubspotOwners.map(transformOwner)

  await syncOwnersToDatabase(owners)
  setCachedData('owners', owners)

  return owners
}

export async function refreshOwners(): Promise<Owner[]> {
  return getOwners(true)
}
