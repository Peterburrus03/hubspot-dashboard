import { getClient, getCachedData, setCachedData } from './client'
import { prisma } from '../db/prisma'
import type { HubSpotContact, Contact } from '@/types/hubspot'

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
        console.warn(`Contacts rate limited. Waiting ${retryAfter}s…`)
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

const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'hubspot_owner_id',
  'specialty',
  'contact_status',
  'hs_lead_status',
  'city',
  'state',
  'ipad_cover_ship_date',
  'ipad_shipment_date',
  'ipad_group',
  'ipad_response',
  'ipad_response_type',
  'associatedcompanyid',
  'high_priority_target_lead',
  'owner__associate__resident_',
  'interested_response_date',
  'not_interested_now_response_date',
  'not_interested_at_all_response_date',
  'deal_status',
  'practice_type',
  'approximate_age',
  'year_opened',
  'dvms',
  'notes',
]

// Helper to parse date from HubSpot — handles both ms timestamps and YYYY-MM-DD strings
function parseHubSpotDate(dateString?: string): Date | undefined {
  if (!dateString) return undefined
  // ISO date string (e.g. "2025-01-15")
  if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) return new Date(dateString)
  // Unix ms timestamp (e.g. "1705363200000")
  const timestamp = parseInt(dateString, 10)
  return isNaN(timestamp) ? undefined : new Date(timestamp)
}

function transformContact(hubspotContact: HubSpotContact): Contact {
  const props = hubspotContact.properties
  const isTier1 = props.high_priority_target_lead === 'true'

  return {
    contactId: props.hs_object_id,
    firstName: props.firstname,
    lastName: props.lastname,
    email: props.email,
    ownerId: props.hubspot_owner_id,
    specialty: props.specialty,
    status: props.contact_status,
    leadStatus: props.hs_lead_status,
    city: props.city,
    state: props.state,
    ipadCoverShipDate: parseHubSpotDate(props.ipad_cover_ship_date),
    ipadShipmentDate: parseHubSpotDate(props.ipad_shipment_date),
    ipadGroup: props.ipad_group,
    ipadResponse: props.ipad_response === 'true',
    ipadResponseType: props.ipad_response_type,
    companyId: props.associatedcompanyid,
    tier1: isTier1,
    professionalStatus: props.owner__associate__resident_,
    interestedResponseDate: parseHubSpotDate(props.interested_response_date),
    notInterestedNowResponseDate: parseHubSpotDate(props.not_interested_now_response_date),
    notInterestedAtAllResponseDate: parseHubSpotDate(props.not_interested_at_all_response_date),
    dealStatus: props.deal_status,
    practiceType: props.practice_type,
    approximateAge: props.approximate_age ? parseInt(props.approximate_age, 10) || undefined : undefined,
    yearOpened: props.year_opened ? parseInt(props.year_opened, 10) || undefined : undefined,
    dvms: props.dvms,
    notes: props.notes,
  }
}

async function fetchAllContactsFromHubSpot(): Promise<HubSpotContact[]> {
  const client = getClient()
  const allContacts: HubSpotContact[] = []
  let after: string | undefined

  try {
    do {
      const response: any = await withRetry(() =>
        client.crm.contacts.searchApi.doSearch({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'hs_lead_status',
                  operator: 'HAS_PROPERTY' as any,
                },
              ],
            },
          ],
          properties: CONTACT_PROPERTIES,
          limit: 100,
          after: after as any,
        })
      )

      if (response.results) {
        allContacts.push(...response.results)
      }

      after = response.paging?.next?.after
    } while (after)

    console.log(`Fetched ${allContacts.length} active leads from HubSpot`)
    return allContacts
  } catch (error) {
    console.error('Error fetching contacts from HubSpot:', error)
    throw error
  }
}

async function syncContactsToDatabase(contacts: Contact[]): Promise<void> {
  try {
    const now = new Date()
    const CHUNK = 300
    for (let i = 0; i < contacts.length; i += CHUNK) {
      const chunk = contacts.slice(i, i + CHUNK)
      await prisma.$transaction(
        chunk.map((contact) =>
          prisma.contact.upsert({
            where: { contactId: contact.contactId },
            update: { ...contact, lastSyncedAt: now },
            create: { ...contact, lastSyncedAt: now },
          })
        )
      )
    }

    await prisma.cacheMetadata.upsert({
      where: { cacheKey: 'contacts' },
      update: {
        lastRefresh: new Date(),
        recordCount: contacts.length,
        status: 'success',
        errorMessage: null,
      },
      create: {
        cacheKey: 'contacts',
        lastRefresh: new Date(),
        recordCount: contacts.length,
        status: 'success',
      },
    })

    console.log(`Synced ${contacts.length} contacts to database`)
  } catch (error) {
    console.error('Error syncing contacts to database:', error)
    throw error
  }
}

export async function getContacts(forceRefresh = false): Promise<Contact[]> {
  if (!forceRefresh) {
    const cached = getCachedData<Contact[]>('contacts')
    if (cached) {
      console.log('Returning contacts from in-memory cache')
      return cached
    }

    const dbContacts = await prisma.contact.findMany({
      orderBy: { updatedAt: 'desc' },
    })

    if (dbContacts.length > 0) {
      const metadata = await prisma.cacheMetadata.findUnique({
        where: { cacheKey: 'contacts' },
      })

      if (metadata && metadata.lastRefresh) {
        const cacheAge = Date.now() - metadata.lastRefresh.getTime()
        const maxAge = parseInt(process.env.CACHE_TTL_MINUTES || '60', 10) * 60 * 1000

        if (cacheAge < maxAge) {
          console.log('Returning contacts from database cache')
          const contacts = dbContacts.map((c) => ({
            contactId: c.contactId,
            firstName: c.firstName || undefined,
            lastName: c.lastName || undefined,
            email: c.email || undefined,
            ownerId: c.ownerId || undefined,
            specialty: c.specialty || undefined,
            status: c.status || undefined,
            leadStatus: c.leadStatus || undefined,
            city: c.city || undefined,
            state: c.state || undefined,
            ipadCoverShipDate: c.ipadCoverShipDate || undefined,
            ipadShipmentDate: c.ipadShipmentDate || undefined,
            ipadGroup: c.ipadGroup || undefined,
            ipadResponse: c.ipadResponse || undefined,
            ipadResponseType: c.ipadResponseType || undefined,
            companyId: c.companyId || undefined,
            tier1: c.tier1 ?? undefined,
            professionalStatus: c.professionalStatus || undefined,
            interestedResponseDate: c.interestedResponseDate || undefined,
            notInterestedNowResponseDate: c.notInterestedNowResponseDate || undefined,
            notInterestedAtAllResponseDate: c.notInterestedAtAllResponseDate || undefined,
            dealStatus: c.dealStatus || undefined,
            practiceType: c.practiceType || undefined,
            approximateAge: c.approximateAge || undefined,
            yearOpened: c.yearOpened || undefined,
            dvms: c.dvms || undefined,
          }))

          setCachedData('contacts', contacts)
          return contacts
        }
      }
    }
  }

  console.log('Fetching fresh contacts from HubSpot')
  const hubspotContacts = await fetchAllContactsFromHubSpot()
  const contacts = hubspotContacts.map(transformContact)

  await syncContactsToDatabase(contacts)
  setCachedData('contacts', contacts)

  return contacts
}

export async function refreshContacts(): Promise<Contact[]> {
  return getContacts(true)
}
