'use client'

import { useState, useCallback, useEffect } from 'react'
import FilterBar, { FilterState } from '@/components/filters/FilterBar'
import SummaryStats from '@/components/kpis/SummaryStats'
import ActivityByOwner from '@/components/charts/ActivityByOwner'
import SequencePerformance from '@/components/charts/SequencePerformance'
import LeadStatusBreakdown from '@/components/charts/LeadStatusBreakdown'
import ActivityTable from '@/components/tables/ActivityTable'
import type { ActivitySummary } from '@/types/hubspot'

function buildParams(filters: FilterState): string {
  const p = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    includeRemoved: String(filters.includeRemoved),
    tier1Only: String(filters.tier1Only),
  })
  if (filters.ownerIds.length) p.set('ownerIds', filters.ownerIds.join(','))
  if (filters.specialties.length) p.set('specialties', filters.specialties.join(','))
  if (filters.companyTypes.length) p.set('companyTypes', filters.companyTypes.join(','))
  return p.toString()
}

interface SyncStatus {
  lastSync: string | null
  syncing: boolean
  error: string | null
}

export default function ActivityDashboard() {
  const [filters, setFilters] = useState<FilterState | null>(null)

  const [activityData, setActivityData] = useState<{
    summary: ActivitySummary | null
    byOwner: any[]
  }>({ summary: null, byOwner: [] })
  const [sequenceData, setSequenceData] = useState<{ sequences: any[] }>({ sequences: [] })
  const [leadStatusData, setLeadStatusData] = useState<{
    byStatus: any[]
    totalContacts: number
  }>({ byStatus: [], totalContacts: 0 })

  const [loadingActivity, setLoadingActivity] = useState(false)
  const [loadingSequences, setLoadingSequences] = useState(false)
  const [loadingLeadStatus, setLoadingLeadStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: null,
    syncing: false,
    error: null,
  })

  // Load sync status on mount
  useEffect(() => {
    fetch('/api/dashboard/sync')
      .then((r) => r.json())
      .then((data) => {
        const emailMeta = (data.syncStatus ?? []).find(
          (m: any) => m.cacheKey === 'engagements_emails'
        )
        setSyncStatus((s) => ({
          ...s,
          lastSync: emailMeta?.lastRefresh ?? null,
        }))
      })
      .catch(() => {})
  }, [])

  const fetchData = useCallback(
    async (f: FilterState) => {
      const qs = buildParams(f)
      setError(null)

      setLoadingActivity(true)
      setLoadingSequences(true)
      setLoadingLeadStatus(true)

      // Fetch all three in parallel
      const [actRes, seqRes, lsRes] = await Promise.allSettled([
        fetch(`/api/dashboard/activity?${qs}`).then((r) => r.json()),
        fetch(`/api/dashboard/sequences?${qs}`).then((r) => r.json()),
        fetch(`/api/dashboard/lead-status?${qs}`).then((r) => r.json()),
      ])

      if (actRes.status === 'fulfilled') {
        if (actRes.value.error) setError(actRes.value.error)
        else setActivityData(actRes.value)
      } else {
        setError('Failed to load activity data')
      }
      setLoadingActivity(false)

      if (seqRes.status === 'fulfilled') {
        if (seqRes.value.error) console.error('Sequences API error:', seqRes.value.error)
        else setSequenceData(seqRes.value)
      }
      setLoadingSequences(false)

      if (lsRes.status === 'fulfilled') {
        if (lsRes.value.error) console.error('Lead Status API error:', lsRes.value.error)
        else setLeadStatusData(lsRes.value)
      }
      setLoadingLeadStatus(false)
    },
    []
  )

  const handleFilterChange = useCallback(
    (f: FilterState) => {
      setFilters(f)
      fetchData(f)
    },
    [fetchData]
  )

  async function handleSync(fullRefresh = false) {
    setSyncStatus((s) => ({ ...s, syncing: true, error: null }))

    // Run sequentially in 3 steps so no single request times out
    const steps: Array<{ step: string; label: string }> = [
      { step: 'contacts', label: 'contacts & owners' },
      { step: 'deals', label: 'deals' },
      { step: 'engagements', label: 'engagements' },
      { step: 'sequences', label: 'sequences' },
    ]

    for (const { step, label } of steps) {
      setSyncStatus((s) => ({ ...s, syncing: true, error: `Syncing ${label}…` }))
      try {
        const res = await fetch('/api/dashboard/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullRefresh, lookbackDays: 90, step }),
        })
        const data = await res.json()
        if (!data.success) {
          setSyncStatus((s) => ({ ...s, syncing: false, error: data.error }))
          return
        }
      } catch (err: any) {
        setSyncStatus((s) => ({ ...s, syncing: false, error: `${label}: ${err.message}` }))
        return
      }
    }

    setSyncStatus({ syncing: false, lastSync: new Date().toISOString(), error: null })
    if (filters) fetchData(filters)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Activity Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Engagement tracking by BD director across all contact records
          </p>
        </div>
        <div className="flex items-center gap-3">
          {syncStatus.lastSync && (
            <span className="text-xs text-gray-400">
              Last sync:{' '}
              {new Date(syncStatus.lastSync).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
          <button
            onClick={() => handleSync(false)}
            disabled={syncStatus.syncing}
            className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {syncStatus.syncing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {syncStatus.error ?? 'Syncing…'}
              </span>
            ) : (
              'Sync Now'
            )}
          </button>
          <button
            onClick={() => handleSync(true)}
            disabled={syncStatus.syncing}
            className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Full Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {(error || (syncStatus.error && !syncStatus.syncing)) && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
          <strong>Error:</strong> {error || syncStatus.error}
          {(error || '').includes('token') || (error || '').includes('auth') ? (
            <span> — Check that your HubSpot token is valid and has the required scopes.</span>
          ) : null}
        </div>
      )}

      {/* No-data hint */}
      {!loadingActivity && activityData.byOwner.length === 0 && !error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
          <strong>No data yet.</strong> Click <strong>Full Refresh</strong> to pull the last 90 days
          of activity from HubSpot. This runs once and takes a few minutes; subsequent syncs are
          faster.
        </div>
      )}

      {/* Filters */}
      <FilterBar onFilterChange={handleFilterChange} />

      {/* Summary stats */}
      <SummaryStats summary={activityData.summary} loading={loadingActivity} />

      {/* Activity by BD director */}
      <section>
        <ActivityByOwner data={activityData.byOwner} loading={loadingActivity} />
      </section>

      {/* Lead status breakdown */}
      <section>
        <LeadStatusBreakdown
          data={leadStatusData.byStatus}
          totalContacts={leadStatusData.totalContacts}
          loading={loadingLeadStatus}
        />
      </section>

      {/* Sequence performance */}
      <section>
        <SequencePerformance data={sequenceData.sequences} loading={loadingSequences} />
      </section>

      {/* Raw data table */}
      <section>
        <ActivityTable data={activityData.byOwner} loading={loadingActivity} />
      </section>
    </div>
  )
}
