'use client'

import { useState, useCallback, useEffect } from 'react'
import FilterBar, { FilterState } from '@/components/filters/FilterBar'
import ContactModal from '@/components/contacts/ContactModal'
import CampaignTracker from '@/components/outreach/CampaignTracker'
import { Clock, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type Contact = {
  contactId: string
  name: string
  specialty: string | null
  ownerName: string
  status: string
  tier1: boolean
  dealStatus: string | null
  closedNurtureReason?: string | null
  notes?: string | null
  outreachCount: number
  lastActivity?: string
  hiddenByDisposition?: boolean
}

function buildFilterQS(filters: FilterState): string {
  const qs = new URLSearchParams()
  if (filters.ownerIds.length) qs.set('ownerIds', filters.ownerIds.join(','))
  if (filters.tier1Only) qs.set('tier1Only', 'true')
  if (filters.specialties.length) qs.set('specialties', filters.specialties.join(','))
  if (filters.companyTypes.length) qs.set('companyTypes', filters.companyTypes.join(','))
  if (filters.leadStatuses.length) qs.set('leadStatuses', filters.leadStatuses.join(','))
  if (filters.dealStatuses.length) qs.set('dealStatuses', filters.dealStatuses.join(','))
  if (!filters.includeRemoved) qs.set('includeRemoved', 'false')
  if (filters.locationFilter !== 'all') qs.set('locationFilter', filters.locationFilter)
  return qs.toString()
}

function parseBucket(reason: string | null | undefined): string | null {
  if (!reason) return null
  const idx = reason.indexOf(' — ')
  return (idx === -1 ? reason : reason.slice(0, idx)).trim()
}

function isUnresponsive(field: string | null | undefined): boolean {
  return parseBucket(field) === 'Unresponsive'
}

function sortOldestFirst(list: Contact[]): Contact[] {
  return [...list].sort((a, b) => {
    if (!a.lastActivity && !b.lastActivity) return 0
    if (!a.lastActivity) return -1
    if (!b.lastActivity) return 1
    return new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()
  })
}

function splitIntoThirds<T>(arr: T[]): [T[], T[], T[]] {
  const n = arr.length
  if (n === 0) return [[], [], []]
  const base = Math.floor(n / 3)
  const rem = n % 3
  const s1 = base + (rem > 0 ? 1 : 0)
  const s2 = base + (rem > 1 ? 1 : 0)
  return [arr.slice(0, s1), arr.slice(s1, s1 + s2), arr.slice(s1 + s2)]
}

function ContactCard({ c, onOpen }: { c: Contact; onOpen: (c: Contact) => void }) {
  return (
    <button
      onClick={() => onOpen(c)}
      className={`relative w-full bg-white border-2 rounded-xl shadow-sm hover:shadow-md transition-all text-left p-4 ${c.tier1 ? 'border-amber-300 bg-amber-50/40' : 'border-gray-100 hover:border-gray-300'}`}
    >
      <span className="absolute top-3 right-3 text-[10px] font-black text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{c.outreachCount}</span>
      <div className="flex items-center gap-4 pr-8">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${c.tier1 ? 'bg-amber-100' : 'bg-gray-50'}`}>
          <User className={`w-5 h-5 ${c.tier1 ? 'text-amber-500' : 'text-gray-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-900">{c.name}</h4>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
              <User className="w-3 h-3" />{c.ownerName}
            </span>
            {c.specialty && <span className="text-[10px] text-gray-400 uppercase tracking-tight">{c.specialty}</span>}
            {c.status && <span className="text-[10px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-bold">{c.status}</span>}
            {c.dealStatus && <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-bold">{c.dealStatus}</span>}
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400">
              <Clock className="w-3 h-3" />{c.lastActivity ? formatDistanceToNow(new Date(c.lastActivity), { addSuffix: true }) : 'Never contacted'}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

function WeekColumn({ title, subtitle, accentIcon, accentText, accentBg, contacts, onSelectContact }: {
  title: string
  subtitle: string
  accentIcon: string
  accentText: string
  accentBg: string
  contacts: Contact[]
  onSelectContact: (c: Contact) => void
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 px-1">
        <div className={`p-2 rounded-lg ${accentBg}`}>
          <Clock className={`w-5 h-5 ${accentIcon}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{title}</h3>
            <span className={`text-xs font-black rounded-full px-2 py-0.5 ${accentText} ${accentBg}`}>{contacts.length}</span>
          </div>
          <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${accentText}`}>
            {subtitle}
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {contacts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No contacts.</p>
          </div>
        ) : contacts.map(c => (
          <ContactCard key={c.contactId} c={c} onOpen={onSelectContact} />
        ))}
      </div>
    </section>
  )
}

export default function OutreachGoalsPage() {
  const [filters, setFilters] = useState<FilterState | null>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  const fetchData = useCallback(async (f: FilterState) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/gameplan?${buildFilterQS(f)}`)
      const d = await res.json()
      setData(d)
    } catch (err) {
      console.error('Failed to load outreach goals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (filters) fetchData(filters)
  }, [filters, fetchData])

  if (loading && !data) {
    return <div className="p-8 text-center text-gray-500 animate-pulse font-bold uppercase tracking-widest">Building Outreach Queue...</div>
  }

  const openLeads: Contact[] = data?.openLeads ?? []
  const unresponsiveOpenDeal: Contact[] = (data?.staleTier1s ?? []).filter((c: Contact) => isUnresponsive(c.closedNurtureReason))
  const unresponsiveNurture: Contact[] = (data?.closedNurture ?? [])
    .filter((c: Contact) => !c.hiddenByDisposition)
    .filter((c: Contact) => isUnresponsive(c.notes))
  const pool = sortOldestFirst([...openLeads, ...unresponsiveOpenDeal, ...unresponsiveNurture])
  const [w1, w2, w3] = splitIntoThirds(pool)

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

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic">Outreach Goals</h2>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
            3-Week Rotating Queue · {pool.length} contacts · Initial Outreach + Unresponsive · Oldest touch → Most recent
          </p>
        </div>
      </div>

      <FilterBar
        onFilterChange={setFilters}
        showDateFilter={false}
        excludeSpecialties={['Dermatology', 'Dentistry']}
      />

      <CampaignTracker filters={filters} />

      {data && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <WeekColumn
            title="Week 1"
            subtitle="This Week · Coldest"
            accentIcon="text-rose-600"
            accentText="text-rose-500"
            accentBg="bg-rose-50"
            contacts={w1}
            onSelectContact={setSelectedContact}
          />
          <WeekColumn
            title="Week 2"
            subtitle="Next Week"
            accentIcon="text-amber-600"
            accentText="text-amber-500"
            accentBg="bg-amber-50"
            contacts={w2}
            onSelectContact={setSelectedContact}
          />
          <WeekColumn
            title="Week 3"
            subtitle="Following · Most Recent"
            accentIcon="text-sky-600"
            accentText="text-sky-500"
            accentBg="bg-sky-50"
            contacts={w3}
            onSelectContact={setSelectedContact}
          />
        </div>
      )}
    </div>
  )
}
