'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import FilterBar, { FilterState } from '@/components/filters/FilterBar'
import { Card } from '@/components/ui/Card'
import { AlertCircle, Gift, User, Users, ArrowRight, Clock, ChevronDown, ChevronUp, X, Phone, Mail, FileText, CalendarDays, Tablet, Bot } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

// ─── NDA Strategy AI Chat ─────────────────────────────────────────────────────

async function callAI(body: object): Promise<any> {
  const res = await fetch('/api/ai/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

function NDAStrategyChat() {
  const [msgs, setMsgs] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load pipeline context once on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/pipeline?isOpenOnly=false').then(r => r.json()),
      fetch('/api/dashboard/pipeline-stats').then(r => r.json()),
      fetch('/api/dashboard/vintages').then(r => r.json()),
    ]).then(([pipelineData, statsData, vintageData]) => {
      const deals = pipelineData.deals ?? []
      const actuals = statsData.actuals ?? {}
      const vintages = vintageData.vintages ?? []

      const dealLines = deals.map((d: any) =>
        `- ${d.dealName} | Stage: ${d.stage} | ${d.daysInStage ?? '?'}d in stage | EBITDA: $${((d.ebitda ?? 0) / 1000).toFixed(1)}M | DVMs: ${d.numDvms ?? '?'} | ${d.state ?? ''}`
      ).join('\n')

      const vintageLines = vintages
        .filter((v: any) => v.engaged > 0)
        .map((v: any) => `  ${v.quarter}: ${v.engaged} engaged → ${v.ndas} NDAs (${v.ndaConv}% conv, avg ${v.avgDaysToNda ?? '?'}d) → ${v.lois} LOIs (${v.loiConv}% conv)`)
        .join('\n')

      const ctx = `You are a strategic M&A advisor for AOSN, a veterinary specialty practice acquisition firm.

IMPORTANT MARKET CONTEXT:
- Approximately 2/3 of AOSN's total addressable market has already been contacted and has responded in some capacity
- This means cold outreach is largely exhausted — the focus must be on deepening existing relationships, re-engaging warm contacts, and converting engaged prospects to NDAs
- Each deal has unique dynamics (owner personality, practice size, location, specialty, timeline) — recommendations must be deal-specific, not generic
- NDA DEADLINE: September 7, 2026 (${Math.floor((new Date('2026-09-07').getTime() - Date.now()) / 86400000)} days away)

ANNUAL TARGETS: $18.9M EBITDA closed | 60 NDAs | 23 APAs

YTD ACTUALS:
- NDAs signed: ${actuals.ytdNDAs ?? 0}
- LOIs signed: ${actuals.ytdLOIs ?? 0}
- APAs signed: ${actuals.ytdAPAs ?? 0}
- Outreach touches: ${actuals.ytdOutreach ?? 0}
- Closed EBITDA: $${((actuals.closedEBITDA ?? 0) / 1000).toFixed(1)}M

VINTAGE CONVERSION RATES (cohort by quarter of deal creation):
${vintageLines}

FULL PIPELINE (${deals.length} deals):
${dealLines}

Your role is to help the BD team be clever and strategic. Focus on:
1. Which specific deals are closest to NDA and what's the right move to get them there
2. Re-engagement strategies for deals that have gone quiet
3. Timing and sequencing of outreach given the NDA deadline
4. Deal-specific angles based on practice type, size, and owner situation
Be direct, specific, and actionable. Reference deals by name.`

      setContext(ctx)
    }).catch(console.error)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  const send = async () => {
    if (!input.trim() || !context) return
    const userMsg = input.trim()
    setInput('')
    const newMsgs = [...msgs, { role: 'user', content: userMsg }]
    setMsgs(newMsgs)
    setLoading(true)
    try {
      const data = await callAI({ model: 'claude-sonnet-4-6', max_tokens: 1200, system: context, messages: newMsgs })
      setMsgs(m => [...m, { role: 'assistant', content: data.content?.find((b: any) => b.type === 'text')?.text || 'No response.' }])
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: 'Error contacting API.' }])
    }
    setLoading(false)
  }

  const suggestions = [
    'Which deals are closest to NDA right now?',
    'Who has gone quiet that we should re-engage?',
    'Given the deadline, what should we prioritize this week?',
    'Which deals have the best NDA conversion signals?',
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Bot className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">NDA Strategy Assistant</h3>
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Full pipeline context · deal-specific recommendations</p>
        </div>
        <div className="ml-auto">
          {context
            ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Pipeline loaded</span>
            : <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">Loading context…</span>
          }
        </div>
      </div>

      <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {msgs.length === 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-gray-400 text-center mb-4">Ask anything about NDA strategy — the full pipeline is loaded as context.</p>
            <div className="grid grid-cols-2 gap-2">
              {suggestions.map(s => (
                <button key={s} onClick={() => setInput(s)}
                  className="text-left text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors font-medium">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={'text-sm rounded-xl px-3 py-2 max-w-xl leading-relaxed whitespace-pre-wrap ' +
              (m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-800 shadow-sm')}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="text-sm bg-white border border-gray-200 text-gray-400 rounded-xl px-3 py-2 shadow-sm">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-gray-100 flex gap-2 bg-white">
        <input
          className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 placeholder-gray-400"
          placeholder={context ? 'Ask about NDA strategy, specific deals, re-engagement…' : 'Loading pipeline context…'}
          disabled={!context}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button onClick={send} disabled={loading || !context}
          className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 font-medium">
          Send
        </button>
      </div>
    </div>
  )
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  CALL:          <Phone className="w-3.5 h-3.5" />,
  EMAIL:         <Mail className="w-3.5 h-3.5" />,
  NOTE:          <FileText className="w-3.5 h-3.5" />,
  MEETING:       <CalendarDays className="w-3.5 h-3.5" />,
  IPAD_COVER_SHIPPED: <Tablet className="w-3.5 h-3.5" />,
  IPAD_SHIPPED:       <Tablet className="w-3.5 h-3.5" />,
  IPAD_RESPONSE:      <Tablet className="w-3.5 h-3.5" />,
}
const TYPE_COLOR: Record<string, string> = {
  CALL:          'bg-emerald-100 text-emerald-700',
  EMAIL:         'bg-sky-100 text-sky-700',
  NOTE:          'bg-amber-100 text-amber-700',
  MEETING:       'bg-violet-100 text-violet-700',
  IPAD_COVER_SHIPPED: 'bg-purple-100 text-purple-700',
  IPAD_SHIPPED:       'bg-indigo-100 text-indigo-700',
  IPAD_RESPONSE:      'bg-pink-100 text-pink-700',
}
const TYPE_LABEL: Record<string, string> = {
  CALL:          'Call',
  EMAIL:         'Email',
  NOTE:          'Note',
  MEETING:       'Meeting',
  IPAD_COVER_SHIPPED: 'iPad Cover Shipped',
  IPAD_SHIPPED:       'iPad Shipped',
  IPAD_RESPONSE:      'iPad Response',
}

const TIMELINE_FILTERS = [
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
  { label: '1yr', days: 365 },
  { label: 'All', days: null },
]

function ContactModal({ contact, onClose }: {
  contact: { contactId: string; name: string; specialty: string | null; ownerName: string }
  onClose: () => void
}) {
  const [engagements, setEngagements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    const qs = days ? `?contactId=${contact.contactId}&days=${days}` : `?contactId=${contact.contactId}`
    fetch(`/api/dashboard/contact${qs}`)
      .then(r => r.json())
      .then(d => setEngagements(d.engagements ?? []))
      .finally(() => setLoading(false))
  }, [contact.contactId, days])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-black text-gray-900">{contact.name}</h3>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
              {contact.specialty ?? '—'} · {contact.ownerName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {TIMELINE_FILTERS.map(f => (
                <button
                  key={f.label}
                  onClick={() => setDays(f.days)}
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors ${days === f.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {loading && <p className="text-center text-sm text-gray-400 animate-pulse py-8">Loading activity...</p>}
          {!loading && engagements.length === 0 && (
            <p className="text-center text-sm font-bold text-gray-400 uppercase py-8">No outreach on record</p>
          )}
          {engagements.map(e => {
            const isIpad = e.type === 'IPAD_COVER_SHIPPED' || e.type === 'IPAD_SHIPPED' || e.type === 'IPAD_RESPONSE'
            const title = isIpad
              ? e.type === 'IPAD_COVER_SHIPPED' ? 'iPad Cover Shipped'
              : e.type === 'IPAD_SHIPPED' ? `iPad Shipped${e.ipadGroup ? ` · ${e.ipadGroup}` : ''}`
              : `iPad Response${e.ipadResponseType ? ` · ${e.ipadResponseType}` : ''}`
              : e.type === 'TASK'
              ? `Task${e.body ? ` — ${e.body}` : ''}`
              : e.emailSubject || e.callDisposition || TYPE_LABEL[e.type] || e.type
            return (
              <div key={e.engagementId} className="flex gap-3">
                <div className={`mt-0.5 flex-shrink-0 p-1.5 rounded-lg ${TYPE_COLOR[e.type] ?? 'bg-gray-100 text-gray-500'}`}>
                  {TYPE_ICON[e.type] ?? <FileText className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-700">{title}</span>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {format(new Date(e.timestamp), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {e.body && e.type !== 'TASK' && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{stripHtml(e.body)}</p>
                  )}
                  {e.ownerName && <p className="text-[10px] text-gray-400 mt-0.5">{e.ownerName}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type UniverseContact = {
  contactId: string; name: string; specialty: string | null; ownerName: string
  leadStatus?: string | null; dealStage?: string | null
}

function UniverseBucket({ count, label, sublabel, colorClass, borderClass, contacts, onSelectContact }: {
  count: number; label: string; sublabel: string
  colorClass: string; borderClass: string
  contacts: UniverseContact[]
  onSelectContact: (c: UniverseContact) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`bg-white border-2 ${borderClass} rounded-xl overflow-hidden`}>
      <button onClick={() => setOpen(o => !o)} className="w-full p-5 text-center hover:bg-gray-50 transition-colors">
        <div className={`text-3xl font-black ${colorClass}`}>{count}</div>
        <div className={`text-[10px] font-black uppercase tracking-widest mt-1 ${colorClass}`}>{label}</div>
        <div className="text-[10px] text-gray-400 mt-1">{sublabel}</div>
        {count > 0 && (
          <div className={`mt-2 flex items-center justify-center gap-1 text-[10px] font-bold ${colorClass} opacity-60`}>
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {open ? 'Hide' : 'Show'} contacts
          </div>
        )}
      </button>
      {open && (
        <div className="border-t border-gray-100 max-h-72 overflow-y-auto divide-y divide-gray-50">
          {contacts.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-6">No contacts</p>
          )}
          {contacts.map(c => (
            <button key={c.contactId} onClick={() => onSelectContact(c)} className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
              <div>
                <div className="text-sm font-bold text-gray-900">{c.name}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-gray-400 uppercase tracking-tight">{c.specialty ?? '—'}</span>
                  {c.leadStatus && <span className="text-[10px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-bold">{c.leadStatus}</span>}
                  {c.dealStage  && <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-bold">{c.dealStage}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-[10px] font-bold text-gray-400">{c.ownerName}</div>
                <ArrowRight className="w-3 h-3 text-gray-300" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FunnelPage() {
  const [filters, setFilters] = useState<FilterState | null>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [selectedContact, setSelectedContact] = useState<UniverseContact | null>(null)

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
      {selectedContact && <ContactModal contact={selectedContact} onClose={() => setSelectedContact(null)} />}

      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic">BD Game Plan</h2>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Strategic Priorities & Follow-up Triggers</p>
      </div>

      <FilterBar onFilterChange={setFilters} showDateFilter={false} />

      {/* NDA Strategy AI — always visible at top */}
      <NDAStrategyChat />

      {data && (
        <div className="space-y-8">

          {/* Addressable Universe — full width */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Addressable Universe</h3>
                <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">{data.universe.total} contacts · owners only</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <UniverseBucket
                count={data.universe.interested.count}
                label="Interested"
                sublabel="Actively pursue"
                colorClass="text-emerald-600"
                borderClass="border-emerald-100"
                contacts={data.universe.interested.contacts}
                onSelectContact={setSelectedContact}
              />
              <UniverseBucket
                count={data.universe.fairGame.count}
                label="Fair Game"
                sublabel="Has owner · no disposition"
                colorClass="text-sky-600"
                borderClass="border-sky-100"
                contacts={data.universe.fairGame.contacts}
                onSelectContact={setSelectedContact}
              />
              <UniverseBucket
                count={data.universe.notInterestedNow.count}
                label="Not Now"
                sublabel="Nurture bucket"
                colorClass="text-amber-600"
                borderClass="border-amber-100"
                contacts={data.universe.notInterestedNow.contacts}
                onSelectContact={setSelectedContact}
              />
              <UniverseBucket
                count={data.universe.notInterestedAtAll.count}
                label="Not Interested"
                sublabel="Do not contact"
                colorClass="text-rose-600"
                borderClass="border-rose-100"
                contacts={data.universe.notInterestedAtAll.contacts}
                onSelectContact={setSelectedContact}
              />
            </div>
          </section>

          {/* Stale Tier 1 + Action Triggers side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

          {/* Stale Tier 1 Targets */}
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
              {data.staleTier1s.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">All Tier 1 Targets are up to date!</p>
                </div>
              ) : data.staleTier1s.map((c: any) => (
                <button
                  key={c.contactId}
                  onClick={() => setSelectedContact({ contactId: c.contactId, name: c.name, specialty: c.specialty, ownerName: c.ownerName })}
                  className="w-full bg-white border-2 border-rose-50 rounded-xl p-4 shadow-sm hover:border-rose-200 hover:shadow-md transition-all flex items-center justify-between text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{c.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
                          <User className="w-3 h-3" />{c.ownerName}
                        </span>
                        {c.specialty && (
                          <span className="text-[10px] text-gray-400 uppercase tracking-tight">{c.specialty}</span>
                        )}
                        {c.status && (
                          <span className="text-[10px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-bold">{c.status}</span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 uppercase">
                          <Clock className="w-3 h-3" />{c.lastActivity ? formatDistanceToNow(new Date(c.lastActivity), { addSuffix: true }) : 'Never contacted'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </section>

          {/* Action Triggers */}
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
              {data.actionableTriggers.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No recent follow-up triggers detected.</p>
                </div>
              ) : data.actionableTriggers.map((t: any, i: number) => {
                const covered = !!t.coveredByTask
                return (
                  <div key={i} className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${covered ? 'border-emerald-100 opacity-60' : 'border-gray-200 hover:shadow-md'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-full">{t.trigger}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{t.activityType}</span>
                        {covered && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full">
                            Task due {format(new Date(t.coveredByTask.dueDate), 'MMM d')}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-black text-gray-900 uppercase">{format(new Date(t.timestamp), 'MMM d')}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-gray-900">{t.contactName}</h4>
                        {t.body && <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{stripHtml(t.body)}</p>}
                      </div>
                      {!covered && (
                        <button
                          onClick={() => setSelectedContact({ contactId: t.contactId, name: t.contactName, specialty: null, ownerName: t.ownerName })}
                          className="mt-1 shrink-0 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          </div>{/* end 2-col grid */}
        </div>
      )}
    </div>
  )
}
