'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Search, X } from 'lucide-react'
import FilterBar, { FilterState } from '@/components/filters/FilterBar'
import ContactModal, { type ModalContact } from '@/components/ui/ContactModal'
import type { MapContact, AdgLocation } from '@/components/ui/LeafletMap'

const LeafletMap = dynamic(() => import('@/components/ui/LeafletMap'), { ssr: false })

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

type MapData = {
  matched: MapContact[]
  unmatched: any[]
  total: number
  matchedCount: number
  unmatchedCount: number
  adgLocations: AdgLocation[]
}

export default function MapPage() {
  const [filters, setFilters] = useState<FilterState | null>(null)
  const [data, setData] = useState<MapData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeDispositions, setActiveDispositions] = useState<Set<string>>(
    new Set(['interested', 'fairGame', 'notNow', 'notInterested'])
  )
  const [showAdg, setShowAdg] = useState(true)

  // Modal
  const [selectedContact, setSelectedContact] = useState<ModalContact | null>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MapContact[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (f: FilterState) => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (f.ownerIds.length) qs.set('ownerIds', f.ownerIds.join(','))
    if (f.tier1Only) qs.set('tier1Only', 'true')
    if (f.specialties.length) qs.set('specialties', f.specialties.join(','))
    if (f.companyTypes.length) qs.set('companyTypes', f.companyTypes.join(','))
    if (f.leadStatuses.length) qs.set('leadStatuses', f.leadStatuses.join(','))
    if (f.dealStatuses.length) qs.set('dealStatuses', f.dealStatuses.join(','))
    if (!f.includeRemoved) qs.set('includeRemoved', 'false')
    if (f.locationFilter !== 'all') qs.set('locationFilter', f.locationFilter)
    try {
      const res = await fetch(`/api/dashboard/map?${qs.toString()}`)
      setData(await res.json())
    } catch {
      console.error('Failed to load map data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (filters) fetchData(filters)
  }, [filters, fetchData])

  // Search filtering
  useEffect(() => {
    if (!searchQuery.trim() || !data) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    const q = searchQuery.toLowerCase()
    const results = data.matched
      .filter(c => c.name.toLowerCase().includes(q))
      .slice(0, 10)
    setSearchResults(results)
    setShowDropdown(results.length > 0)
  }, [searchQuery, data])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSearchSelect(contact: MapContact) {
    setSearchQuery(contact.name)
    setShowDropdown(false)
    setFlyTo({ lat: contact.latitude, lng: contact.longitude })
    setSelectedContact({
      contactId: contact.contactId,
      name: contact.name,
      specialty: contact.specialty,
      ownerName: contact.ownerName,
      disposition: contact.disposition,
      clinic: contact.clinic,
      city: null,
      state: null,
    })
  }

  function handlePinClick(contact: MapContact) {
    setSelectedContact({
      contactId: contact.contactId,
      name: contact.name,
      specialty: contact.specialty,
      ownerName: contact.ownerName,
      disposition: contact.disposition,
      clinic: contact.clinic,
      city: null,
      state: null,
    })
  }

  function toggleDisposition(key: string) {
    setActiveDispositions(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const visibleContacts = data?.matched.filter(c => activeDispositions.has(c.disposition)) ?? []
  const counts = data?.matched.reduce<Record<string, number>>((acc, c) => {
    acc[c.disposition] = (acc[c.disposition] ?? 0) + 1
    return acc
  }, {}) ?? {}

  return (
    <div className="space-y-6">
      {/* Contact modal */}
      {selectedContact && (
        <ContactModal contact={selectedContact} onClose={() => setSelectedContact(null)} />
      )}

      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Addressable Universe Map</h2>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
          Practice locations cross-referenced with HubSpot contacts
        </p>
      </div>

      <FilterBar onFilterChange={setFilters} showDateFilter={false} />

      {/* Stats row */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Universe</div>
            <div className="text-2xl font-black text-gray-900 mt-1">{data.total}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              <span className="text-green-600 font-bold">{data.matchedCount} mapped</span>
              {' · '}
              <span className="text-gray-400">{data.unmatchedCount} no loc</span>
            </div>
          </div>

          <button
            onClick={() => setShowAdg(s => !s)}
            className={`bg-white border-2 rounded-xl p-4 shadow-sm text-left transition-all ${showAdg ? 'opacity-100' : 'opacity-40'}`}
            style={{ borderColor: showAdg ? '#7c3aed' : '#e5e7eb' }}
          >
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#7c3aed' }}>ADG / AOSN</div>
            <div className="text-2xl font-black text-gray-900 mt-1">{data.adgLocations.length}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">click to toggle</div>
          </button>

          {Object.entries(DISPOSITION_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleDisposition(key)}
              className={`bg-white border-2 rounded-xl p-4 shadow-sm text-left transition-all ${
                activeDispositions.has(key) ? 'opacity-100' : 'opacity-40'
              }`}
              style={{ borderColor: activeDispositions.has(key) ? DISPOSITION_COLORS[key] : '#e5e7eb' }}
            >
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: DISPOSITION_COLORS[key] }}>
                {label}
              </div>
              <div className="text-2xl font-black text-gray-900 mt-1">{counts[key] ?? 0}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">click to toggle</div>
            </button>
          ))}
        </div>
      )}

      {/* Search bar — outside the map card to avoid Leaflet z-index conflicts */}
      <div className="flex items-center gap-4">
        <div ref={searchRef} className="relative w-80">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search doctor by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              className="flex-1 text-sm font-medium text-gray-700 placeholder-gray-400 outline-none bg-transparent"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setShowDropdown(false) }}>
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* Dropdown — outside map, no z-index fight */}
          {showDropdown && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden" style={{ zIndex: 9999 }}>
              {searchResults.map(c => (
                <button
                  key={c.contactId}
                  onClick={() => handleSearchSelect(c)}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                >
                  <div>
                    <div className="text-sm font-bold text-gray-900">{c.name}</div>
                    <div className="text-[11px] text-gray-400">{c.specialty ?? '—'} · {c.ownerName}</div>
                  </div>
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ml-2"
                    style={{
                      backgroundColor: DISPOSITION_COLORS[c.disposition] + '20',
                      color: DISPOSITION_COLORS[c.disposition],
                    }}
                  >
                    {DISPOSITION_LABELS[c.disposition]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap">
          {Object.entries(DISPOSITION_LABELS).map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <span className="inline-block w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: DISPOSITION_COLORS[key] }} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#7c3aed' }}>
            <span className="inline-block w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: '#7c3aed' }} />
            ADG / AOSN
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">larger = Tier 1</span>
        </div>
      </div>

      {/* Map card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Map */}
        <div style={{ height: 580 }}>
          {!data && !loading && (
            <div className="flex items-center justify-center h-full text-gray-400 font-bold uppercase tracking-widest text-sm">
              Apply filters to load map
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center h-full text-gray-400 font-bold uppercase tracking-widest text-sm animate-pulse">
              Loading map data...
            </div>
          )}
          {data && !loading && (
            <LeafletMap
              contacts={visibleContacts}
              adgLocations={data.adgLocations}
              showAdg={showAdg}
              flyTo={flyTo}
              onContactClick={handlePinClick}
            />
          )}
        </div>
      </div> {/* end map card */}

      {/* Unmatched contacts */}
      {data && data.unmatched.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="text-sm font-black text-gray-900 uppercase tracking-tight">Not in Location Database</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{data.unmatched.length} contacts with no location match</div>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {data.unmatched.map(c => (
              <div key={c.contactId} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-gray-900">{c.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{c.specialty ?? '—'}</span>
                  {c.city && <span className="text-xs text-gray-400 ml-2">{c.city}, {c.state}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: DISPOSITION_COLORS[c.disposition] + '20',
                      color: DISPOSITION_COLORS[c.disposition],
                    }}
                  >
                    {DISPOSITION_LABELS[c.disposition]}
                  </span>
                  <span className="text-[10px] text-gray-400">{c.ownerName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
