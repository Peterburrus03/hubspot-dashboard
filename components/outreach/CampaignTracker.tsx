'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Megaphone, Calendar, User } from 'lucide-react'
import type { FilterState } from '@/components/filters/FilterBar'

type CampaignResult = {
  id: string
  label: string
  tag: string
  startDate: string
  endDate: string
  total: number
  byOwner: { ownerId: string; ownerName: string; count: number }[]
}

function buildQS(f: FilterState): string {
  const qs = new URLSearchParams()
  if (f.ownerIds.length) qs.set('ownerIds', f.ownerIds.join(','))
  if (f.tier1Only) qs.set('tier1Only', 'true')
  if (f.specialties.length) qs.set('specialties', f.specialties.join(','))
  if (f.companyTypes.length) qs.set('companyTypes', f.companyTypes.join(','))
  if (!f.includeRemoved) qs.set('includeRemoved', 'false')
  if (f.locationFilter !== 'all') qs.set('locationFilter', f.locationFilter)
  return qs.toString()
}

function formatRange(start: string, end: string): string {
  const fmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const s = new Date(start + 'T00:00:00').toLocaleDateString('en-US', fmt)
  const e = new Date(end + 'T00:00:00').toLocaleDateString('en-US', fmt)
  return `${s} – ${e}`
}

export default function CampaignTracker({ filters }: { filters: FilterState | null }) {
  const [open, setOpen] = useState(true)
  const [campaigns, setCampaigns] = useState<CampaignResult[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!filters) return
    setLoading(true)
    fetch(`/api/dashboard/campaigns?${buildQS(filters)}`)
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false))
  }, [filters])

  const total = campaigns?.reduce((s, c) => s + c.total, 0) ?? 0

  return (
    <div className="bg-white border-2 border-gray-100 rounded-xl shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50">
            <Megaphone className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Campaign Tracker</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-0.5">
              {campaigns?.length ?? 0} campaign{campaigns?.length === 1 ? '' : 's'} · {total} touch{total === 1 ? '' : 'es'} logged
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-gray-100">
          {loading && !campaigns && (
            <p className="text-center text-sm text-gray-400 font-bold uppercase tracking-widest py-6">Loading…</p>
          )}
          {campaigns && campaigns.length === 0 && !loading && (
            <p className="text-center text-sm text-gray-400 font-bold uppercase tracking-widest py-6">No campaigns configured.</p>
          )}
          {campaigns?.map((c) => (
            <div key={c.id} className="border-2 border-gray-100 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h4 className="font-black text-gray-900 uppercase tracking-tight">{c.label}</h4>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      <Calendar className="w-3 h-3" />{formatRange(c.startDate, c.endDate)}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
                      Tag {c.tag}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-3xl font-black text-indigo-600 leading-none">{c.total}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Touches</div>
                </div>
              </div>
              {c.byOwner.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                  {c.byOwner.map((o) => (
                    <div key={o.ownerId} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                      <span className="flex items-center gap-1.5 text-gray-700 font-bold truncate">
                        <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{o.ownerName}</span>
                      </span>
                      <span className="font-black text-indigo-600 ml-2">{o.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest text-center py-2">No touches yet for current filters.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
