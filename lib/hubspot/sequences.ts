import { getClient } from './client'
import { prisma } from '../db/prisma'
import type { SequenceEnrollmentRecord } from '@/types/hubspot'

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
      } else if ((error?.status >= 500 || error?.code >= 500) && attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000)
      } else {
        throw error
      }
    }
  }
  throw lastError
}

// Fetch all sequence definitions to build an id→name map
async function fetchSequenceNames(): Promise<Map<string, string>> {
  const client = getClient()
  const nameMap = new Map<string, string>()

  try {
    let after: string | undefined
    do {
      const qs: Record<string, string> = { limit: '100' }
      if (after) qs.after = after

      const data: any = await withRetry(async () => {
        const res = await client.apiRequest({
          method: 'GET',
          path: '/automation/v4/sequences',
          qs,
        })
        if (typeof res.json === 'function') return res.json()
        return res
      })

      for (const seq of data.results || []) {
        nameMap.set(String(seq.id), seq.name || seq.id)
      }
      after = data.paging?.next?.after
    } while (after)
  } catch (err: any) {
    console.warn('Could not fetch sequence names (may require additional scope):', err?.message)
  }

  return nameMap
}

async function fetchContactAssociationsForEnrollments(
  enrollmentIds: string[]
): Promise<Map<string, string>> {
  const client = getClient()
  const map = new Map<string, string>()
  const batchSize = 100

  for (let i = 0; i < enrollmentIds.length; i += batchSize) {
    const batch = enrollmentIds.slice(i, i + batchSize)
    try {
      const data: any = await withRetry(async () => {
        const res = await client.apiRequest({
          method: 'POST',
          path: '/crm/v4/associations/enrollments/contacts/batch/read',
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
      console.warn('Enrollment association fetch error:', err?.message)
    }
  }

  return map
}

export async function syncSequenceEnrollments(sinceDateMs?: number): Promise<number> {
  const client = getClient()
  console.log('Syncing sequence enrollments…')

  const sequenceNames = await fetchSequenceNames()
  const allEnrollments: any[] = []

  const filterGroups =
    sinceDateMs
      ? [{ filters: [{ propertyName: 'hs_createdate', operator: 'GTE', value: String(sinceDateMs) }] }]
      : []

  let after: string | undefined

  do {
    const body: any = {
      filterGroups,
      properties: [
        'hs_createdate',
        'hs_lastmodifieddate',
        'hs_status',
        'hs_enrolled_by',
        'hs_sequence_id',
        'hs_finish_time',
      ],
      limit: 100,
      sorts: [{ propertyName: 'hs_createdate', direction: 'ASCENDING' }],
    }
    if (after) body.after = after

    try {
      const data: any = await withRetry(async () => {
        const res = await client.apiRequest({
          method: 'POST',
          path: '/crm/v3/objects/enrollments/search',
          body,
        })
        if (typeof res.json === 'function') return res.json()
        return res
      })

      allEnrollments.push(...(data.results || []))
      after = data.paging?.next?.after
    } catch (err: any) {
      console.warn('Could not fetch enrollments:', err?.message)
      break
    }
  } while (after)

  if (allEnrollments.length === 0) {
    console.log('No sequence enrollments found')
    return 0
  }

  const ids = allEnrollments.map((e) => String(e.id))
  const contactMap = await fetchContactAssociationsForEnrollments(ids)

  const records: SequenceEnrollmentRecord[] = allEnrollments.map((item) => {
    const props = item.properties || {}
    const seqId = props.hs_sequence_id || undefined
    return {
      enrollmentId: item.id,
      sequenceId: seqId,
      sequenceName: seqId ? (sequenceNames.get(seqId) || seqId) : undefined,
      contactId: contactMap.get(String(item.id)) || undefined,
      ownerId: props.hs_enrolled_by || undefined,
      status: props.hs_status || undefined,
      enrolledAt: props.hs_createdate ? new Date(parseInt(props.hs_createdate, 10)) : undefined,
      finishedAt: props.hs_finish_time ? new Date(parseInt(props.hs_finish_time, 10)) : undefined,
    }
  })

  const CHUNK = 200
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK)
    await Promise.all(
      chunk.map((r) =>
        prisma.sequenceEnrollment.upsert({
          where: { enrollmentId: r.enrollmentId },
          update: {
            sequenceId: r.sequenceId ?? null,
            sequenceName: r.sequenceName ?? null,
            contactId: r.contactId ?? null,
            ownerId: r.ownerId ?? null,
            status: r.status ?? null,
            enrolledAt: r.enrolledAt ?? null,
            finishedAt: r.finishedAt ?? null,
            lastSyncedAt: new Date(),
          },
          create: {
            enrollmentId: r.enrollmentId,
            sequenceId: r.sequenceId ?? null,
            sequenceName: r.sequenceName ?? null,
            contactId: r.contactId ?? null,
            ownerId: r.ownerId ?? null,
            status: r.status ?? null,
            enrolledAt: r.enrolledAt ?? null,
            finishedAt: r.finishedAt ?? null,
            lastSyncedAt: new Date(),
          },
        })
      )
    )
  }

  await prisma.cacheMetadata.upsert({
    where: { cacheKey: 'sequence_enrollments' },
    update: { lastRefresh: new Date(), recordCount: records.length, status: 'success', errorMessage: null },
    create: { cacheKey: 'sequence_enrollments', lastRefresh: new Date(), recordCount: records.length, status: 'success' },
  })

  console.log(`Synced ${records.length} sequence enrollments`)
  return records.length
}
