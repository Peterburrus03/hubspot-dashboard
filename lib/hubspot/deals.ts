import { getClient, getCachedData, setCachedData } from './client'
import { prisma } from '../db/prisma'
import { getPipelineMap } from './pipelines'
import type { HubSpotDeal, HubSpotPaginatedResponse, Deal } from '@/types/hubspot'

// Properties to fetch for deals
const DEAL_PROPERTIES = [
  'dealname',
  'hubspot_owner_id',
  'dealstage',
  'hs_forecast_probability',
  'amount',
  'hs_projected_amount',
  'normalized_ebitda',
  'createdate',
  'initial_outreach_date',
  'hs_v2_date_entered_qualifiedtobuy',
  'first_meeting',
  'steve_meeting_date',
  'nda_sign_date',
  'data_received_date',
  'committee_presented_date',
  'loi_extended_date',
  'loi_signed_date',
  'target_close_date',
  'revised_expected_close_date',
  'closedate',
  'integration_completion_and_handover_date',
  'official_closed_date',
  'city',
  'state',
  'specialty',
  'num_dvms',
  'dvms__boarded___residents_',
  'next_step',
  'deal_notes',
  'closed_lost_reason',
  'closed_nurture_reasons',
  'tags',
  'hs_is_closed',
  'pipeline',
  // Stage-entered dates — required so hs_date_entered_${stageId} is populated by the API
  'hs_date_entered_1316238082', // APA Signed
]

// Helper to parse date from HubSpot timestamp string (ms) or ISO string
function parseHubSpotDate(dateString?: string): Date | undefined {
  if (!dateString) return undefined
  const timestamp = parseInt(dateString, 10)
  if (!isNaN(timestamp) && timestamp > 1000000000000) return new Date(timestamp)
  const d = new Date(dateString)
  return isNaN(d.getTime()) ? undefined : d
}

// Helper to parse number from HubSpot string
function parseNumber(value?: string): number | undefined {
  if (!value) return undefined
  const num = parseFloat(value)
  return isNaN(num) ? undefined : num
}

async function fetchDealCompanyAssociations(ids: string[]): Promise<Map<string, string>> {
  const client = getClient()
  const map = new Map<string, string>()
  const batchSize = 100

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    try {
      const data: any = await withRetry(async () => {
        const res = await client.apiRequest({
          method: 'POST',
          path: `/crm/v4/associations/deals/companies/batch/read`,
          body: { inputs: batch.map((id) => ({ id })) },
        })
        if (typeof res.json === 'function') return res.json()
        return res
      })

      for (const result of data.results || []) {
        if (result.to?.length > 0) {
          map.set(String(result.from.id), String(result.to[0].toObjectId))
        }
      }
    } catch (err: any) {
      if (err?.status === 404) continue
      console.warn('Deal company association fetch error:', err?.message)
    }
  }

  return map
}

async function fetchDealContactAssociations(ids: string[]): Promise<Map<string, string>> {
  const client = getClient()
  const map = new Map<string, string>()
  const batchSize = 100

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    try {
      const data: any = await withRetry(async () => {
        const res = await client.apiRequest({
          method: 'POST',
          path: `/crm/v4/associations/deals/contacts/batch/read`,
          body: { inputs: batch.map((id) => ({ id })) },
        })
        if (typeof res.json === 'function') return res.json()
        return res
      })

      for (const result of data.results || []) {
        if (result.to?.length > 0) {
          map.set(String(result.from.id), String(result.to[0].toObjectId))
        }
      }
    } catch (err: any) {
      if (err?.status === 404) continue
      console.warn('Deal contact association fetch error:', err?.message)
    }
  }

  return map
}

// Transform HubSpot deal to internal format
function transformDeal(hubspotDeal: HubSpotDeal, stageMap: Map<string, string>, companyId?: string, contactId?: string): Deal {
  const props = hubspotDeal.properties
  const stageId = props.dealstage
  const stageLabel = stageId ? (stageMap.get(stageId) || stageId)?.trim() : undefined
  // hs_date_entered_* is often null on manually-managed deals.
  // Fall back to milestone dates that mark when a deal likely entered its current stage,
  // then to deal createdAt as a last resort.
  const stageLabel2 = stageId ? (stageMap.get(stageId) || stageId)?.trim() : undefined
  const hsDateEntered = stageId ? parseHubSpotDate(props[`hs_date_entered_${stageId}`]) : undefined
  const stageEnteredDate = hsDateEntered ?? (() => {
    switch (stageLabel2) {
      case 'Engaged':                          return parseHubSpotDate(props.initial_outreach_date) ?? parseHubSpotDate(hubspotDeal.createdAt)
      case 'Data Collection (including NDA)':  return parseHubSpotDate(props.nda_sign_date)
      case 'Pre-LOI Analysis':                 return parseHubSpotDate(props.nda_sign_date)
      case 'LOI Signed/Diligence':             return parseHubSpotDate(props.loi_signed_date)
      case 'LOI Extended':                     return parseHubSpotDate(props.loi_extended_date) ?? parseHubSpotDate(props.loi_signed_date)
      case 'APA Signed':                       return undefined // rely solely on hs_date_entered_1316238082 fetched above
      default:                                 return parseHubSpotDate(hubspotDeal.createdAt)
    }
  })()

  return {
    dealId: props.hs_object_id,
    dealName: props.dealname,
    ownerId: props.hubspot_owner_id,
    stage: stageLabel,
    pipelineId: props.pipeline,
    companyId: companyId,
    contactId: contactId,
    probability: parseNumber(props.hs_forecast_probability),
    revenue: parseNumber(props.amount),
    weightedAmount: parseNumber(props.hs_projected_amount),
    ebitda: parseNumber(props.normalized_ebitda),
    dealCreatedAt: parseHubSpotDate(props.createdate),
    initialOutreachDate: parseHubSpotDate(props.initial_outreach_date),
    qualifiedToBuyDate: parseHubSpotDate(props.hs_v2_date_entered_qualifiedtobuy),
    engagedDate: parseHubSpotDate(props.first_meeting) ?? parseHubSpotDate(props.hs_v2_date_entered_qualifiedtobuy),
    steveMeetingDate: parseHubSpotDate(props.steve_meeting_date),
    ndaSignedDate: parseHubSpotDate(props.nda_sign_date),
    dataReceivedDate: parseHubSpotDate(props.data_received_date),
    committeePresentedDate: parseHubSpotDate(props.committee_presented_date),
    loiExtendedDate: parseHubSpotDate(props.loi_extended_date),
    loiSignedDate: parseHubSpotDate(props.loi_signed_date),
    targetCloseDate: parseHubSpotDate(props.target_close_date),
    revisedCloseDate: parseHubSpotDate(props.revised_expected_close_date),
    closedDate: parseHubSpotDate(props.closedate),
    integrationCompletionDate: parseHubSpotDate(props.integration_completion_and_handover_date),
    officialClosedDate: parseHubSpotDate(props.official_closed_date),
    city: props.city,
    state: props.state,
    specialty: props.specialty,
    numDvms: parseNumber(props.dvms__boarded___residents_) ?? parseNumber(props.num_dvms),
    nextStep: props.next_step,
    notes: props.deal_notes,
    closedLostReason: props.closed_lost_reason,
    closedNurtureReason: props.closed_nurture_reasons,
    tags: props.tags,
    isOpen: props.hs_is_closed !== 'true',
    stageEnteredDate,
  }
}

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
        console.warn(`Deals rate limited. Waiting ${retryAfter}s…`)
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

// Fetch all deals from HubSpot with pagination
async function fetchAllDealsFromHubSpot(extraProperties: string[] = []): Promise<HubSpotDeal[]> {
  const client = getClient()
  const allDeals: HubSpotDeal[] = []
  let after: string | undefined
  const properties = [...DEAL_PROPERTIES, ...extraProperties]

  try {
    do {
      const response: any = await withRetry(() =>
        client.crm.deals.basicApi.getPage(
          100,
          after,
          properties,
          undefined,
          undefined,
          false
        )
      )

      if (response.results) {
        allDeals.push(...response.results)
      }

      after = response.paging?.next?.after
    } while (after)

    console.log(`Fetched ${allDeals.length} deals from HubSpot`)
    return allDeals
  } catch (error) {
    console.error('Error fetching deals from HubSpot:', error)
    throw error
  }
}

// Sync deals to database
async function syncDealsToDatabase(deals: Deal[]): Promise<void> {
  try {
    console.log(`Starting sync of ${deals.length} deals to database...`)
    const t1 = deals.find(d => d.pipelineId === '705209413')
    console.log(`Sample deal pipeline check: ${deals[0]?.dealName} -> ${deals[0]?.pipelineId}`)
    if (t1) console.log(`Found Acquisition deal: ${t1.dealName}`)

    // Fetch current stages so we can detect stage changes
    const existingStages = await prisma.deal.findMany({
      select: { dealId: true, stage: true, stageEnteredDate: true },
    })
    const stageMap2 = new Map(existingStages.map((d) => [d.dealId, d]))

    // Upsert all deals
    for (const deal of deals) {
      const existing = stageMap2.get(deal.dealId)
      // If stage changed since last sync, record entry date as now.
      // If stage is unchanged, preserve any existing DB value (may be manually corrected)
      // and only fall back to the HubSpot-derived date if we have nothing stored yet.
      const stageChanged = existing && existing.stage !== deal.stage
      const stageEnteredDate = stageChanged
        ? new Date()
        : (existing?.stageEnteredDate ?? deal.stageEnteredDate ?? undefined)

      await prisma.deal.upsert({
        where: { dealId: deal.dealId },
        update: {
          dealName: deal.dealName,
          ownerId: deal.ownerId,
          stage: deal.stage,
          stageEnteredDate: stageEnteredDate,
          probability: deal.probability,
          revenue: deal.revenue,
          weightedAmount: deal.weightedAmount,
          ebitda: deal.ebitda,
          initialOutreachDate: deal.initialOutreachDate,
          ndaSignedDate: deal.ndaSignedDate,
          loiExtendedDate: deal.loiExtendedDate,
          loiSignedDate: deal.loiSignedDate,
          targetCloseDate: deal.targetCloseDate,
          revisedCloseDate: deal.revisedCloseDate,
          closedDate: deal.closedDate,
          city: deal.city,
          state: deal.state,
          specialty: deal.specialty,
          numDvms: deal.numDvms,
          nextStep: deal.nextStep,
          notes: deal.notes,
          closedLostReason: deal.closedLostReason,
          tags: deal.tags,
          isOpen: deal.isOpen,
          pipelineId: deal.pipelineId || null,
          companyId: deal.companyId || null,
          contactId: deal.contactId || null,
          lastSyncedAt: new Date(),
        },
        create: {
          dealId: deal.dealId,
          dealName: deal.dealName,
          ownerId: deal.ownerId,
          stage: deal.stage,
          stageEnteredDate: stageEnteredDate,
          probability: deal.probability,
          revenue: deal.revenue,
          weightedAmount: deal.weightedAmount,
          ebitda: deal.ebitda,
          initialOutreachDate: deal.initialOutreachDate,
          ndaSignedDate: deal.ndaSignedDate,
          loiExtendedDate: deal.loiExtendedDate,
          loiSignedDate: deal.loiSignedDate,
          targetCloseDate: deal.targetCloseDate,
          revisedCloseDate: deal.revisedCloseDate,
          closedDate: deal.closedDate,
          city: deal.city,
          state: deal.state,
          specialty: deal.specialty,
          numDvms: deal.numDvms,
          nextStep: deal.nextStep,
          notes: deal.notes,
          closedLostReason: deal.closedLostReason,
          tags: deal.tags,
          isOpen: deal.isOpen,
          pipelineId: deal.pipelineId || null,
          companyId: deal.companyId || null,
          contactId: deal.contactId || null,
          lastSyncedAt: new Date(),
        },
      })

      // Update new fields that the generated client doesn't know about yet
      // (regeneration blocked by locked DLL — use raw SQL instead)
      await prisma.$executeRaw`
        UPDATE deals
        SET "dealCreatedAt"             = ${deal.dealCreatedAt ?? null},
            "qualifiedToBuyDate"        = ${deal.qualifiedToBuyDate ?? null},
            "engagedDate"               = ${deal.engagedDate ?? null},
            "integrationCompletionDate" = ${deal.integrationCompletionDate ?? null},
            "officialClosedDate"        = ${deal.officialClosedDate ?? null},
            "dataReceivedDate"          = ${deal.dataReceivedDate ?? null},
            "committeePresentedDate"    = ${deal.committeePresentedDate ?? null},
            "closedNurtureReason"       = ${deal.closedNurtureReason ?? null}
        WHERE "dealId" = ${deal.dealId}
      `
    }

    // Delete deals that no longer exist in HubSpot
    const hubspotDealIds = new Set(deals.map((d) => d.dealId))
    const toDelete = existingStages.filter((d) => !hubspotDealIds.has(d.dealId)).map((d) => d.dealId)
    if (toDelete.length > 0) {
      console.log(`Deleting ${toDelete.length} deals removed from HubSpot: ${toDelete.join(', ')}`)
      await prisma.deal.deleteMany({ where: { dealId: { in: toDelete } } })
    }

    // Update cache metadata
    await prisma.cacheMetadata.upsert({
      where: { cacheKey: 'deals' },
      update: {
        lastRefresh: new Date(),
        recordCount: deals.length,
        status: 'success',
        errorMessage: null,
      },
      create: {
        cacheKey: 'deals',
        lastRefresh: new Date(),
        recordCount: deals.length,
        status: 'success',
      },
    })

    console.log(`Synced ${deals.length} deals to database`)
  } catch (error) {
    console.error('Error syncing deals to database:', error)

    // Log error in cache metadata
    await prisma.cacheMetadata.upsert({
      where: { cacheKey: 'deals' },
      update: {
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
      create: {
        cacheKey: 'deals',
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    throw error
  }
}

// Main function to get deals (with caching)
export async function getDeals(forceRefresh = false): Promise<Deal[]> {
  // Check in-memory cache first
  if (!forceRefresh) {
    const cached = getCachedData<Deal[]>('deals')
    if (cached) {
      console.log('Returning deals from in-memory cache')
      return cached
    }

    // Check database cache
    const dbDeals = await prisma.deal.findMany({
      orderBy: { updatedAt: 'desc' },
    })

    if (dbDeals.length > 0) {
      const metadata = await prisma.cacheMetadata.findUnique({
        where: { cacheKey: 'deals' },
      })

      // Check if cache is still fresh
      if (metadata && metadata.lastRefresh) {
        const cacheAge = Date.now() - metadata.lastRefresh.getTime()
        const maxAge = parseInt(process.env.CACHE_TTL_MINUTES || '60', 10) * 60 * 1000

        if (cacheAge < maxAge) {
          console.log('Returning deals from database cache')
          const deals = dbDeals.map((d) => ({
            dealId: d.dealId,
            dealName: d.dealName || undefined,
            ownerId: d.ownerId || undefined,
            stage: d.stage || undefined,
            probability: d.probability || undefined,
            revenue: d.revenue || undefined,
            weightedAmount: d.weightedAmount || undefined,
            ebitda: d.ebitda || undefined,
            initialOutreachDate: d.initialOutreachDate || undefined,
            ndaSignedDate: d.ndaSignedDate || undefined,
            loiExtendedDate: d.loiExtendedDate || undefined,
            loiSignedDate: d.loiSignedDate || undefined,
            targetCloseDate: d.targetCloseDate || undefined,
            revisedCloseDate: d.revisedCloseDate || undefined,
            closedDate: d.closedDate || undefined,
            city: d.city || undefined,
            state: d.state || undefined,
            specialty: d.specialty || undefined,
            numDvms: d.numDvms || undefined,
            nextStep: d.nextStep || undefined,
            notes: d.notes || undefined,
            closedLostReason: d.closedLostReason || undefined,
            tags: d.tags || undefined,
            stageEnteredDate: d.stageEnteredDate || undefined,
            isOpen: d.isOpen,
            pipelineId: d.pipelineId || undefined,
            companyId: d.companyId || undefined,
            contactId: d.contactId || undefined,
          }))

          // Store in memory cache
          setCachedData('deals', deals)
          return deals
        }
      }
    }
  }

  // Fetch fresh data from HubSpot
  console.log('Fetching fresh deals from HubSpot')
  const stageMap = await getPipelineMap()
  const stageEnteredProps = Array.from(stageMap.keys()).map((id) => `hs_date_entered_${id}`)
  const hubspotDeals = await fetchAllDealsFromHubSpot(stageEnteredProps)
  
  const dealIds = hubspotDeals.map((d) => d.id)
  const [compMap, contMap] = await Promise.all([
    fetchDealCompanyAssociations(dealIds),
    fetchDealContactAssociations(dealIds),
  ])
  
  const deals = hubspotDeals.map((d) => transformDeal(d, stageMap, compMap.get(d.id), contMap.get(d.id)))

  // Sync to database
  await syncDealsToDatabase(deals)

  // Store in memory cache
  setCachedData('deals', deals)

  return deals
}

// Refresh deals (alias for getDeals with forceRefresh)
export async function refreshDeals(): Promise<Deal[]> {
  return getDeals(true)
}
