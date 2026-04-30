'use client'

import { useState, useEffect, useCallback } from 'react'
import FilterBar, { FilterState } from '@/components/filters/FilterBar'
import ContactModal from '@/components/contacts/ContactModal'
import CampaignTracker from '@/components/outreach/CampaignTracker'
import { Clock, User, Check, Calendar, RefreshCw, Play, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDistanceToNow, format, addDays } from 'date-fns'

type Completion = {
  contacted: boolean
  meetingSet: boolean
  meetingDate: string | null
  meetingNotes: string | null
}

type WeekContact = {
  contactId: string
  name: string
  specialty: string | null
  ownerId: string | null
  ownerName: string
  tier1: boolean
  dealStatus: string | null
  status: string | null
  lastActivity: string | null
  outreachCount: number
  practiceType: string | null
  state: string | null
  completion: Completion
}

type WeekData = {
  initialized: boolean
  weekStart: string
  weeks: { 1: WeekContact[]; 2: WeekContact[]; 3: WeekContact[] } | null
}

const CANADIAN_PROVINCES = new Set([
  'AB', 'ON', 'NB', 'MB', 'BC', 'QC', 'SK', 'PE', 'NL', 'NS',
  'ab', 'on', 'nb', 'mb', 'bc', 'qc', 'sk', 'pe', 'nl', 'ns',
])

function applyFilters(contacts: WeekContact[], filters: FilterState): WeekContact[] {
  return contacts.filter(c => {
    if (filters.ownerIds.length && (!c.ownerId || !filters.ownerIds.includes(c.ownerId))) return false
    if (filters.tier1Only && !c.tier1) return false
    if (filters.specialties.length && (!c.specialty || !filters.specialties.includes(c.specialty))) return false
    if (filters.companyTypes.length && (!c.practiceType || !filters.companyTypes.includes(c.practiceType))) return false
    if (filters.leadStatuses.length && (!c.status || !filters.leadStatuses.includes(c.status))) return false
    if (!filters.includeRemoved && c.status === 'Requested Removal From List') return false
    if (filters.locationFilter === 'us' && c.state && CANADIAN_PROVINCES.has(c.state)) return false
    if (filters.locationFilter === 'international' && c.state && !CANADIAN_PROVINCES.has(c.state)) return false
    return true
  })
}

function weekDateRange(weekStart: string, offset: number): string {
  const start = addDays(new Date(weekStart), offset * 7)
  const end = addDays(start, 6)
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
}

function ContactCard({
  contact,
  completionOverride,
  onOpen,
  onCompletionChange,
}: {
  contact: WeekContact
  completionOverride: Completion
  onOpen: () => void
  onCompletionChange: (update: Partial<Completion> & { _save?: boolean }) => void
}) {
  const [meetingExpanded, setMeetingExpanded] = useState(completionOverride.meetingSet)
  const [meetingDate, setMeetingDate] = useState(
    completionOverride.meetingDate ? completionOverride.meetingDate.split('T')[0] : ''
  )
  const [meetingNotes, setMeetingNotes] = useState(completionOverride.meetingNotes ?? '')
  const [saving, setSaving] = useState(false)

  const c = completionOverride

  const borderClass = c.contacted
    ? 'border-green-300 bg-green-50/60'
    : contact.tier1
    ? 'border-amber-300 bg-amber-50/40'
    : 'border-gray-100'

  const handleContacted = (e: React.MouseEvent) => {
    e.stopPropagation()
    onCompletionChange({ contacted: !c.contacted })
  }

  const handleMeetingToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !c.meetingSet
    setMeetingExpanded(next)
    if (next && !meetingDate) setMeetingDate(new Date().toISOString().split('T')[0])
    onCompletionChange({ meetingSet: next })
  }

  const handleSaveMeeting = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSaving(true)
    await onCompletionChange({ meetingDate: meetingDate || null, meetingNotes: meetingNotes || null, _save: true })
    setSaving(false)
  }

  return (
    <div className={`border-2 rounded-xl shadow-sm transition-all ${borderClass}`}>
      <div
        onClick={onOpen}
        className="cursor-pointer hover:shadow-md transition-shadow p-4 rounded-t-xl"
      >
        <div className="flex items-start gap-4 pr-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${contact.tier1 ? 'bg-amber-100' : 'bg-gray-50'}`}>
            <User className={`w-5 h-5 ${contact.tier1 ? 'text-amber-500' : 'text-gray-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-bold text-gray-900 leading-tight">{contact.name}</h4>
              <span className="text-[10px] font-black text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">
                {contact.outreachCount}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
                <User className="w-3 h-3" />{contact.ownerName}
              </span>
              {contact.specialty && (
                <span className="text-[10px] text-gray-400 uppercase tracking-tight">{contact.specialty}</span>
              )}
              {contact.status && (
                <span className="text-[10px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-bold">{contact.status}</span>
              )}
              {contact.dealStatus && (
                <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-bold">{contact.dealStatus}</span>
              )}
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400">
                <Clock className="w-3 h-3" />
                {contact.lastActivity
                  ? formatDistanceToNow(new Date(contact.lastActivity), { addSuffix: true })
                  : 'Never contacted'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <button
          onClick={handleContacted}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition-colors ${
            c.contacted
              ? 'border-green-400 bg-green-100 text-green-700'
              : 'border-gray-200 bg-white text-gray-500 hover:border-green-300 hover:text-green-600'
          }`}
        >
          <Check className="w-3 h-3" />
          Contacted
        </button>
        <button
          onClick={handleMeetingToggle}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition-colors ${
            c.meetingSet
              ? 'border-blue-400 bg-blue-100 text-blue-700'
              : 'border-gray-200 bg-white text-gray-500 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          <Calendar className="w-3 h-3" />
          Meeting Set
          {meetingExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {c.meetingSet && c.meetingDate && (
          <span className="text-[10px] font-bold text-blue-500 ml-1">
            {format(new Date(c.meetingDate), 'MMM d')}
          </span>
        )}
      </div>

      {meetingExpanded && (
        <div
          className="mx-4 mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Meeting Details</p>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Date</label>
            <input
              type="date"
              value={meetingDate}
              onChange={e => setMeetingDate(e.target.value)}
              className="text-sm border border-blue-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Notes</label>
            <textarea
              value={meetingNotes}
              onChange={e => setMeetingNotes(e.target.value)}
              placeholder="Who's attending, agenda, next steps…"
              rows={3}
              className="w-full text-sm border border-blue-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveMeeting}
              disabled={saving}
              className="text-xs font-bold px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Details'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function WeekColumn({
  weekNum,
  label,
  dateRange,
  contacts,
  completions,
  accentColor,
  onOpen,
  onCompletionChange,
}: {
  weekNum: number
  label: string
  dateRange: string
  contacts: WeekContact[]
  completions: Record<string, Completion>
  accentColor: { icon: string; text: string; bg: string; border: string }
  onOpen: (c: WeekContact) => void
  onCompletionChange: (contactId: string, update: Partial<Completion> & { _save?: boolean }) => void
}) {
  const contacted = contacts.filter(c => (completions[c.contactId] ?? c.completion).contacted).length
  const meetings = contacts.filter(c => (completions[c.contactId] ?? c.completion).meetingSet).length

  return (
    <section className="space-y-4">
      <div className={`rounded-xl border-2 ${accentColor.border} ${accentColor.bg} p-4`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className={`w-5 h-5 ${accentColor.icon}`} />
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{label}</h3>
            <span className={`text-xs font-black rounded-full px-2 py-0.5 ${accentColor.text} ${accentColor.bg}`}>
              {contacts.length}
            </span>
          </div>
        </div>
        <p className={`text-[10px] font-black uppercase tracking-widest ${accentColor.text}`}>{dateRange}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-xs font-bold text-green-600">
            <Check className="w-3 h-3" />
            {contacted} / {contacts.length} contacted
          </span>
          {meetings > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-blue-600">
              <Calendar className="w-3 h-3" />
              {meetings} meeting{meetings !== 1 ? 's' : ''} set
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {contacts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No contacts.</p>
          </div>
        ) : (
          contacts.map(c => (
            <ContactCard
              key={c.contactId}
              contact={c}
              completionOverride={completions[c.contactId] ?? c.completion}
              onOpen={() => onOpen(c)}
              onCompletionChange={update => onCompletionChange(c.contactId, update)}
            />
          ))
        )}
      </div>
    </section>
  )
}

export default function OutreachGoalsPage() {
  const [filters, setFilters] = useState<FilterState | null>(null)
  const [weekData, setWeekData] = useState<WeekData | null>(null)
  const [completions, setCompletions] = useState<Record<string, Completion>>({})
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [selectedContact, setSelectedContact] = useState<WeekContact | null>(null)

  const fetchWeekData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/outreach-week')
      const d: WeekData = await res.json()
      setWeekData(d)
      if (d.weeks) {
        const map: Record<string, Completion> = {}
        for (const week of [1, 2, 3] as const) {
          for (const c of d.weeks[week]) map[c.contactId] = c.completion
        }
        setCompletions(map)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWeekData() }, [fetchWeekData])

  const initWeek = async (rebuild = false) => {
    setInitializing(true)
    try {
      if (rebuild) await fetch('/api/dashboard/outreach-week', { method: 'DELETE' })
      await fetch('/api/dashboard/outreach-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: filters ? {
            ownerIds: filters.ownerIds,
            companyTypes: filters.companyTypes,
            locationFilter: filters.locationFilter,
          } : undefined,
        }),
      })
      await fetchWeekData()
    } finally {
      setInitializing(false)
    }
  }

  const handleCompletionChange = useCallback(async (
    contactId: string,
    update: Partial<Completion> & { _save?: boolean }
  ) => {
    const { _save, ...fields } = update

    setCompletions(prev => {
      const base: Completion = prev[contactId] ?? { contacted: false, meetingSet: false, meetingDate: null, meetingNotes: null }
      return { ...prev, [contactId]: { ...base, ...fields } }
    })

    try {
      await fetch('/api/dashboard/outreach-completion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, ...fields }),
      })
    } catch {
      fetchWeekData()
    }
  }, [fetchWeekData])

  const weekStart = weekData?.weekStart ?? null

  const getWeekContacts = (weekNum: 1 | 2 | 3): WeekContact[] => {
    if (!weekData?.weeks || !filters) return []
    return applyFilters(weekData.weeks[weekNum], filters)
  }

  const w1 = getWeekContacts(1)
  const w2 = getWeekContacts(2)
  const w3 = getWeekContacts(3)
  const totalPool = w1.length + w2.length + w3.length

  const WEEK_STYLES = [
    { icon: 'text-rose-600', text: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
    { icon: 'text-amber-600', text: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
    { icon: 'text-sky-600', text: 'text-sky-500', bg: 'bg-sky-50', border: 'border-sky-100' },
  ]

  return (
    <div className="space-y-8">
      {selectedContact && (
        <ContactModal
          contact={{
            contactId: selectedContact.contactId,
            name: selectedContact.name,
            specialty: selectedContact.specialty,
            ownerName: selectedContact.ownerName,
          }}
          onClose={() => setSelectedContact(null)}
        />
      )}

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic">Outreach Goals</h2>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
            3-Week Locked Queue · {totalPool} contacts · Resets every Monday
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchWeekData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border-2 border-gray-200 bg-white text-gray-500 hover:border-gray-300 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {weekData && !weekData.initialized && (
            <button
              onClick={() => initWeek(false)}
              disabled={initializing}
              className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Play className="w-4 h-4" />
              {initializing ? 'Building Queue…' : 'Start This Week'}
            </button>
          )}
          {weekData?.initialized && (
            <button
              onClick={() => { if (confirm('Rebuild the queue? This will clear all completion checkmarks for this week.')) initWeek(true) }}
              disabled={initializing}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border-2 border-gray-200 bg-white text-gray-500 hover:border-red-300 hover:text-red-500 disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${initializing ? 'animate-spin' : ''}`} />
              Rebuild Queue
            </button>
          )}
        </div>
      </div>

      <FilterBar
        onFilterChange={setFilters}
        showDateFilter={false}
        excludeSpecialties={['Dermatology', 'Dentistry']}
      />

      <CampaignTracker filters={filters} />

      {loading && !weekData && (
        <div className="p-8 text-center text-gray-500 animate-pulse font-bold uppercase tracking-widest">
          Loading Outreach Queue…
        </div>
      )}

      {weekData && !weekData.initialized && !loading && (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Play className="w-7 h-7 text-blue-600" />
          </div>
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">No Queue for This Week</h3>
          <p className="text-sm text-gray-500 font-bold mb-6 max-w-md mx-auto">
            The Monday cron hasn't run yet. Click below to build this week's outreach assignments now.
            They'll lock in and persist for the rest of the week.
          </p>
          <button
            onClick={() => initWeek(false)}
            disabled={initializing}
            className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Play className="w-4 h-4" />
            {initializing ? 'Building Queue…' : 'Start This Week\'s Queue'}
          </button>
        </div>
      )}

      {weekData?.initialized && weekStart && filters && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <WeekColumn
            weekNum={1}
            label="Week 1"
            dateRange={weekDateRange(weekStart, 0)}
            contacts={w1}
            completions={completions}
            accentColor={WEEK_STYLES[0]}
            onOpen={setSelectedContact}
            onCompletionChange={handleCompletionChange}
          />
          <WeekColumn
            weekNum={2}
            label="Week 2"
            dateRange={weekDateRange(weekStart, 1)}
            contacts={w2}
            completions={completions}
            accentColor={WEEK_STYLES[1]}
            onOpen={setSelectedContact}
            onCompletionChange={handleCompletionChange}
          />
          <WeekColumn
            weekNum={3}
            label="Week 3"
            dateRange={weekDateRange(weekStart, 2)}
            contacts={w3}
            completions={completions}
            accentColor={WEEK_STYLES[2]}
            onOpen={setSelectedContact}
            onCompletionChange={handleCompletionChange}
          />
        </div>
      )}
    </div>
  )
}
