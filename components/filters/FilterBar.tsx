'use client'

import { useState, useEffect } from 'react'
import { Filter, User, Building2, Stethoscope, ChevronDown, ChevronUp } from 'lucide-react'

export interface FilterState {
  startDate: string
  endDate: string
  ownerIds: string[]
  specialties: string[]
  companyTypes: string[]
  leadStatuses: string[]
  dealStatuses: string[]
  includeRemoved: boolean
  tier1Only: boolean
  locationFilter: 'all' | 'us' | 'international'
  preset: '7d' | '30d' | '60d' | '90d' | 'custom'
}

interface FilterOption {
  id: string
  name: string
}

interface FilterBarProps {
  onFilterChange: (filters: FilterState) => void
}

function getPresetDates(preset: FilterState['preset']): { start: string; end: string } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()

  const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '60d': 60, '90d': 90 }
  if (preset in daysMap) {
    start.setDate(start.getDate() - daysMap[preset])
    start.setHours(0, 0, 0, 0)
  }

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export default function FilterBar({ onFilterChange }: FilterBarProps) {
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [collapsed, setCollapsed] = useState(true)

  const [preset, setPreset] = useState<FilterState['preset']>('30d')
  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)
  const [selectedOwners, setSelectedOwners] = useState<string[]>([])
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const [selectedCompanyTypes, setSelectedCompanyTypes] = useState<string[]>(['Private Practice'])
  const [selectedLeadStatuses, setSelectedLeadStatuses] = useState<string[]>(['NEW', 'OPEN', 'CONNECTED', 'IN_PROGRESS', 'OPEN_DEAL', 'Closed and Nurturing'])
  const [selectedDealStatuses, setSelectedDealStatuses] = useState<string[]>(['Closed LOST', 'Closed PASS', 'Closed Won'])

  const [includeRemoved, setIncludeRemoved] = useState(false)
  const [tier1Only, setTier1Only] = useState(false)
  const [locationFilter, setLocationFilter] = useState<FilterState['locationFilter']>('us')

  const [owners, setOwners] = useState<FilterOption[]>([])
  const [specialties, setSpecialties] = useState<string[]>([])
  const [companyTypes, setCompanyTypes] = useState<string[]>([])
  const [leadStatuses, setLeadStatuses] = useState<string[]>([])
  const [dealStatuses, setDealStatuses] = useState<string[]>([])

  const [loadingFilters, setLoadingFilters] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/filters')
      .then((r) => r.json())
      .then((data) => {
        setOwners(data.owners ?? [])
        setSpecialties(data.specialties ?? [])
        setCompanyTypes(data.companyTypes ?? [])
        setLeadStatuses(data.leadStatuses ?? [])
        setDealStatuses(data.dealStatuses ?? [])
      })
      .catch(console.error)
      .finally(() => setLoadingFilters(false))
  }, [])

  useEffect(() => {
    onFilterChange({
      startDate,
      endDate,
      ownerIds: selectedOwners,
      specialties: selectedSpecialties,
      companyTypes: selectedCompanyTypes,
      leadStatuses: selectedLeadStatuses,
      dealStatuses: selectedDealStatuses,
      includeRemoved,
      tier1Only,
      locationFilter,
      preset,
    })
  }, [startDate, endDate, selectedOwners, selectedSpecialties, selectedCompanyTypes, selectedLeadStatuses, selectedDealStatuses, includeRemoved, tier1Only, locationFilter, preset]) // eslint-disable-line

  function handlePreset(p: FilterState['preset']) {
    setPreset(p)
    if (p !== 'custom') {
      const { start, end } = getPresetDates(p)
      setStartDate(start)
      setEndDate(end)
    }
  }

  function toggleMultiSelect(
    value: string,
    current: string[],
    setter: (v: string[]) => void
  ) {
    setter(current.includes(value) ? current.filter((v) => v !== value) : [...current, value])
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <button onClick={() => setCollapsed(c => !c)} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-bold text-gray-700">Dashboard Filters</span>
          {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </button>
        
        <div className="flex flex-wrap gap-2 items-center">
          {(['7d', '30d', '60d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                preset === p
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
              }`}
            >
              Last {p.replace('d', '')} days
            </button>
          ))}
          <button
            onClick={() => handlePreset('custom')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              preset === 'custom'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
            }`}
          >
            Custom
          </button>
          
          {preset === 'custom' && (
            <div className="flex items-center gap-2 ml-2 bg-white p-1 rounded-lg border border-gray-200">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs border-none focus:ring-0 p-0"
              />
              <span className="text-gray-400">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs border-none focus:ring-0 p-0"
              />
            </div>
          )}
        </div>
      </div>

      {!collapsed && <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
        {/* BD Directors */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <User className="w-3.5 h-3.5 text-blue-500" />
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">BD Director</label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {owners.map((o) => (
              <button
                key={o.id}
                onClick={() => toggleMultiSelect(o.id, selectedOwners, setSelectedOwners)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
                  selectedOwners.includes(o.id)
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-200'
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </section>

        {/* Specialty */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="w-3.5 h-3.5 text-purple-500" />
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Specialty</label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {specialties.map((s) => (
              <button
                key={s}
                onClick={() => toggleMultiSelect(s, selectedSpecialties, setSelectedSpecialties)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
                  selectedSpecialties.includes(s)
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-purple-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Company Type */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-3.5 h-3.5 text-green-500" />
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Company Type</label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {companyTypes.map((ct) => (
              <button
                key={ct}
                onClick={() => toggleMultiSelect(ct, selectedCompanyTypes, setSelectedCompanyTypes)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
                  selectedCompanyTypes.includes(ct)
                    ? 'bg-green-600 text-white border-green-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-200'
                }`}
              >
                {ct}
              </button>
            ))}
            {companyTypes.length === 0 && !loadingFilters && (
              <span className="text-xs text-gray-400 italic">No types found</span>
            )}
          </div>
        </section>

        {/* Lead Status */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-3.5 h-3.5 text-sky-500" />
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lead Status</label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {leadStatuses.map((s) => (
              <button
                key={s}
                onClick={() => toggleMultiSelect(s, selectedLeadStatuses, setSelectedLeadStatuses)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
                  selectedLeadStatuses.includes(s)
                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-sky-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Deal Status */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-3.5 h-3.5 text-violet-500" />
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Exclude Deal Status</label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dealStatuses.map((s) => (
              <button
                key={s}
                onClick={() => toggleMultiSelect(s, selectedDealStatuses, setSelectedDealStatuses)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
                  selectedDealStatuses.includes(s)
                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-violet-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      </div>}

      {!collapsed && <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={tier1Only}
                onChange={(e) => setTier1Only(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-yellow-500"></div>
            </label>
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Tier 1 Targets</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includeRemoved}
                onChange={(e) => setIncludeRemoved(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Incl. Removed</span>
          </div>

          <div className="flex items-center gap-1">
            {(['all', 'us', 'international'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setLocationFilter(opt)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
                  locationFilter === opt
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-teal-200'
                }`}
              >
                {opt === 'all' ? 'All Locations' : opt === 'us' ? '🇺🇸 US Only' : '🌐 International'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            setSelectedOwners([])
            setSelectedSpecialties([])
            setSelectedCompanyTypes(['Private Practice'])
            setSelectedLeadStatuses(['NEW', 'OPEN', 'CONNECTED', 'IN_PROGRESS', 'OPEN_DEAL', 'Closed and Nurturing'])
            setSelectedDealStatuses(['Closed LOST', 'Closed PASS', 'Closed Won'])
            setTier1Only(false)
            setIncludeRemoved(false)
            setLocationFilter('us')
          }}
          className="text-[11px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest transition-colors"
        >
          Reset All Filters
        </button>
      </div>}
    </div>
  )
}
