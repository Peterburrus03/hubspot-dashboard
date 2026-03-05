'use client'

import { useState, useCallback, useEffect } from 'react'
import FilterBar, { FilterState } from '@/components/filters/FilterBar'
import { Card } from '@/components/ui/Card'
import { AlertCircle, Calendar, Gift, User, Users, ArrowRight, Clock, MapPin } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function FunnelPage() {
  const [filters, setFilters] = useState<FilterState | null>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  const fetchData = useCallback(async (f: FilterState) => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (f.ownerIds.length) qs.set('ownerIds', f.ownerIds.join(','))
    
    try {
      const res = await fetch(`/api/dashboard/gameplan?${qs.toString()}`)
      const d = await res.json()
      setData(d)
    } catch (err) {
      console.error('Failed to load game plan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (filters) fetchData(filters)
  }, [filters, fetchData])

  if (loading && !data) return <div className="p-8 text-center text-gray-500 animate-pulse font-bold uppercase tracking-widest">Building Top of Funnel Game Plan...</div>

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic">BD Game Plan</h2>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Strategic Priorities & Follow-up Triggers</p>
      </div>

      <FilterBar onFilterChange={setFilters} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* CRITICAL: Stale Tier 1 Targets */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <div className="p-2 bg-rose-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Stale Tier 1 Targets</h3>
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">No outreach in over 4 weeks</p>
            </div>
          </div>

          <div className="space-y-3">
            {data?.staleTier1s.map((c: any) => (
              <div key={c.contactId} className="bg-white border-2 border-rose-50 rounded-xl p-4 shadow-sm hover:border-rose-200 transition-all flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center font-black text-rose-600">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{c.name}</h4>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                        <User className="w-3 h-3" /> {c.ownerName}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-black text-rose-400 uppercase tracking-tighter">
                        <Clock className="w-3 h-3" /> Last: {c.lastActivity ? formatDistanceToNow(new Date(c.lastActivity)) + ' ago' : 'NEVER'}
                      </span>
                    </div>
                  </div>
                </div>
                <button className="p-2 bg-gray-50 rounded-lg text-gray-400 hover:bg-rose-600 hover:text-white transition-all">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
            {data?.staleTier1s.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-sm font-bold text-gray-400 uppercase">All Tier 1 Targets are up to date!</p>
              </div>
            )}
          </div>
        </section>

        {/* TRIGGER: Recent High-Impact Actions */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Gift className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Action Triggers</h3>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Follow up on recent gifts/events</p>
            </div>
          </div>

          <div className="space-y-3">
            {data?.actionableTriggers.map((t: any, i: number) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black uppercase rounded tracking-widest">
                      {t.trigger} detected
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                      {formatDistanceToNow(new Date(t.timestamp))} ago
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">{t.ownerName}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-gray-900">{t.contactName}</h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed bg-gray-50 p-2 rounded italic">
                      &ldquo;{t.body}&rdquo;
                    </p>
                  </div>
                  <button className="mt-1 shrink-0 p-2 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {data?.actionableTriggers.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-sm font-bold text-gray-400 uppercase">No recent follow-up triggers detected.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* RECENT ENROLLMENTS */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Sequence Momentum</h3>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Recently enrolled contacts (Last 7 Days)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.recentEnrollments.map((e: any, i: number) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase tracking-tighter">
                  {e.sequenceName}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                  {formatDistanceToNow(new Date(e.enrolledAt))} ago
                </span>
              </div>
              <h4 className="font-bold text-gray-900">{e.contactName}</h4>
              <p className="text-[10px] font-medium text-gray-500 uppercase mt-1">Director: {e.ownerName}</p>
            </div>
          ))}
          {data?.recentEnrollments.length === 0 && (
            <div className="col-span-full text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-xs font-bold text-gray-400 uppercase">No new enrollments this week.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
