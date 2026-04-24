'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { MapPin, Search, X, Check, Clock, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import type { MapContact } from '@/components/ui/LeafletMap'
import type { ModalContact } from '@/components/ui/ContactModal'

type CheckInRecord = {
  timestamp: string
  responded: boolean
  respondedAt: string | null
}
type CheckInStats = {
  count: number
  lastCheckInAt: string
  respondedCount: number
  awaitingCount: number
  tasks: CheckInRecord[]
}

const DISPOSITION_COLORS: Record<string, string> = {
  interested:    '#16a34a',
  fairGame:      '#0284c7',
  notNow:        '#d97706',
  notInterested: '#dc2626',
}
const DISPOSITION_LABELS: Record<string, string> = {
  interested:    'Interested',
  fairGame:      'Fair Game',
  notNow:        'Not Now',
  notInterested: 'Not Interested',
}

export default function InTownSection({ matched, onContactClick }: {
  matched: MapContact[]
  onContactClick: (c: ModalContact) => void
}) {
  const [query, setQuery] = useState('')
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [checkIns, setCheckIns] = useState<Record<string, CheckInStats>>({})
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Unique markets with matched-contact counts
  const markets = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of matched) {
      if (!c.market) continue
      counts.set(c.market, (counts.get(c.market) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([market, count]) => ({ market, count }))
      .sort((a, b) => a.market.localeCompare(b.market))
  }, [matched])

  // Per-MSA breakdown by lead-status bucket (matches Game Plan categories)
  const marketRankings = useMemo(() => {
    const byMarket = new Map<string, { openDeal: number; initialOutreach: number; closedNurture: number; total: number }>()
    for (const c of matched) {
      if (!c.market) continue
      const row = byMarket.get(c.market) ?? { openDeal: 0, initialOutreach: 0, closedNurture: 0, total: 0 }
      const ls = c.leadStatus ?? ''
      if (ls === 'OPEN_DEAL') row.openDeal++
      else if (ls === 'OPEN' || ls === 'NEW' || ls === 'CONNECTED') row.initialOutreach++
      else if (ls === 'Closed and Nurturing') row.closedNurture++
      row.total = row.openDeal + row.initialOutreach + row.closedNurture
      byMarket.set(c.market, row)
    }
    return Array.from(byMarket.entries())
      .map(([market, r]) => ({ market, ...r }))
      .filter(r => r.total >= 2)
      .sort((a, b) => b.total - a.total || a.market.localeCompare(b.market))
  }, [matched])

  const filteredMarkets = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return markets
    return markets.filter(m => m.market.toLowerCase().includes(q))
  }, [markets, query])

  // Contacts in the selected market
  const marketContacts = useMemo(() => {
    if (!selectedMarket) return []
    return matched
      .filter(c => c.market === selectedMarket)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [matched, selectedMarket])

  // Fetch check-in stats when market changes
  useEffect(() => {
    if (!selectedMarket || marketContacts.length === 0) {
      setCheckIns({})
      return
    }
    setLoading(true)
    const contactIds = marketContacts.map(c => c.contactId)
    fetch('/api/dashboard/in-town', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds }),
    })
      .then(r => r.json())
      .then(d => setCheckIns(d.checkIns ?? {}))
      .catch(() => setCheckIns({}))
      .finally(() => setLoading(false))
  }, [selectedMarket, marketContacts])

  // Outside-click to close dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const totalCheckIns = Object.values(checkIns).reduce((s, c) => s + c.count, 0)
  const totalResponded = Object.values(checkIns).reduce((s, c) => s + c.respondedCount, 0)

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
        <div className="p-2 bg-sky-100 rounded-lg">
          <MapPin className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <div className="text-sm font-black text-gray-900 uppercase tracking-tight">I'm In Town</div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            MSA check-in tracker · Task prefix <span className="font-mono font-bold text-sky-600">08</span> · Response window 5 days
          </div>
        </div>
      </div>

      {/* MSA picker */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-4 flex-wrap">
        <div ref={dropdownRef} className="relative w-96">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm focus-within:border-sky-400 focus-within:ring-1 focus-within:ring-sky-100 transition-all">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search MSAs..."
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              className="flex-1 text-sm font-medium text-gray-700 placeholder-gray-400 outline-none bg-transparent"
            />
            {query && (
              <button onClick={() => { setQuery(''); setShowDropdown(false) }}>
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {showDropdown && filteredMarkets.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto" style={{ zIndex: 50 }}>
              {filteredMarkets.map(m => (
                <button
                  key={m.market}
                  onClick={() => {
                    setSelectedMarket(m.market)
                    setQuery(m.market)
                    setShowDropdown(false)
                  }}
                  className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-sky-50 transition-colors text-left border-b border-gray-50 last:border-0 ${selectedMarket === m.market ? 'bg-sky-50' : ''}`}
                >
                  <span className="text-sm font-medium text-gray-900 truncate pr-2">{m.market}</span>
                  <span className="text-[10px] font-black text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">{m.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedMarket && (
          <>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              <span className="text-gray-900 font-black">{marketContacts.length}</span> contacts
              {' · '}
              <span className="text-sky-600 font-black">{totalCheckIns}</span> check-ins
              {' · '}
              <span className="text-emerald-600 font-black">{totalResponded}</span> responded
            </div>
            <button
              onClick={() => { setSelectedMarket(null); setQuery(''); setCheckIns({}) }}
              className="text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {/* MSA rankings (shown when no market selected) */}
      {!selectedMarket && marketRankings.length === 0 && (
        <div className="px-4 py-10 text-center text-sm font-bold text-gray-400 uppercase tracking-widest">
          No MSAs with 2 or more matched practices
        </div>
      )}

      {!selectedMarket && marketRankings.length > 0 && (
        <div className="overflow-x-auto">
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/30">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              Top MSAs · <span className="text-gray-900">{marketRankings.length}</span> markets with 2 or more practices
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-2">MSA</th>
                <th className="text-right px-4 py-2">Open Deal</th>
                <th className="text-right px-4 py-2">Initial Outreach</th>
                <th className="text-right px-4 py-2">Closed Nurture</th>
                <th className="text-right px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {marketRankings.map(r => (
                <tr
                  key={r.market}
                  onClick={() => { setSelectedMarket(r.market); setQuery(r.market); setShowDropdown(false) }}
                  className="hover:bg-sky-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2 text-sm font-bold text-gray-900">{r.market}</td>
                  <td className="px-4 py-2 text-right">
                    {r.openDeal > 0 ? (
                      <span className="text-sm font-black text-emerald-700">{r.openDeal}</span>
                    ) : (
                      <span className="text-[10px] text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.initialOutreach > 0 ? (
                      <span className="text-sm font-black text-sky-700">{r.initialOutreach}</span>
                    ) : (
                      <span className="text-[10px] text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.closedNurture > 0 ? (
                      <span className="text-sm font-black text-amber-700">{r.closedNurture}</span>
                    ) : (
                      <span className="text-[10px] text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="text-sm font-black text-gray-900 bg-gray-100 rounded-full px-2 py-0.5">{r.total}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedMarket && (
        <div className="overflow-x-auto">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/30 flex items-center justify-between">
            <button
              onClick={() => { setSelectedMarket(null); setQuery(''); setCheckIns({}) }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 uppercase tracking-widest transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to All MSAs
            </button>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-700">
              {selectedMarket}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-2">Contact</th>
                <th className="text-left px-4 py-2">Clinic</th>
                <th className="text-left px-4 py-2">Owner</th>
                <th className="text-left px-4 py-2">Disposition</th>
                <th className="text-right px-4 py-2">Check-ins</th>
                <th className="text-left px-4 py-2">Last Check-in</th>
                <th className="text-left px-4 py-2">Response (5d)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {marketContacts.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-xs uppercase tracking-widest font-bold">No matched contacts in this MSA</td></tr>
              )}
              {marketContacts.map(c => {
                const stats = checkIns[c.contactId]
                const hasCheckIn = !!stats && stats.count > 0
                return (
                  <tr key={c.contactId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2">
                      <button
                        onClick={() => onContactClick({
                          contactId: c.contactId,
                          name: c.name,
                          specialty: c.specialty,
                          ownerName: c.ownerName,
                          disposition: c.disposition,
                          clinic: c.clinic,
                          city: null,
                          state: null,
                        })}
                        className="text-left"
                      >
                        <div className="text-sm font-bold text-gray-900 hover:text-sky-600 transition-colors">{c.name}</div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-tight">{c.specialty ?? '—'}</div>
                      </button>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">{c.clinic ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{c.ownerName}</td>
                    <td className="px-4 py-2">
                      <span
                        className="text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: DISPOSITION_COLORS[c.disposition] + '20',
                          color: DISPOSITION_COLORS[c.disposition],
                        }}
                      >
                        {DISPOSITION_LABELS[c.disposition]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {loading ? (
                        <span className="text-[10px] text-gray-300 animate-pulse">…</span>
                      ) : hasCheckIn ? (
                        <span className="text-sm font-black text-gray-900">{stats.count}</span>
                      ) : (
                        <span className="text-[10px] text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {hasCheckIn ? format(new Date(stats.lastCheckInAt), 'MMM d, yyyy') : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {!hasCheckIn ? (
                        <span className="text-[10px] text-gray-300">—</span>
                      ) : stats.respondedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                          <Check className="w-3 h-3" />
                          {stats.respondedCount} / {stats.count}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                          <Clock className="w-3 h-3" />
                          Awaiting · {stats.awaitingCount}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
