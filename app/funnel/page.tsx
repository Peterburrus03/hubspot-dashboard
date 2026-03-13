'use client'

import { useState, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import FilterBar, { FilterState } from '@/components/filters/FilterBar'
import { Card } from '@/components/ui/Card'
import { AlertCircle, Gift, User, Users, ArrowRight, Clock, ChevronDown, ChevronUp, X, Phone, Mail, FileText, CalendarDays, Tablet } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

// ─── BD Strategy ──────────────────────────────────────────────────────────────

async function callAI(body: object): Promise<any> {
  const res = await fetch('/api/ai/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function buildContext(): Promise<string> {
  const [pipelineRes, statsRes, gpRes, actRes] = await Promise.all([
    fetch('/api/dashboard/pipeline?isOpenOnly=false').then(r => r.json()).catch(() => ({})),
    fetch('/api/dashboard/pipeline-stats').then(r => r.json()).catch(() => ({})),
    fetch('/api/dashboard/gameplan').then(r => r.json()).catch(() => ({})),
    fetch('/api/dashboard/activity').then(r => r.json()).catch(() => ({})),
  ])

  const allDeals = pipelineRes.deals ?? []
  const actuals = statsRes.actuals ?? {}
  const daysToDeadline = Math.floor((new Date('2026-09-07').getTime() - Date.now()) / 86400000)

  const openDeals = allDeals.filter((d: any) => d.isOpen)
  const closedNurture = allDeals.filter((d: any) => d.stage === 'Closed Nurture')

  const dealLines = openDeals.map((d: any) =>
    `- ${d.dealName} | ${d.stage} | $${((d.ebitda ?? 0) / 1000).toFixed(2)}M EBITDA | ${d.numDvms ?? '?'} DVMs | ${d.state ?? ''}`
  ).join('\n')

  const closedLines = closedNurture.map((d: any) =>
    `- ${d.dealName} | $${((d.ebitda ?? 0) / 1000).toFixed(2)}M EBITDA | ${d.specialty ?? '—'}`
  ).join('\n')

  let universeSection = ''
  if (gpRes.universe) {
    const u = gpRes.universe
    universeSection = `
ADDRESSABLE UNIVERSE (${u.total} owner-contacts):
- Interested: ${u.interested.count}
- Fair Game: ${u.fairGame.count} (no disposition yet)
- Not Now: ${u.notInterestedNow.count}
- Not Interested: ${u.notInterestedAtAll.count}

TOP INTERESTED CONTACTS:
${(u.interested.contacts as any[]).slice(0, 10).map((c: any) =>
  `  ${c.name} | ${c.specialty ?? '—'} | ${c.ownerName}${c.dealStage ? ` | Deal: ${c.dealStage}` : ''}`
).join('\n')}`
  }

  let touchSection = ''
  if (actRes.byOwner) {
    const allContacts: { name: string; owner: string; touches: number; lastTouch: string | null }[] = []
    for (const owner of actRes.byOwner as any[]) {
      for (const fu of owner.followUps ?? []) {
        allContacts.push({ name: fu.contactName, owner: owner.ownerName, touches: fu.touchCount, lastTouch: fu.lastTouch })
      }
    }
    allContacts.sort((a, b) => b.touches - a.touches)
    touchSection = `
MOST-TOUCHED CONTACTS (top 20):
${allContacts.slice(0, 20).map(c =>
  `  ${c.name} | ${c.owner} | ${c.touches} touches | last: ${c.lastTouch ? new Date(c.lastTouch).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'unknown'}`
).join('\n')}`
  }

  return `You are an M&A pipeline analyst and BD strategy advisor for AOSN. Today is ${new Date().toDateString()}.

TARGETS: $18.9M EBITDA | 60 NDAs | 23 APAs | 1,820 outreach | NDA DEADLINE: Sep 7 (${daysToDeadline} days)
ACTUALS YTD: ${actuals.ytdNDAs ?? 0} NDAs | ${actuals.ytdLOIs ?? 0} LOIs | ${actuals.ytdAPAs ?? 0} APAs | ${actuals.ytdOutreach ?? 0} outreach | $${((actuals.closedEBITDA ?? 0) / 1000).toFixed(1)}M closed

OPEN DEALS (${openDeals.length}):
${dealLines}

CLOSED NURTURE DEALS (${closedNurture.length} re-engagement candidates):
${closedLines}
${universeSection}
${touchSection}`
}

const BD_SECTIONS = [
  {
    key: 'topFunnel',
    label: '🌱 Top of Funnel',
    sublabel: 'Getting initial responses',
    color: 'indigo',
    prompt: `Using the addressable universe, outreach activity, and touch count data, generate a prioritized top-of-funnel BD strategy for this week. Focus on contacts who have NOT yet responded — Fair Game bucket and low-touch contacts.

Include:
1. Which specific Fair Game contacts to prioritize and why (specialty, EBITDA potential, touch count)
2. Recommended outreach channel for each based on our channel hierarchy
3. Re-engagement tier for contacts with 3+ touches and no response
4. Any trigger-based opportunities

Format with clear headers, a prioritized table, and specific action recommendations. Name names.`,
  },
  {
    key: 'closedNurture',
    label: '🔄 Closed Nurture',
    sublabel: 'Re-engagement strategy',
    color: 'amber',
    prompt: `Using the Closed Nurture deals list, generate a re-engagement strategy for this week.

Include:
1. Top 5–8 Closed Nurture deals worth a re-touch ranked by EBITDA
2. Recommended re-engagement angle for each (market update, referral, trigger event)
3. What NOT to do — deals too cold or over-touched
4. Any deals to permanently remove from active pipeline

Format with a prioritized table and specific copy direction per deal. Reference the AOSN BD context on re-engagement tiers.`,
  },
  {
    key: 'engagedNDA',
    label: '📋 Engaged → NDA',
    sublabel: 'Convert to signed NDA',
    color: 'emerald',
    prompt: `Using the open deals pipeline, focus on deals in "Engaged" stage that have NOT signed an NDA. Generate a conversion strategy for this week.

Include:
1. Each Engaged deal ranked by EBITDA with a specific recommended next action
2. Blockers or red flags to address before the NDA ask
3. Which deals are at risk of going cold this week
4. Suggested NDA ask approach for the top 3 deals

Also flag any Pre-LOI or Data Collection deals stalling that need a push. Format with a prioritized table and direct action steps.`,
  },
]

const COLOR_MAP: Record<string, { border: string; badge: string; btn: string }> = {
  indigo: { border: 'border-indigo-100', badge: 'bg-indigo-50 text-indigo-600', btn: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
  amber:  { border: 'border-amber-100',  badge: 'bg-amber-50 text-amber-600',  btn: 'bg-amber-500 hover:bg-amber-600 text-white' },
  emerald:{ border: 'border-emerald-100',badge: 'bg-emerald-50 text-emerald-600',btn: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
}

function BDStrategy() {
  const [content, setContent] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [ctx, setCtx] = useState<string | null>(null)

  const getCtx = async () => {
    if (ctx) return ctx
    const c = await buildContext()
    setCtx(c)
    return c
  }

  const generate = async (key: string, prompt: string) => {
    setLoading(l => ({ ...l, [key]: true }))
    try {
      const context = await getCtx()
      const data = await callAI({ model: 'claude-sonnet-4-6', max_tokens: 1500, system: context, messages: [{ role: 'user', content: prompt }] })
      setContent(c => ({ ...c, [key]: data.content?.find((b: any) => b.type === 'text')?.text || 'No response.' }))
    } catch {
      setContent(c => ({ ...c, [key]: 'Error generating. Please try again.' }))
    }
    setLoading(l => ({ ...l, [key]: false }))
  }

  const anyLoading = Object.values(loading).some(Boolean)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">BD Strategy</h3>
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">AI-generated · live pipeline & universe context</p>
        </div>
        <button
          onClick={() => BD_SECTIONS.forEach(s => generate(s.key, s.prompt))}
          disabled={anyLoading}
          className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 font-medium">
          {anyLoading ? '⏳ Generating…' : '✦ Generate All'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {BD_SECTIONS.map(s => {
          const c = COLOR_MAP[s.color]
          return (
            <div key={s.key} className="flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <div className="text-sm font-black text-gray-900">{s.label}</div>
                  <div className="text-[10px] text-gray-400 font-medium mt-0.5">{s.sublabel}</div>
                </div>
                <button
                  onClick={() => generate(s.key, s.prompt)}
                  disabled={loading[s.key]}
                  className={`text-xs px-3 py-1 rounded-lg font-bold disabled:opacity-50 ${c.btn}`}>
                  {loading[s.key] ? '⏳' : 'Generate'}
                </button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto" style={{ maxHeight: 560 }}>
                {loading[s.key] && (
                  <div className="space-y-2 pt-2">
                    {[100, 85, 95, 70, 90, 80].map((w, i) => (
                      <div key={i} className="h-2.5 bg-gray-100 rounded animate-pulse" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                )}
                {!loading[s.key] && !content[s.key] && (
                  <p className="text-xs text-gray-400 text-center pt-10">Click Generate to build this section</p>
                )}
                {!loading[s.key] && content[s.key] && (
                  <div className="prose prose-sm max-w-none text-gray-800
                    [&_h1]:text-gray-900 [&_h1]:font-black [&_h1]:text-sm [&_h1]:mt-3 [&_h1]:mb-1
                    [&_h2]:text-gray-800 [&_h2]:font-bold [&_h2]:text-sm [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:border-b [&_h2]:border-gray-100 [&_h2]:pb-1
                    [&_h3]:text-gray-700 [&_h3]:font-semibold [&_h3]:text-xs [&_h3]:mt-2 [&_h3]:mb-1
                    [&_p]:text-gray-700 [&_p]:text-xs [&_p]:leading-relaxed [&_p]:my-1
                    [&_strong]:text-gray-900 [&_strong]:font-bold
                    [&_ul]:text-gray-700 [&_ul]:text-xs [&_ul]:my-1 [&_ul]:pl-4
                    [&_ol]:text-gray-700 [&_ol]:text-xs [&_ol]:my-1 [&_ol]:pl-4
                    [&_li]:my-0.5
                    [&_hr]:border-gray-100 [&_hr]:my-2
                    [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_table]:my-2
                    [&_th]:text-left [&_th]:text-gray-500 [&_th]:font-semibold [&_th]:px-2 [&_th]:py-1 [&_th]:border-b [&_th]:border-gray-200
                    [&_td]:px-2 [&_td]:py-1.5 [&_td]:border-b [&_td]:border-gray-100 [&_td]:align-top">
                    <ReactMarkdown>{content[s.key]}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )
        })}
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
      .then(d => {
        setEngagements(d.engagements ?? [])
      })
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

          {/* Chronological engagement timeline */}
          {engagements.map(e => {
            const isIpad = e.type === 'IPAD_COVER_SHIPPED' || e.type === 'IPAD_SHIPPED' || e.type === 'IPAD_RESPONSE'
            const title = isIpad
              ? e.type === 'IPAD_COVER_SHIPPED' ? 'iPad Cover Shipped'
              : e.type === 'IPAD_SHIPPED' ? `iPad Shipped${e.ipadGroup ? ` · ${e.ipadGroup}` : ''}`
              : `iPad Response${e.ipadResponseType ? ` · ${e.ipadResponseType}` : ''}`
              : e.type === 'TASK'
              ? (e.taskCategory ?? 'Sales Activity')
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

      {/* BD Strategy AI — always visible at top */}
      <BDStrategy />

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
