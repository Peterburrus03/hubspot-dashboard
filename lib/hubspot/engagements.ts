import { getClient } from './client'
import { prisma } from '../db/prisma'
import type { EngagementRecord } from '@/types/hubspot'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      if (error?.code === 429 || error?.status === 429) {
        const retryAfter = parseInt(error?.headers?.['retry-after'] || '10', 10)
        console.warn(`Rate limited. Retrying after ${retryAfter}s…`)
        await sleep(retryAfter * 1000)
      } else if ((error?.code >= 500 || error?.status >= 500) && attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000)
      } else {
        throw error
      }
    }
  }
  throw lastError
}

type EngagementObjectType = 'emails' | 'calls' | 'notes' | 'meetings' | 'tasks'

const ENGAGEMENT_TYPE_MAP: Record<EngagementObjectType, EngagementRecord['type']> = {
  emails: 'EMAIL',
  calls: 'CALL',
  notes: 'NOTE',
  meetings: 'MEETING',
  tasks: 'TASK',
}

const PROPERTIES_MAP: Record<EngagementObjectType, string[]> = {
  emails: [
    'hs_timestamp',
    'hubspot_owner_id',
    'hs_email_direction',
    'hs_email_subject',
    'hs_email_status',
    'hs_email_opens_count',
    'hs_email_click_count',
    'hs_email_replied',
  ],
  calls: [
    'hs_timestamp',
    'hubspot_owner_id',
    'hs_call_direction',
    'hs_call_duration',
    'hs_call_disposition',
    'hs_call_status',
    'hs_call_body',
  ],
  notes: ['hs_timestamp', 'hubspot_owner_id', 'hs_note_body'],
  meetings: ['hs_timestamp', 'hubspot_owner_id', 'hs_meeting_title', 'hs_meeting_body', 'hs_meeting_start_time'],
  tasks: ['hs_timestamp', 'hubspot_owner_id', 'hs_task_subject', 'hs_task_status', 'hs_task_completion_date'],
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseHsTimestamp(value?: string): Date {
  if (!value) return new Date()
  // HubSpot can return ISO strings ("2026-02-26T...") or ms timestamps ("1706744400000")
  // parseInt("2026-02-26T...") = 2026 which is wrong, so check for ISO format first
  if (/^\d{4}-/.test(value)) return new Date(value)
  const ms = parseInt(value, 10)
  // If the parsed number is tiny (< year 2000 as ms), treat original as ISO
  return ms > 946684800000 ? new Date(ms) : new Date(value)
}

function transformEngagement(
  item: any,
  objectType: EngagementObjectType,
  contactId?: string
): EngagementRecord {
  const props = item.properties || {}
  const type = ENGAGEMENT_TYPE_MAP[objectType]

  // For tasks, prefer the subject as the body (hs_task_body is almost always empty)
  // For meetings, store the title so the calendar can filter/display it
  let body = type === 'TASK'
    ? props.hs_task_subject || props.hs_task_body || undefined
    : type === 'MEETING'
    ? [props.hs_meeting_title, props.hs_meeting_body ? stripHtml(props.hs_meeting_body) : undefined].filter(Boolean).join('\n') || undefined
    : props.hs_note_body || props.hs_call_body || undefined
  if (type === 'EMAIL' && !body) body = props.hs_email_text || undefined

  return {
    engagementId: item.id,
    type,
    ownerId: props.hubspot_owner_id || undefined,
    contactId: contactId || undefined,
    timestamp: parseHsTimestamp(props.hs_timestamp),
    body,
    emailDirection: props.hs_email_direction || undefined,
    emailSubject: props.hs_email_subject || undefined,
    emailStatus: props.hs_email_status || undefined,
    emailOpens: props.hs_email_opens_count
      ? parseInt(props.hs_email_opens_count, 10)
      : undefined,
    emailClicks: props.hs_email_click_count
      ? parseInt(props.hs_email_click_count, 10)
      : undefined,
    emailReplied: props.hs_email_replied === 'true' ? true : undefined,
    callDirection: props.hs_call_direction || undefined,
    callDuration: props.hs_call_duration ? parseInt(props.hs_call_duration, 10) : undefined,
    callDisposition: props.hs_call_disposition || undefined,
    callStatus: props.hs_call_status || undefined,
    taskStatus: props.hs_task_status || undefined,
  }
}

async function searchEngagements(
  objectType: EngagementObjectType,
  sinceDateMs?: number,
  untilDateMs?: number
): Promise<any[]> {
  const client = getClient()
  const properties = PROPERTIES_MAP[objectType]
  const allResults: any[] = []

  const filters: any[] = []
  if (sinceDateMs) filters.push({ propertyName: 'hs_timestamp', operator: 'GTE', value: String(sinceDateMs) })
  if (untilDateMs) filters.push({ propertyName: 'hs_timestamp', operator: 'LT', value: String(untilDateMs) })
  const filterGroups = filters.length > 0 ? [{ filters }] : []

  let after: string | undefined

  do {
    const body: any = {
      filterGroups,
      properties,
      limit: 100,
      sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }],
    }
    if (after) body.after = after

    const data: any = await withRetry(async () => {
      const res = await client.apiRequest({
        method: 'POST',
        path: `/crm/v3/objects/${objectType}/search`,
        body,
      })
      if (typeof res.json === 'function') return res.json()
      return res
    })

    allResults.push(...(data.results || []))
    after = data.paging?.next?.after
  } while (after)

  return allResults
}

async function fetchContactAssociations(
  objectType: EngagementObjectType,
  ids: string[]
): Promise<Map<string, string>> {
  const client = getClient()
  const batchSize = 100

  // Collect all raw associations first
  const rawAssociations = new Map<string, string[]>() // engagementId → [contactId, ...]

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    try {
      const data: any = await withRetry(async () => {
        const res = await client.apiRequest({
          method: 'POST',
          path: `/crm/v4/associations/${objectType}/contacts/batch/read`,
          body: { inputs: batch.map((id) => ({ id })) },
        })
        if (typeof res.json === 'function') return res.json()
        return res
      })

      for (const result of data.results || []) {
        if (result.to?.length > 0) {
          rawAssociations.set(
            String(result.from.id),
            result.to.map((t: any) => String(t.toObjectId))
          )
        }
      }
    } catch (err: any) {
      if (err?.status === 404) continue
      console.error(`Association fetch error for ${objectType}:`, err?.message)
    }
  }

  // Collect all unique candidate contactIds and check which exist in our DB
  const allCandidateIds = Array.from(new Set(Array.from(rawAssociations.values()).flat()))
  const knownContacts = await prisma.contact.findMany({
    where: { contactId: { in: allCandidateIds } },
    select: { contactId: true },
  })
  const knownContactIds = new Set(knownContacts.map((c) => c.contactId))

  // For each engagement, prefer a contact that exists in our DB over to[0]
  const map = new Map<string, string>()
  for (const [engagementId, candidates] of rawAssociations) {
    const preferred = candidates.find((id) => knownContactIds.has(id))
    map.set(engagementId, preferred ?? candidates[0])
  }

  return map
}

async function upsertEngagements(records: EngagementRecord[]): Promise<void> {
  const CHUNK = 200
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK)
    await Promise.all(
      chunk.map((r) =>
        prisma.engagement.upsert({
          where: { engagementId: r.engagementId },
          update: {
            type: r.type,
            ownerId: r.ownerId ?? null,
            contactId: r.contactId ?? null,
            timestamp: r.timestamp,
            emailDirection: r.emailDirection ?? null,
            emailSubject: r.emailSubject ?? null,
            emailStatus: r.emailStatus ?? null,
            emailOpens: r.emailOpens ?? null,
            emailClicks: r.emailClicks ?? null,
            emailReplied: r.emailReplied ?? null,
            callDirection: r.callDirection ?? null,
            callDuration: r.callDuration ?? null,
            callDisposition: r.callDisposition ?? null,
            callStatus: r.callStatus ?? null,
            taskStatus: r.taskStatus ?? null,
            body: r.body ?? null,
            sequenceId: r.sequenceId ?? null,
            lastSyncedAt: new Date(),
          },
          create: {
            engagementId: r.engagementId,
            type: r.type,
            ownerId: r.ownerId ?? null,
            contactId: r.contactId ?? null,
            timestamp: r.timestamp,
            emailDirection: r.emailDirection ?? null,
            emailSubject: r.emailSubject ?? null,
            emailStatus: r.emailStatus ?? null,
            emailOpens: r.emailOpens ?? null,
            emailClicks: r.emailClicks ?? null,
            emailReplied: r.emailReplied ?? null,
            callDirection: r.callDirection ?? null,
            callDuration: r.callDuration ?? null,
            callDisposition: r.callDisposition ?? null,
            callStatus: r.callStatus ?? null,
            taskStatus: r.taskStatus ?? null,
            body: r.body ?? null,
            sequenceId: r.sequenceId ?? null,
            lastSyncedAt: new Date(),
          },
        })
      )
    )
  }
}

export async function syncEngagementType(
  objectType: EngagementObjectType,
  sinceDateMs?: number,
  windowDays = 90
): Promise<number> {
  const now = Date.now()
  const start = sinceDateMs ?? now - windowDays * 24 * 60 * 60 * 1000

  // Break into 90-day windows to stay under HubSpot's search pagination cap
  const MS_PER_WINDOW = windowDays * 24 * 60 * 60 * 1000
  const windows: Array<{ from: number; to: number }> = []
  for (let from = start; from < now; from += MS_PER_WINDOW) {
    windows.push({ from, to: Math.min(from + MS_PER_WINDOW, now) })
  }

  let total = 0
  for (const { from, to } of windows) {
    console.log(`Syncing ${objectType} ${new Date(from).toISOString()} → ${new Date(to).toISOString()}…`)
    const items = await searchEngagements(objectType, from, to)
    if (items.length === 0) continue

    const ids = items.map((i) => String(i.id))
    const assocMap = await fetchContactAssociations(objectType, ids)
    const records = items.map((item) =>
      transformEngagement(item, objectType, assocMap.get(String(item.id)))
    )
    await upsertEngagements(records)
    total += records.length
    console.log(`  → ${records.length} ${objectType} (window total: ${total})`)
  }

  await prisma.cacheMetadata.upsert({
    where: { cacheKey: `engagements_${objectType}` },
    update: { lastRefresh: new Date(), recordCount: total, status: 'success', errorMessage: null },
    create: { cacheKey: `engagements_${objectType}`, lastRefresh: new Date(), recordCount: total, status: 'success' },
  })

  console.log(`Synced ${total} ${objectType} total`)
  return total
}

export async function syncAllEngagements(sinceDateMs?: number): Promise<Record<string, number>> {
  const types: EngagementObjectType[] = ['emails', 'calls', 'notes', 'meetings', 'tasks']
  const results: Record<string, number> = {}

  for (const type of types) {
    try {
      results[type] = await syncEngagementType(type, sinceDateMs)
    } catch (err: any) {
      console.error(`Failed to sync ${type}:`, err?.message)
      results[type] = 0
    }
  }

  return results
}

export async function getLastEngagementSync(): Promise<Date | null> {
  const meta = await prisma.cacheMetadata.findUnique({
    where: { cacheKey: 'engagements_emails' },
  })
  return meta?.lastRefresh ?? null
}
