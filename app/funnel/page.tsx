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

function buildFilterQS(filters?: FilterState | null): string {
  if (!filters) return ''
  const qs = new URLSearchParams()
  if (filters.ownerIds.length) qs.set('ownerIds', filters.ownerIds.join(','))
  if (filters.tier1Only) qs.set('tier1Only', 'true')
  if (filters.specialties.length) qs.set('specialties', filters.specialties.join(','))
  if (filters.companyTypes.length) qs.set('companyTypes', filters.companyTypes.join(','))
  if (filters.leadStatuses.length) qs.set('leadStatuses', filters.leadStatuses.join(','))
  if (filters.dealStatuses.length) qs.set('dealStatuses', filters.dealStatuses.join(','))
  if (!filters.includeRemoved) qs.set('includeRemoved', 'false')
  if (filters.locationFilter !== 'all') qs.set('locationFilter', filters.locationFilter)
  const str = qs.toString()
  return str ? `&${str}` : ''
}

async function buildContext(filters?: FilterState | null): Promise<string> {
  const fqs = buildFilterQS(filters)
  const [pipelineRes, statsRes, gpRes, actRes, feedbackRes] = await Promise.all([
    fetch(`/api/dashboard/pipeline?isOpenOnly=false${fqs}`).then(r => r.json()).catch(() => ({})),
    fetch(`/api/dashboard/pipeline-stats?_=1${fqs}`).then(r => r.json()).catch(() => ({})),
    fetch(`/api/dashboard/gameplan?_=1${fqs}`).then(r => r.json()).catch(() => ({})),
    fetch(`/api/dashboard/activity?_=1${fqs}`).then(r => r.json()).catch(() => ({})),
    fetch(`/api/ai/feedback`).then(r => r.json()).catch(() => ([])),
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

  let feedbackSection = ''
  const feedbackRecords: { skill: string; contactName: string | null; feedback: string; createdAt: string }[] =
    Array.isArray(feedbackRes) ? feedbackRes : []
  if (feedbackRecords.length > 0) {
    const byContact: Record<string, string[]> = {}
    for (const r of feedbackRecords) {
      const key = r.contactName?.trim() || '(general)'
      if (!byContact[key]) byContact[key] = []
      byContact[key].push(r.feedback)
    }
    feedbackSection = `
HUMAN FEEDBACK ON PAST RECOMMENDATIONS (incorporate this into your suggestions — avoid repeating flagged contacts, respect corrections):
${Object.entries(byContact).map(([name, notes]) =>
  `  ${name}:\n${notes.map(n => `    - ${n}`).join('\n')}`
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
${touchSection}
${feedbackSection}`
}

const JSON_FORMAT = `
Return ONLY valid JSON — no markdown, no code fences, no explanation outside the JSON. Use this exact structure:
{
  "overview": "2-3 sentence strategic summary",
  "recommendations": [
    {
      "contactName": "Full Name",
      "specialty": "Specialty",
      "tier": "Tier 1 or Tier 2",
      "action": "Specific recommended next action (1-2 sentences)",
      "channel": "Email | Peer-to-Peer | LinkedIn | FedEx | Mail | Phone | Conference",
      "rationale": "Why this contact, why this week (2-3 sentences)",
      "urgency": "high | medium | low"
    }
  ]
}`

const BD_SECTIONS = [
  {
    key: 'topFunnel',
    label: '🌱 Top of Funnel',
    sublabel: 'Getting initial responses',
    color: 'indigo',
    accentColor: '#4f46e5',
    prompt: `Using the addressable universe, outreach activity, and touch count data, generate a prioritized top-of-funnel BD strategy for this week. Focus on contacts who have NOT yet responded — Fair Game bucket and low-touch contacts. Prioritize by specialty EBITDA potential and Tier. Include 6-8 specific contacts with names.
${JSON_FORMAT}`,
  },
  {
    key: 'closedNurture',
    label: '🔄 Closed Nurture',
    sublabel: 'Re-engagement strategy',
    color: 'amber',
    accentColor: '#d97706',
    prompt: `Using the Closed Nurture deals list, generate a re-engagement strategy for this week. Rank by EBITDA. For each, recommend the specific re-engagement angle (market update, referral, trigger event) and flag deals that are too cold or over-touched. Include 5-8 specific deals.
${JSON_FORMAT}`,
  },
  {
    key: 'engagedNDA',
    label: '📋 Engaged → NDA',
    sublabel: 'Convert to signed NDA',
    color: 'emerald',
    accentColor: '#059669',
    prompt: `Using the open deals pipeline, focus on Engaged stage deals that have NOT signed an NDA. Rank by EBITDA. For each deal recommend the specific next action to advance to NDA. Flag deals at risk of going cold and any Pre-LOI/Data Collection deals stalling.
${JSON_FORMAT}`,
  },
]

const URGENCY_STYLES: Record<string, string> = {
  high:   'bg-rose-50 text-rose-700 border-rose-100',
  medium: 'bg-amber-50 text-amber-700 border-amber-100',
  low:    'bg-gray-50 text-gray-500 border-gray-100',
}
const CHANNEL_STYLES: Record<string, string> = {
  'Email':          'bg-sky-50 text-sky-700',
  'Peer-to-Peer':   'bg-emerald-50 text-emerald-700',
  'LinkedIn':       'bg-blue-50 text-blue-700',
  'FedEx':          'bg-purple-50 text-purple-700',
  'Mail':           'bg-violet-50 text-violet-700',
  'Phone':          'bg-teal-50 text-teal-700',
  'Conference':     'bg-orange-50 text-orange-700',
}

type Recommendation = {
  contactName: string
  specialty: string
  tier: string
  action: string
  channel: string
  rationale: string
  urgency: string
}
type SkillResult = { overview: string; recommendations: Recommendation[] }

function FeedbackBox({ skillKey, contactName }: { skillKey: string; contactName: string }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  async function submit() {
    if (!text.trim()) return
    setStatus('saving')
    await fetch('/api/ai/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill: skillKey, contactName, feedback: text.trim() }),
    })
    setStatus('saved')
    setText('')
    setTimeout(() => setStatus('idle'), 2500)
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Feedback for model</div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="e.g. Already contacted this week · Wrong specialty · Great suggestion, worked"
        className="w-full text-xs text-gray-700 placeholder-gray-300 border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
        rows={2}
      />
      <button
        onClick={submit}
        disabled={!text.trim() || status === 'saving'}
        className="mt-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all disabled:opacity-40
          bg-gray-100 text-gray-600 hover:bg-gray-200"
      >
        {status === 'saving' ? 'Saving…' : status === 'saved' ? '✓ Saved' : 'Submit Feedback'}
      </button>
    </div>
  )
}

function RecommendationCard({ rec, skillKey, accentColor }: { rec: Recommendation; skillKey: string; accentColor: string }) {
  const [expanded, setExpanded] = useState(false)
  const channelStyle = CHANNEL_STYLES[rec.channel] ?? 'bg-gray-50 text-gray-600'
  const urgencyStyle = URGENCY_STYLES[rec.urgency] ?? URGENCY_STYLES.low

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-black text-gray-900">{rec.contactName}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">
            {rec.specialty}{rec.tier ? ` · ${rec.tier}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${urgencyStyle}`}>
            {rec.urgency}
          </span>
        </div>
      </div>

      {/* Action */}
      <div className="flex items-start gap-2">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md flex-shrink-0 ${channelStyle}`}>
          {rec.channel}
        </span>
        <p className="text-xs text-gray-700 leading-relaxed">{rec.action}</p>
      </div>

      {/* Rationale — expandable */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
      >
        {expanded ? '▲ Hide rationale' : '▼ Why this contact?'}
      </button>
      {expanded && (
        <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-lg p-2">{rec.rationale}</p>
      )}

      <FeedbackBox skillKey={skillKey} contactName={rec.contactName} />
    </div>
  )
}

function BDStrategy({ filters }: { filters: FilterState | null }) {
  const [results, setResults] = useState<Record<string, SkillResult>>({})
  const [rawErrors, setRawErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [ctx, setCtx] = useState<string | null>(null)
  const [ctxFilters, setCtxFilters] = useState<FilterState | null>(null)

  const getCtx = async () => {
    if (ctx && JSON.stringify(ctxFilters) === JSON.stringify(filters)) return ctx
    const c = await buildContext(filters)
    setCtx(c)
    setCtxFilters(filters)
    return c
  }

  const generate = async (key: string, prompt: string) => {
    setLoading(l => ({ ...l, [key]: true }))
    setRawErrors(e => ({ ...e, [key]: '' }))
    try {
      const context = await getCtx()
      const data = await callAI({
        skill: key,
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: context,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = data.content?.find((b: any) => b.type === 'text')?.text ?? ''
      try {
        // Strip any accidental markdown fences
        const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
        const parsed: SkillResult = JSON.parse(clean)
        setResults(r => ({ ...r, [key]: parsed }))
      } catch {
        setRawErrors(e => ({ ...e, [key]: text }))
      }
    } catch {
      setRawErrors(e => ({ ...e, [key]: 'Error generating. Please try again.' }))
    }
    setLoading(l => ({ ...l, [key]: false }))
  }

  const anyLoading = Object.values(loading).some(Boolean)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">BD Strategy</h3>
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">
            AI-generated · live pipeline context · feedback loop active
          </p>
        </div>
        <button
          onClick={() => BD_SECTIONS.forEach(s => generate(s.key, s.prompt))}
          disabled={anyLoading}
          className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 font-medium"
        >
          {anyLoading ? '⏳ Generating…' : '✦ Generate All'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {BD_SECTIONS.map(s => {
          const result = results[s.key]
          const error = rawErrors[s.key]
          return (
            <div key={s.key} className="flex flex-col">
              {/* Section header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <div className="text-sm font-black text-gray-900">{s.label}</div>
                  <div className="text-[10px] text-gray-400 font-medium mt-0.5">{s.sublabel}</div>
                </div>
                <button
                  onClick={() => generate(s.key, s.prompt)}
                  disabled={loading[s.key]}
                  className="text-xs px-3 py-1 rounded-lg font-bold disabled:opacity-50 text-white"
                  style={{ backgroundColor: s.accentColor }}
                >
                  {loading[s.key] ? '⏳' : 'Generate'}
                </button>
              </div>

              {/* Content */}
              <div className="p-4 flex-1 overflow-y-auto space-y-3" style={{ maxHeight: 640 }}>
                {loading[s.key] && (
                  <div className="space-y-3 pt-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-2 animate-pulse">
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                        <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                        <div className="h-2.5 bg-gray-100 rounded w-full" />
                      </div>
                    ))}
                  </div>
                )}

                {!loading[s.key] && !result && !error && (
                  <p className="text-xs text-gray-400 text-center pt-10">Click Generate to build this section</p>
                )}

                {/* Structured cards */}
                {!loading[s.key] && result && (
                  <>
                    {result.overview && (
                      <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">
                        {result.overview}
                      </p>
                    )}
                    {result.recommendations?.map((rec, i) => (
                      <RecommendationCard
                        key={i}
                        rec={rec}
                        skillKey={s.key}
                        accentColor={s.accentColor}
                      />
                    ))}
                  </>
                )}

                {/* Fallback if JSON parsing failed */}
                {!loading[s.key] && error && (
                  <div className="prose prose-sm max-w-none text-gray-800 text-xs">
                    <ReactMarkdown>{error}</ReactMarkdown>
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

// ─── Per-contact AI recommendation ────────────────────────────────────────────

type ContactRec = { channel: string; action: string; rationale: string; urgency: string }

function ContactAIRec({ contact, column }: {
  contact: { contactId: string; name: string; specialty: string | null; ownerName: string; status: string; outreachCount: number; lastActivity?: string }
  column: string
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [rec, setRec] = useState<ContactRec | null>(null)
  const [showRationale, setShowRationale] = useState(false)

  async function generate(e: React.MouseEvent) {
    e.stopPropagation()
    setStatus('loading')
    try {
      const histData = await fetch(`/api/dashboard/contact?contactId=${contact.contactId}`).then(r => r.json())
      const engagements: any[] = histData.engagements ?? []

      const historyLines = engagements.slice(0, 20).map((e: any) => {
        const date = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        const label = e.emailSubject || e.callDisposition || e.type
        const snippet = e.body ? ` — ${e.body.replace(/<[^>]+>/g, '').trim().slice(0, 80)}` : ''
        return `- ${date}: ${label}${snippet}`
      }).join('\n') || 'No prior outreach on record.'

      const system = `You are a BD advisor for AOSN, an M&A firm that acquires veterinary practices.
Recommend the single best next touch point for this specific contact based on their history.
Return ONLY valid JSON with no markdown: { "channel": "Email|Call|LinkedIn|Peer-to-Peer|FedEx|Mail|Phone|Conference", "action": "specific 1-2 sentence next step", "rationale": "2-3 sentence why now and why this channel", "urgency": "high|medium|low" }`

      const userMsg = `Contact: ${contact.name}
Specialty: ${contact.specialty ?? 'Unknown'}
Owner: ${contact.ownerName}
Lead Status: ${contact.status}
Funnel Column: ${column}
Total Touches: ${contact.outreachCount}
Last Activity: ${contact.lastActivity ? new Date(contact.lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never contacted'}

Outreach History (most recent first):
${historyLines}`

      const data = await callAI({
        skill: 'contactRec',
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: userMsg }],
      })
      const text = data.content?.find((b: any) => b.type === 'text')?.text ?? ''
      const parsed: ContactRec = JSON.parse(text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim())
      setRec(parsed)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  const urgencyStyle = { high: 'bg-rose-50 text-rose-600', medium: 'bg-amber-50 text-amber-600', low: 'bg-gray-50 text-gray-500' }
  const channelStyle = CHANNEL_STYLES[rec?.channel ?? ''] ?? 'bg-gray-50 text-gray-600'

  return (
    <div className="mt-3 pt-3 border-t border-gray-100" onClick={e => e.stopPropagation()}>
      {status === 'idle' && (
        <button
          onClick={generate}
          className="w-full text-[10px] font-black uppercase tracking-widest py-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
        >
          ✦ Generate Next Touch
        </button>
      )}
      {status === 'loading' && (
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-indigo-400 animate-pulse py-1.5">Generating…</p>
      )}
      {status === 'error' && (
        <p className="text-center text-[10px] font-black uppercase text-red-400 py-1">Error — <button onClick={generate} className="underline">retry</button></p>
      )}
      {status === 'done' && rec && (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md flex-shrink-0 ${channelStyle}`}>{rec.channel}</span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${urgencyStyle[rec.urgency as keyof typeof urgencyStyle] ?? urgencyStyle.low}`}>{rec.urgency}</span>
          </div>
          <p className="text-xs text-gray-700 leading-relaxed">{rec.action}</p>
          <button
            onClick={e => { e.stopPropagation(); setShowRationale(r => !r) }}
            className="text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showRationale ? '▲ Hide' : '▼ Why?'}
          </button>
          {showRationale && (
            <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-lg p-2">{rec.rationale}</p>
          )}
          <button
            onClick={e => { e.stopPropagation(); setRec(null); setStatus('idle') }}
            className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors"
          >
            ↺ Regenerate
          </button>
        </div>
      )}
    </div>
  )
}

type ColumnContact = {
  contactId: string; name: string; specialty: string | null; ownerName: string
  status: string; tier1: boolean; dealStatus: string | null; outreachCount: number; lastActivity?: string
  closedNurtureReason?: string | null
}

const NURTURE_BUCKETS = [
  'Too Early / Timing',
  'Not Interested',
  'Model / Financial Mismatch',
  'Unresponsive',
  'Geography / Strategic Hold',
  'Complex Ownership',
] as const

function parseBucket(reason: string | null | undefined): { bucket: string; context: string } | null {
  if (!reason) return null
  const idx = reason.indexOf(' — ')
  if (idx === -1) return { bucket: reason, context: '' }
  return { bucket: reason.slice(0, idx).trim(), context: reason.slice(idx + 3).trim() }
}

function groupByBucket(list: ColumnContact[], dir: 'asc' | 'desc') {
  const sorted = [...list].sort((a, b) => {
    if (!a.lastActivity && !b.lastActivity) return 0
    if (!a.lastActivity) return dir === 'asc' ? -1 : 1
    if (!b.lastActivity) return dir === 'asc' ? 1 : -1
    const diff = new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()
    return dir === 'asc' ? diff : -diff
  })
  const bucketMap = new Map<string, ColumnContact[]>()
  const uncategorized: ColumnContact[] = []
  for (const c of sorted) {
    const parsed = parseBucket(c.closedNurtureReason)
    if (!parsed) { uncategorized.push(c); continue }
    const key = NURTURE_BUCKETS.find(b => b === parsed.bucket) ?? parsed.bucket
    if (!bucketMap.has(key)) bucketMap.set(key, [])
    bucketMap.get(key)!.push(c)
  }
  const ordered: { bucket: string; contacts: ColumnContact[] }[] = []
  for (const b of NURTURE_BUCKETS) {
    if (bucketMap.has(b)) ordered.push({ bucket: b, contacts: bucketMap.get(b)! })
  }
  // any unrecognized buckets
  for (const [b, contacts] of bucketMap) {
    if (!NURTURE_BUCKETS.includes(b as any)) ordered.push({ bucket: b, contacts })
  }
  if (uncategorized.length > 0) ordered.push({ bucket: 'Uncategorized', contacts: uncategorized })
  return ordered
}

function ContactCard({ c, column, accentColor, onOpen }: {
  c: ColumnContact
  column: string
  accentColor: { border: string; bg: string; icon: string; text: string; avatar: string }
  onOpen: (c: ColumnContact) => void
}) {
  return (
    <div className={`relative w-full bg-white border-2 rounded-xl shadow-sm hover:shadow-md transition-all text-left ${c.tier1 ? 'border-amber-300 bg-amber-50/40' : accentColor.border}`}>
      {/* Clickable header opens drawer */}
      <div className="p-4 cursor-pointer" onClick={() => onOpen(c)}>
        <span className="absolute top-3 right-3 text-[10px] font-black text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{c.outreachCount}</span>
        <div className="flex items-center gap-4 pr-8">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${c.tier1 ? 'bg-amber-100' : accentColor.avatar}`}>
            <User className={`w-5 h-5 ${c.tier1 ? 'text-amber-500' : accentColor.icon}`} />
          </div>
          <div>
            <h4 className="font-bold text-gray-900">{c.name}</h4>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
                <User className="w-3 h-3" />{c.ownerName}
              </span>
              {c.specialty && <span className="text-[10px] text-gray-400 uppercase tracking-tight">{c.specialty}</span>}
              {c.status && <span className="text-[10px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-bold">{c.status}</span>}
              {c.dealStatus && <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-bold">{c.dealStatus}</span>}
              {c.closedNurtureReason && (() => { const p = parseBucket(c.closedNurtureReason); return p?.context ? <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-bold">{p.context}</span> : null })()}
              <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${accentColor.text}`}>
                <Clock className="w-3 h-3" />{c.lastActivity ? formatDistanceToNow(new Date(c.lastActivity), { addSuffix: true }) : 'Never contacted'}
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* AI recommendation sits below, non-clickable for drawer */}
      <div className="px-4 pb-4">
        <ContactAIRec contact={c} column={column} />
      </div>
    </div>
  )
}

export default function FunnelPage() {
  const [filters, setFilters] = useState<FilterState | null>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [selectedContact, setSelectedContact] = useState<UniverseContact | null>(null)
  const [colSort, setColSort] = useState<Record<'staleTier1s' | 'openLeads' | 'closedNurture', 'asc' | 'desc'>>({
    staleTier1s: 'asc', openLeads: 'asc', closedNurture: 'asc',
  })

  const sortedList = (list: any[], dir: 'asc' | 'desc') =>
    [...list].sort((a, b) => {
      if (!a.lastActivity && !b.lastActivity) return 0
      if (!a.lastActivity) return dir === 'asc' ? -1 : 1
      if (!b.lastActivity) return dir === 'asc' ? 1 : -1
      const diff = new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()
      return dir === 'asc' ? diff : -diff
    })

  const toggleSort = (col: 'staleTier1s' | 'openLeads' | 'closedNurture') =>
    setColSort(prev => ({ ...prev, [col]: prev[col] === 'asc' ? 'desc' : 'asc' }))

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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic">BD Game Plan</h2>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Strategic Priorities & Follow-up Triggers</p>
        </div>
        {filters && (
          <a
            href={`/api/export/gameplan${buildFilterQS(filters).replace(/^&/, '?')}`}
            download
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-colors"
          >
            ↓ Export Excel
          </a>
        )}
      </div>

      <FilterBar onFilterChange={setFilters} showDateFilter={false} />

      {/* BD Strategy AI — always visible at top */}
      <BDStrategy filters={filters} />

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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
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
              <UniverseBucket
                count={data.universe.inPipeline.count}
                label="In Pipeline"
                sublabel="NDA · LOI · Pre-LOI"
                colorClass="text-violet-600"
                borderClass="border-violet-100"
                contacts={data.universe.inPipeline.contacts}
                onSelectContact={setSelectedContact}
              />
            </div>
          </section>

          {/* Tier 1 recency columns */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* Open Deal Tier 1 */}
          {(() => {
            const col = 'staleTier1s'
            const dir = colSort[col]
            const list = sortedList(data.staleTier1s, dir)
            return (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Open Deal</h3>
                        <span className="text-xs font-black text-rose-500 bg-rose-50 rounded-full px-2 py-0.5">{list.length}</span>
                      </div>
                      <button onClick={() => toggleSort(col)} className="flex items-center gap-1 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-700">
                        {dir === 'asc' ? <><ChevronUp className="w-3 h-3" />Oldest First</> : <><ChevronDown className="w-3 h-3" />Newest First</>}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-5">
                  {list.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">All clear!</p>
                    </div>
                  ) : groupByBucket(list, dir).map(({ bucket, contacts }) => (
                    <div key={bucket}>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{bucket}</span>
                        <span className="text-[10px] font-black text-rose-300 bg-rose-50 rounded-full px-1.5 py-0.5">{contacts.length}</span>
                        <div className="flex-1 h-px bg-rose-100" />
                      </div>
                      <div className="space-y-3">
                        {contacts.map((c: any) => (
                          <ContactCard
                            key={c.contactId}
                            c={c}
                            column="Open Deal"
                            accentColor={{ border: 'border-rose-50 hover:border-rose-200', bg: '', avatar: 'bg-rose-50', icon: 'text-rose-400', text: 'text-rose-400' }}
                            onOpen={c => setSelectedContact({ contactId: c.contactId, name: c.name, specialty: c.specialty, ownerName: c.ownerName })}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })()}

          {/* Open Lead */}
          {(() => {
            const col = 'openLeads'
            const dir = colSort[col]
            const list = sortedList(data.openLeads, dir)
            return (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-100 rounded-lg">
                      <User className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Initial Outreach</h3>
                        <span className="text-xs font-black text-sky-500 bg-sky-50 rounded-full px-2 py-0.5">{list.length}</span>
                      </div>
                      <button onClick={() => toggleSort(col)} className="flex items-center gap-1 text-[10px] font-black text-sky-500 uppercase tracking-widest hover:text-sky-700">
                        {dir === 'asc' ? <><ChevronUp className="w-3 h-3" />Oldest First</> : <><ChevronDown className="w-3 h-3" />Newest First</>}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {list.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No open leads.</p>
                    </div>
                  ) : list.map((c: any) => (
                    <ContactCard
                      key={c.contactId}
                      c={c}
                      column="Initial Outreach"
                      accentColor={{ border: 'border-sky-50 hover:border-sky-200', bg: '', avatar: 'bg-sky-50', icon: 'text-sky-400', text: 'text-sky-400' }}
                      onOpen={c => setSelectedContact({ contactId: c.contactId, name: c.name, specialty: c.specialty, ownerName: c.ownerName })}
                    />
                  ))}
                </div>
              </section>
            )
          })()}

          {/* Closed & Nurture */}
          {(() => {
            const col = 'closedNurture'
            const dir = colSort[col]
            const list = sortedList(data.closedNurture, dir)
            return (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Clock className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Closed & Nurture</h3>
                        <span className="text-xs font-black text-emerald-500 bg-emerald-50 rounded-full px-2 py-0.5">{list.length}</span>
                      </div>
                      <button onClick={() => toggleSort(col)} className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:text-emerald-700">
                        {dir === 'asc' ? <><ChevronUp className="w-3 h-3" />Oldest First</> : <><ChevronDown className="w-3 h-3" />Newest First</>}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {list.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No contacts in nurture.</p>
                    </div>
                  ) : list.map((c: any) => (
                    <ContactCard
                      key={c.contactId}
                      c={c}
                      column="Closed & Nurture"
                      accentColor={{ border: 'border-emerald-50 hover:border-emerald-200', bg: '', avatar: 'bg-emerald-50', icon: 'text-emerald-400', text: 'text-emerald-400' }}
                      onOpen={c => setSelectedContact({ contactId: c.contactId, name: c.name, specialty: c.specialty, ownerName: c.ownerName })}
                    />
                  ))}
                </div>
              </section>
            )
          })()}

          {/* Action Triggers — commented out, preserved for future use
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
            ...
          </section>
          */}

          </div>{/* end 3-col grid */}
        </div>
      )}
    </div>
  )
}
