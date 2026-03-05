import { Client } from '@hubspot/api-client'

// Initialize HubSpot client with access token
const getHubSpotClient = () => {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error('HUBSPOT_ACCESS_TOKEN environment variable is not set')
  }

  return new Client({ accessToken })
}

// Singleton instance
let hubspotClient: Client | null = null

export const getClient = (): Client => {
  if (!hubspotClient) {
    hubspotClient = getHubSpotClient()
  }
  return hubspotClient
}

// Cache configuration
export const CACHE_TTL_MINUTES = parseInt(
  process.env.CACHE_TTL_MINUTES || '60',
  10
)

// In-memory cache for quick access
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<any>>()

export function getCachedData<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null

  const age = Date.now() - entry.timestamp
  const maxAge = CACHE_TTL_MINUTES * 60 * 1000

  if (age > maxAge) {
    cache.delete(key)
    return null
  }

  return entry.data as T
}

export function setCachedData<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  })
}

export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}
