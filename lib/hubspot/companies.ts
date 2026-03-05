import { getClient, getCachedData, setCachedData } from './client'
import { prisma } from '../db/prisma'
import type { HubSpotCompany, Company } from '@/types/hubspot'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastError = err
      const status = err?.code ?? err?.status ?? 0
      if (status === 429) {
        const retryAfter = parseInt(err?.headers?.['retry-after'] || '10', 10)
        console.warn(`Companies rate limited. Waiting ${retryAfter}s…`)
        await sleep(retryAfter * 1000)
      } else if (status >= 500 && attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000)
      } else {
        throw err
      }
    }
  }
  throw lastError
}

const COMPANY_PROPERTIES = [
  'name',
  'city',
  'state',
  'practice_type',
  'num_dvms',
  'annual_revenue',
  'ebitda',
]

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined
  const num = parseFloat(value)
  return isNaN(num) ? undefined : num
}

function transformCompany(hubspotCompany: HubSpotCompany): Company {
  const props = hubspotCompany.properties

  return {
    companyId: props.hs_object_id,
    companyName: props.name,
    city: props.city,
    state: props.state,
    companyType: props.practice_type,
    numDvms: parseNumber(props.num_dvms),
    revenue: parseNumber(props.annual_revenue),
    ebitda: parseNumber(props.ebitda),
  }
}

async function syncCompaniesToDatabase(companies: Company[]): Promise<void> {
  try {
    const now = new Date()
    const CHUNK = 300
    for (let i = 0; i < companies.length; i += CHUNK) {
      const chunk = companies.slice(i, i + CHUNK)
      await prisma.$transaction(
        chunk.map((company) =>
          prisma.company.upsert({
            where: { companyId: company.companyId },
            update: { ...company, lastSyncedAt: now },
            create: { ...company, lastSyncedAt: now },
          })
        )
      )
    }

    await prisma.cacheMetadata.upsert({
      where: { cacheKey: 'companies' },
      update: {
        lastRefresh: new Date(),
        recordCount: companies.length,
        status: 'success',
        errorMessage: null,
      },
      create: {
        cacheKey: 'companies',
        lastRefresh: new Date(),
        recordCount: companies.length,
        status: 'success',
      },
    })

    console.log(`Synced ${companies.length} companies to database`)
  } catch (error) {
    console.error('Error syncing companies to database:', error)
    throw error
  }
}

async function fetchCompaniesByIds(ids: string[]): Promise<HubSpotCompany[]> {
  const client = getClient()
  const results: HubSpotCompany[] = []
  const batchSize = 100

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    try {
      const response: any = await withRetry(() =>
        client.crm.companies.batchApi.read({
          inputs: batch.map((id) => ({ id })),
          properties: COMPANY_PROPERTIES,
          propertiesWithHistory: [],
        })
      )
      if (response.results) {
        results.push(...response.results)
      }
    } catch (error: any) {
      console.error(`Error fetching company batch: ${error.message}`)
    }
  }

  return results
}

export async function getCompanies(forceRefresh = false): Promise<Company[]> {
  if (!forceRefresh) {
    const cached = getCachedData<Company[]>('companies')
    if (cached) return cached

    const dbCompanies = await prisma.company.findMany()
    if (dbCompanies.length > 0) {
      const metadata = await prisma.cacheMetadata.findUnique({ where: { cacheKey: 'companies' } })
      if (metadata && metadata.lastRefresh) {
        const cacheAge = Date.now() - metadata.lastRefresh.getTime()
        const maxAge = (parseInt(process.env.CACHE_TTL_MINUTES || '60', 10)) * 60 * 1000
        if (cacheAge < maxAge) {
          const companies = dbCompanies.map((c) => ({
            companyId: c.companyId,
            companyName: c.companyName || undefined,
            city: c.city || undefined,
            state: c.state || undefined,
            companyType: c.companyType || undefined,
            numDvms: c.numDvms || undefined,
            revenue: c.revenue || undefined,
            ebitda: c.ebitda || undefined,
          }))
          setCachedData('companies', companies)
          return companies
        }
      }
    }
  }

  // Optimize: Only fetch companies associated with our contacts
  const contacts = await prisma.contact.findMany({
    where: { companyId: { not: null } },
    select: { companyId: true },
  })
  const companyIds = Array.from(new Set(contacts.map((c) => c.companyId!)))

  console.log(`Fetching ${companyIds.length} associated companies from HubSpot`)
  const hubspotCompanies = await fetchCompaniesByIds(companyIds)
  const companies = hubspotCompanies.map(transformCompany)

  await syncCompaniesToDatabase(companies)
  setCachedData('companies', companies)

  return companies
}

export async function refreshCompanies(): Promise<Company[]> {
  return getCompanies(true)
}
