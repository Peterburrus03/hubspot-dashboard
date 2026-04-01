'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, LabelList,
} from 'recharts'

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY = new Date()
const NDA_DEADLINE = new Date('2026-09-07')
const CURRENT_MONTH = TODAY.getMonth() + 1

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Per-week goals keyed by ISO week number (2026)
const WEEKLY_GOALS: Record<number, { contacts: number; ndas: number }> = {
  // March (5 weeks: Mar 2–Apr 5) — weeks 10-14
  10: { contacts: 74, ndas: 2 },
  11: { contacts: 74, ndas: 2 },
  12: { contacts: 74, ndas: 2 },
  13: { contacts: 74, ndas: 2 },
  14: { contacts: 74, ndas: 2 },
  // April (4 weeks: Apr 6–May 3) — weeks 15-18
  15: { contacts: 74, ndas: 2.5 },
  16: { contacts: 74, ndas: 2.5 },
  17: { contacts: 74, ndas: 2.5 },
  18: { contacts: 74, ndas: 2.5 },
  // May (4 weeks: May 4–May 31) — weeks 19-22
  19: { contacts: 74, ndas: 2.5 },
  20: { contacts: 74, ndas: 2.5 },
  21: { contacts: 74, ndas: 2.5 },
  22: { contacts: 74, ndas: 2.5 },
  // June (5 weeks: Jun 1–Jul 5) — weeks 23-27
  23: { contacts: 64, ndas: 2.2 },
  24: { contacts: 64, ndas: 2.2 },
  25: { contacts: 64, ndas: 2.2 },
  26: { contacts: 64, ndas: 2.2 },
  27: { contacts: 64, ndas: 2.2 },
  // July (4 weeks: Jul 6–Aug 2) — weeks 28-31
  28: { contacts: 60, ndas: 2 },
  29: { contacts: 60, ndas: 2 },
  30: { contacts: 60, ndas: 2 },
  31: { contacts: 60, ndas: 2 },
  // August (5 weeks: Aug 3–Sep 6) — weeks 32-36
  32: { contacts: 60, ndas: 1.8 },
  33: { contacts: 60, ndas: 1.8 },
  34: { contacts: 60, ndas: 1.8 },
  35: { contacts: 60, ndas: 1.8 },
  36: { contacts: 60, ndas: 1.8 },
  // September (deadline week: Sep 7) — week 37
  37: { contacts: 0, ndas: 2 },
}

const THIS_WEEK = getISOWeek(TODAY)
const THIS_WEEK_GOALS = WEEKLY_GOALS[THIS_WEEK] ?? { contacts: 68, ndas: 2 }

const STAGE_PLAN_DAYS: Record<string, number> = {
  'Engaged': 10,
  'Data Collection (including NDA)': 21,
  'Pre-LOI Analysis': 4,
  'Presented to Growth Committee': 4,
  'LOI Signed/Diligence': 55,
  'LOI Extended': 25,
  'APA Signed': 14,
  'Closed': 0,
}

const CRM_STAGE_COLORS: Record<string, string> = {
  'Engaged': '#818cf8',
  'Data Collection (including NDA)': '#a78bfa',
  'Pre-LOI Analysis': '#38bdf8',
  'Presented to Growth Committee': '#fbbf24',
  'LOI Signed/Diligence': '#f87171',
  'LOI Extended': '#fb923c',
  'APA Signed': '#34d399',
  'Closed': '#10b981',
}

const CRM_STAGE_ORDER = [
  'Engaged',
  'Data Collection (including NDA)',
  'Pre-LOI Analysis',
  'Presented to Growth Committee',
  'LOI Extended',
  'LOI Signed/Diligence',
  'APA Signed',
  'Closed',
]

const STAGE_SHORT: Record<string, string> = {
  'Engaged': 'Engaged',
  'Data Collection (including NDA)': 'NDA',
  'Pre-LOI Analysis': 'Pre-LOI',
  'Presented to Growth Committee': 'Cmte',
  'LOI Signed/Diligence': 'LOI',
  'LOI Extended': 'LOI Ext.',
  'APA Signed': 'APA',
  'Closed': 'Closed',
}

const TARGETS = {
  totalEBITDA: 18900,
  closedEBITDA: 0,
  totalNDAs: 60,
  totalLOIs: 45,
  totalAPAs: 23,
  totalOutreach: 1820,
  weeklyOutreach: 68,
  weeklyNDAs: 2,
  monthlyOutreach: { 3: 318, 4: 318, 5: 279, 6: 279, 7: 279, 8: 279, 9: 68 } as Record<number, number>,
  monthlyNDAs: { 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 6 } as Record<number, number>,
}

interface ActivityBreakdown { emails: number; calls: number; meetings: number }
interface PipelineActuals {
  wtdOutreach: number; mtdOutreach: number; ytdOutreach: number; lastWeekOutreach: number; qtdOutreach: number
  wtdNDAs: number; mtdNDAs: number; ytdNDAs: number; lastWeekNDAs: number; qtdNDAs: number
  ytdNDADvms: number; ytdLOIs: number; ytdAPAs: number; closedEBITDA: number
  breakdown?: { wtd: ActivityBreakdown; mtd: ActivityBreakdown; ytd: ActivityBreakdown; lastWeek: ActivityBreakdown; qtd: ActivityBreakdown }
}
interface WeekPoint { week: string; weekStart: string; outreach: number; ndas: number }

const DEFAULT_ACTUALS: PipelineActuals = {
  wtdOutreach: 0, mtdOutreach: 0, ytdOutreach: 0, lastWeekOutreach: 0, qtdOutreach: 0,
  wtdNDAs: 0, mtdNDAs: 0, ytdNDAs: 0, lastWeekNDAs: 0, qtdNDAs: 0,
  ytdNDADvms: 0, ytdLOIs: 0, ytdAPAs: 0, closedEBITDA: 0,
}



// ─── Types ────────────────────────────────────────────────────────────────────

interface DealItem {
  id: string
  name: string
  doctor: string
  specialty: string
  dvms: number
  ebitda: number       // in $K
  crmStage: string
  stageEnteredDate: string
  prob: number         // 0–1
  nextSteps: string
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function transformDeal(raw: any): DealItem {
  const nm = raw.dealName || ''
  const docMatch = nm.match(/\((?:Dr\.?\s*)?([^)]+)\)/)
  const doctor = docMatch ? docMatch[1].trim() : ''
  const name = nm.split('-(')[0].split('- (')[0].trim() || nm
  return {
    id: raw.dealId,
    name,
    doctor,
    specialty: raw.specialty || '',
    dvms: raw.numDvms ?? 0,
    ebitda: Math.round(raw.ebitda ?? raw.revenue ?? 0),  // already in $K
    crmStage: (raw.stage || 'Engaged').trim(),
    stageEnteredDate: raw.stageEnteredDate ? new Date(raw.stageEnteredDate).toISOString().split('T')[0] : '',
    prob: raw.probability ?? 0.1,  // already 0–1
    nextSteps: raw.nextStep || '',
  }
}

function daysInStage(d: DealItem): number {
  if (!d.stageEnteredDate) return 0
  return Math.max(0, Math.floor((TODAY.getTime() - new Date(d.stageEnteredDate).getTime()) / (1000 * 60 * 60 * 24)))
}

function estimatedCloseDate(deal: DealItem): Date {
  const r: Record<string, number> = {
    'Engaged': 115, 'Data Collection (including NDA)': 105, 'Pre-LOI Analysis': 80,
    'Presented to Growth Committee': 55, 'LOI Signed/Diligence': 55,
    'LOI Extended': 55, 'APA Signed': 15, 'Closed': 0,
  }
  const d = new Date(TODAY)
  d.setDate(d.getDate() + (r[deal.crmStage] || 115))
  return d
}

function isAtRisk(deal: DealItem): boolean {
  const days = daysInStage(deal)
  const plan = STAGE_PLAN_DAYS[deal.crmStage] || 14
  const close = estimatedCloseDate(deal)
  return days > plan || close > new Date('2026-12-31')
}

async function callAI(body: object): Promise<any> {
  const res = await fetch('/api/ai/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function fetchAIContext(deals: DealItem[], actuals: PipelineActuals): Promise<string> {
  const probWtd = (deals.reduce((s, d) => s + d.ebitda * d.prob, 0) / 1000).toFixed(1)
  const gap = ((TARGETS.totalEBITDA - deals.reduce((s, d) => s + d.ebitda * d.prob, 0)) / 1000).toFixed(1)
  const daysLeft = Math.max(0, Math.floor((NDA_DEADLINE.getTime() - TODAY.getTime()) / 86400000))
  const atRisk = deals.filter(isAtRisk).map((d) => d.name).join(', ') || 'None'

  const dealLines = deals.map((d) =>
    `- ${d.name}${d.doctor ? ` (${d.doctor})` : ''} | ${d.crmStage} | ${d.dvms} DVMs | $${(d.ebitda / 1000).toFixed(2)}M EBITDA | ${daysInStage(d)}d in stage | ${isAtRisk(d) ? 'AT RISK' : 'ok'}`
  ).join('\n')

  // Fetch universe, activity, and closed nurture deals in parallel
  const [gpRes, actRes, allDealsRes] = await Promise.all([
    fetch('/api/dashboard/gameplan').then(r => r.json()).catch(() => null),
    fetch('/api/dashboard/activity').then(r => r.json()).catch(() => null),
    fetch('/api/dashboard/pipeline?isOpenOnly=false').then(r => r.json()).catch(() => null),
  ])

  let universeSection = ''
  if (gpRes?.universe) {
    const u = gpRes.universe
    universeSection = `
ADDRESSABLE UNIVERSE (${u.total} owner-contacts):
- Interested: ${u.interested.count} (actively pursuing)
- Fair Game: ${u.fairGame.count} (assigned owner, no disposition)
- Not Now: ${u.notInterestedNow.count} (nurture bucket)
- Not Interested: ${u.notInterestedAtAll.count} (do not contact)

TOP INTERESTED CONTACTS:
${(u.interested.contacts as any[]).slice(0, 10).map((c: any) =>
  `  ${c.name} | ${c.specialty ?? '—'} | ${c.ownerName}${c.dealStage ? ` | Deal: ${c.dealStage}` : ''}`
).join('\n')}`
  }

  let touchSection = ''
  if (actRes?.byOwner) {
    // Flatten all follow-ups across owners, sort by touch count, take top 20
    const allContacts: { name: string; owner: string; touches: number; lastTouch: string | null }[] = []
    for (const owner of actRes.byOwner as any[]) {
      for (const fu of owner.followUps ?? []) {
        allContacts.push({
          name: fu.contactName,
          owner: owner.ownerName,
          touches: fu.touchCount,
          lastTouch: fu.lastTouch,
        })
      }
    }
    allContacts.sort((a, b) => b.touches - a.touches)
    const ownerSummary = (actRes.byOwner as any[]).map((o: any) =>
      `  ${o.ownerName}: ${o.emails} emails · ${o.calls} calls · ${o.meetings} meetings · ${o.tasks} sales activities`
    ).join('\n')

    touchSection = `
OUTREACH ACTIVITY (current period):
${ownerSummary}

MOST-TOUCHED CONTACTS (top 20 by touch count):
${allContacts.slice(0, 20).map(c =>
  `  ${c.name} | ${c.owner} | ${c.touches} touches | last: ${c.lastTouch ? new Date(c.lastTouch).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'unknown'}`
).join('\n')}`
  }

  let closedNurtureSection = ''
  if (allDealsRes?.deals) {
    const closedNurture = (allDealsRes.deals as any[])
      .filter((d: any) => d.stage === 'Closed Nurture')
      .map((d: any) => {
        const nm = d.dealName || ''
        const name = nm.split('-(')[0].split('- (')[0].trim() || nm
        return `- ${name} | ${d.specialty ?? '—'} | $${((d.ebitda ?? 0) / 1000).toFixed(2)}M EBITDA`
      })
    if (closedNurture.length > 0) {
      closedNurtureSection = `\nCLOSED NURTURE DEALS (${closedNurture.length} total — re-engagement candidates):\n${closedNurture.join('\n')}`
    }
  }

  return `You are an M&A pipeline analyst and BD strategy advisor for AOSN. Today is ${TODAY.toDateString()}.

TARGETS: $18.9M EBITDA | 60 NDAs | 23 APAs | 1,820 outreach | NDA DEADLINE: Sep 7 (${daysLeft} days)
ACTUALS YTD: ${actuals.ytdNDAs} NDAs | ${actuals.ytdLOIs} LOIs | ${actuals.ytdAPAs} APAs | ${actuals.ytdOutreach} outreach | $${(actuals.closedEBITDA / 1000).toFixed(1)}M closed
PIPELINE: $${probWtd}M prob-wtd EBITDA | Gap to target: $${gap}M | At risk: ${atRisk}

OPEN DEALS:
${dealLines}
${universeSection}
${touchSection}
${closedNurtureSection}`
}

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function lsSet(key: string, val: string) {
  try { localStorage.setItem(key, val) } catch {}
}

// ─── Style constants ──────────────────────────────────────────────────────────

const card = 'bg-zinc-900 rounded-xl border border-zinc-700 shadow-xl mb-6'
const cardPad = 'p-5'
const labelCls = 'text-xs font-semibold text-zinc-400 uppercase tracking-wider'
const h2Cls = 'text-lg font-bold text-white'
const mutedCls = 'text-zinc-400'

// ─── EBITDATargetBar ──────────────────────────────────────────────────────────

function EBITDATargetBar({ deals, closedEBITDA }: { deals: DealItem[]; closedEBITDA: number }) {
  const daysLeft = Math.max(0, Math.floor((NDA_DEADLINE.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24)))
  const probWtdEBITDA = Math.round(deals.reduce((s, d) => s + d.ebitda * d.prob, 0))
  const totalCredited = closedEBITDA + probWtdEBITDA
  const gap = Math.max(0, TARGETS.totalEBITDA - totalCredited)
  const closedPct = Math.min(100, (closedEBITDA / TARGETS.totalEBITDA) * 100)
  const probPct = Math.min(100 - closedPct, (probWtdEBITDA / TARGETS.totalEBITDA) * 100)

  return (
    <div className={card}><div className={cardPad}>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className={h2Cls}>2026 EBITDA Acquisition Target</h2>
          <p className={`text-xs ${mutedCls} mt-0.5`}>$18.9M target · closed + prob-weighted pipeline vs. gap</p>
        </div>
        <div className="rounded-xl px-5 py-3 border border-amber-500/40 bg-amber-500/10 text-center">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wide">⏰ Days to NDA Deadline</div>
          <div className="text-4xl font-black text-amber-400">{daysLeft}</div>
          <div className="text-xs text-zinc-400">Sep 7, 2026</div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Closed EBITDA', val: closedEBITDA, color: '#34d399' },
          { label: 'Prob-Wtd Pipeline', val: probWtdEBITDA, color: '#818cf8' },
          { label: 'Total Credited', val: totalCredited, color: '#38bdf8' },
          { label: 'Gap to Target', val: gap, color: gap > 10000 ? '#f87171' : gap > 5000 ? '#fbbf24' : '#34d399' },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
            <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1">{s.label}</div>
            <div className="text-2xl font-black" style={{ color: s.color }}>${(s.val / 1000).toFixed(1)}M</div>
          </div>
        ))}
      </div>
      <div className="mb-5">
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          <span>$0</span>
          <span className="font-semibold text-zinc-300">{Math.round(closedPct + probPct)}% of $18.9M</span>
          <span>$18.9M</span>
        </div>
        <div className="w-full bg-zinc-700 rounded-full h-5 flex overflow-hidden">
          <div className="h-5 bg-emerald-500 flex items-center justify-center" style={{ width: closedPct + '%' }}>
            {closedPct > 3 && <span className="text-xs text-white font-bold">Closed</span>}
          </div>
          <div className="h-5 bg-indigo-500 flex items-center justify-center" style={{ width: probPct + '%' }}>
            {probPct > 5 && <span className="text-xs text-white font-bold">Pipeline</span>}
          </div>
          <div className="h-5 bg-red-900/60 flex-1 flex items-center justify-center">
            {gap > 0 && <span className="text-xs text-red-300 font-bold">${(gap / 1000).toFixed(1)}M Gap</span>}
          </div>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-zinc-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Closed: ${(closedEBITDA / 1000).toFixed(1)}M</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />Prob-Wtd: ${(probWtdEBITDA / 1000).toFixed(1)}M</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-900 inline-block" />Gap: ${(gap / 1000).toFixed(1)}M</span>
        </div>
      </div>
      <div className="border-t border-zinc-700 pt-4">
        <div className={`${labelCls} mb-3`}>EBITDA by Stage</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CRM_STAGE_ORDER.filter((s) => s !== 'Closed').map((stage) => {
            const sd = deals.filter((d) => d.crmStage === stage)
            const total = sd.reduce((s, d) => s + d.ebitda, 0)
            if (!total) return null
            const lbl = STAGE_SHORT[stage] || stage
            return (
              <div key={stage} className="flex items-center gap-2 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 flex-shrink-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CRM_STAGE_COLORS[stage] }} />
                <span className="text-xs text-zinc-400 font-medium">{lbl}</span>
                <span className="text-sm font-black text-white">${(total / 1000).toFixed(1)}M</span>
                <span className="text-xs text-zinc-500">({sd.length})</span>
              </div>
            )
          })}
        </div>
      </div>
    </div></div>
  )
}

// ─── MiniGauge ────────────────────────────────────────────────────────────────

function MiniGauge({ actual, goal, color, label: lbl, sublabel }: {
  actual: number; goal: number; color: string; label: string; sublabel: string
}) {
  const pct = Math.min(100, Math.round((actual / goal) * 100))
  const over = actual >= goal
  const r = 28, circ = 2 * Math.PI * r, fill = (pct / 100) * circ
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 72 72" className="w-20 h-20 -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#3f3f46" strokeWidth="7" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={over ? '#34d399' : color} strokeWidth="7"
            strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black leading-none" style={{ color: over ? '#34d399' : color }}>{actual}</span>
          <span className="text-xs text-zinc-500 leading-none">/{goal}</span>
        </div>
      </div>
      <div className="text-xs font-semibold text-zinc-300 mt-1 text-center">{lbl}</div>
      <div className="text-xs text-zinc-500 text-center">{sublabel}</div>
      <div className="text-xs font-bold mt-0.5" style={{ color: over ? '#34d399' : pct < 50 ? '#f87171' : '#fbbf24' }}>{pct}%</div>
    </div>
  )
}

// ─── OutreachSection ──────────────────────────────────────────────────────────

type OutreachPeriod = 'wtd' | 'last_week' | 'historical'

function OutreachSection({ actuals, weeklyHistory, lastWeekStart }: { actuals: PipelineActuals; weeklyHistory: WeekPoint[]; lastWeekStart: string }) {
  const [showDetail, setShowDetail] = useState(false)
  const [period, setPeriod] = useState<OutreachPeriod>('last_week')
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('')
  const mGoal = TARGETS.monthlyOutreach[CURRENT_MONTH] || 318
  const mNdaGoal = TARGETS.monthlyNDAs[CURRENT_MONTH] || 9
  const chartStyle = { fontSize: 10, fill: '#71717a' }
  const conversionRate = actuals.ytdOutreach > 0 ? ((actuals.ytdNDAs / actuals.ytdOutreach) * 100).toFixed(1) : '—'

  const selectedPoint = weeklyHistory.find(w => w.weekStart === selectedWeekStart) ?? null
  const historicalGoals = selectedPoint ? (WEEKLY_GOALS[getISOWeek(new Date(selectedPoint.weekStart))] ?? THIS_WEEK_GOALS) : THIS_WEEK_GOALS

  const lastWeekPoint = weeklyHistory.find(w => w.weekStart === lastWeekStart) ?? null
  const activeOutreach = period === 'wtd' ? actuals.wtdOutreach : period === 'last_week' ? (lastWeekPoint?.outreach ?? actuals.lastWeekOutreach) : (selectedPoint?.outreach ?? 0)
  const activeNDAs     = period === 'wtd' ? actuals.wtdNDAs     : period === 'last_week' ? (lastWeekPoint?.ndas     ?? actuals.lastWeekNDAs)     : (selectedPoint?.ndas ?? 0)
  const activeGoal     = period === 'historical' ? historicalGoals.contacts : THIS_WEEK_GOALS.contacts
  const activeNdaGoal  = period === 'historical' ? historicalGoals.ndas     : THIS_WEEK_GOALS.ndas
  const activeLabel    = period === 'wtd' ? 'WTD' : period === 'last_week' ? 'Last Week' : (selectedPoint?.week ?? 'Selected')
  const breakdownKey   = period === 'last_week' ? 'lastWeek' : 'wtd'

  // Compute MTD/YTD up to the reference week end (historical or last_week)
  const refWeekStart = period === 'historical' ? selectedWeekStart : period === 'last_week' ? lastWeekStart : ''
  const refDate = refWeekStart ? new Date(refWeekStart) : null

  const displayMtdOutreach = refDate
    ? weeklyHistory
        .filter(w => w.weekStart <= refWeekStart && new Date(w.weekStart).getUTCMonth() === refDate.getUTCMonth() && new Date(w.weekStart).getUTCFullYear() === refDate.getUTCFullYear())
        .reduce((sum, w) => sum + w.outreach, 0)
    : actuals.mtdOutreach
  const displayYtdOutreach = refDate
    ? weeklyHistory.filter(w => w.weekStart <= refWeekStart).reduce((sum, w) => sum + w.outreach, 0)
    : actuals.ytdOutreach
  const displayMtdNDAs = refDate
    ? weeklyHistory
        .filter(w => w.weekStart <= refWeekStart && new Date(w.weekStart).getUTCMonth() === refDate.getUTCMonth() && new Date(w.weekStart).getUTCFullYear() === refDate.getUTCFullYear())
        .reduce((sum, w) => sum + w.ndas, 0)
    : actuals.mtdNDAs
  const displayYtdNDAs = refDate
    ? weeklyHistory.filter(w => w.weekStart <= refWeekStart).reduce((sum, w) => sum + w.ndas, 0)
    : actuals.ytdNDAs

  const TYPE_META = [
    { key: 'emails' as const, label: 'Emails', icon: '✉️', color: '#818cf8' },
    { key: 'calls' as const, label: 'Calls', icon: '📞', color: '#34d399' },
    { key: 'meetings' as const, label: 'Meetings', icon: '🤝', color: '#fbbf24' },
    // Sales Activity (tasks) shown as total in breakdown — categories visible on Activity tab
  ]
  return (
    <div className={card}><div className={cardPad}>
      <div className="flex items-center justify-between mb-0.5">
        <h2 className={h2Cls}>Outreach & NDA Tracker</h2>
        <div className="flex items-center gap-2">
          {(['wtd', 'last_week'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${period === p ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700'}`}>
              {p === 'wtd' ? 'WTD' : 'Last Week'}
            </button>
          ))}
          <select
            value={period === 'historical' ? selectedWeekStart : ''}
            onChange={e => { setSelectedWeekStart(e.target.value); setPeriod('historical') }}
            className={`text-xs bg-zinc-800 border text-zinc-300 rounded-lg px-2 py-1.5 focus:outline-none ${period === 'historical' ? 'border-indigo-500' : 'border-zinc-600'}`}
          >
            <option value="">Select week…</option>
            {[...weeklyHistory].reverse().map((w) => (
              <option key={w.weekStart ?? w.week} value={w.weekStart ?? ''}>{w.week}</option>
            ))}
          </select>
        </div>
      </div>
      <p className={`text-xs ${mutedCls} mb-5 mt-0.5`}>{THIS_WEEK_GOALS.contacts} contacts/week · {THIS_WEEK_GOALS.ndas} NDAs/week · 1,820 total by Sep 7</p>
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <div className="text-xs font-bold text-indigo-400 uppercase tracking-wide mb-3">📞 Outreach Contacts</div>
          <div className="flex justify-around">
            <MiniGauge actual={activeOutreach} goal={activeGoal} color="#818cf8" label={activeLabel} sublabel={`goal ${activeGoal}`} />
            <MiniGauge actual={displayMtdOutreach} goal={mGoal} color="#818cf8" label="MTD" sublabel={`goal ${mGoal}`} />
            <MiniGauge actual={displayYtdOutreach} goal={TARGETS.totalOutreach} color="#818cf8" label="YTD" sublabel={`goal ${TARGETS.totalOutreach}`} />
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-purple-400 uppercase tracking-wide mb-3">📋 NDAs Signed</div>
          <div className="flex justify-around">
            <MiniGauge actual={activeNDAs} goal={activeNdaGoal} color="#c084fc" label={activeLabel} sublabel={`goal ${activeNdaGoal}`} />
            <MiniGauge actual={displayMtdNDAs} goal={mNdaGoal} color="#c084fc" label="MTD" sublabel={`goal ${mNdaGoal}`} />
            <MiniGauge actual={displayYtdNDAs} goal={TARGETS.totalNDAs} color="#c084fc" label="YTD" sublabel={`goal ${TARGETS.totalNDAs}`} />
          </div>
        </div>
      </div>
      <div className="border-t border-zinc-700 pt-4">
        <div className={`${labelCls} mb-3`}>Weekly Trend</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-indigo-400 mb-2">Outreach Contacts / Week</div>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={weeklyHistory} margin={{ top: 8, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                <XAxis dataKey="week" tick={chartStyle} axisLine={false} tickLine={false} />
                <YAxis tick={chartStyle} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} labelStyle={{ color: '#e4e4e7', fontWeight: 700 }} itemStyle={{ color: '#818cf8' }} />
                <ReferenceLine y={68} stroke="#818cf8" strokeDasharray="5 3" strokeOpacity={0.5} />
                <Line type="monotone" dataKey="outreach" stroke="#818cf8" strokeWidth={2.5} dot={{ fill: '#818cf8', r: 4, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="text-xs font-semibold text-purple-400 mb-2">NDAs Signed / Week</div>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={weeklyHistory} margin={{ top: 8, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                <XAxis dataKey="week" tick={chartStyle} axisLine={false} tickLine={false} />
                <YAxis tick={chartStyle} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} labelStyle={{ color: '#e4e4e7', fontWeight: 700 }} itemStyle={{ color: '#c084fc' }} />
                <ReferenceLine y={2} stroke="#c084fc" strokeDasharray="5 3" strokeOpacity={0.5} />
                <Line type="monotone" dataKey="ndas" stroke="#c084fc" strokeWidth={2.5} dot={{ fill: '#c084fc', r: 4, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <button onClick={() => setShowDetail((v) => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1">
            {showDetail ? '▲ Hide breakdown' : '▼ Activity by type'}
          </button>
          <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1">
            ⚠ {conversionRate}% conversion vs 4.4% target
          </span>
        </div>

        {showDetail && actuals.breakdown && (
          <div className="mt-4 border-t border-zinc-700 pt-4">
            <div className={`${labelCls} mb-3`}>Activity by type — {activeLabel}</div>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-zinc-500 font-semibold pb-2 w-32">Type</th>
                  <th className="text-right text-zinc-500 font-semibold pb-2">{activeLabel}</th>
                  <th className="text-right text-zinc-500 font-semibold pb-2">MTD</th>
                  <th className="text-right text-zinc-500 font-semibold pb-2">YTD</th>
                </tr>
              </thead>
              <tbody>
                {TYPE_META.map(({ key, label, icon, color }) => (
                  <tr key={key} className="border-t border-zinc-800">
                    <td className="py-2 flex items-center gap-1.5">
                      <span>{icon}</span>
                      <span style={{ color }} className="font-semibold">{label}</span>
                    </td>
                    <td className="text-right text-zinc-300 font-mono py-2">{actuals.breakdown![breakdownKey as 'wtd' | 'mtd' | 'ytd' | 'lastWeek' | 'qtd'][key]}</td>
                    <td className="text-right text-zinc-300 font-mono py-2">{actuals.breakdown!.mtd[key]}</td>
                    <td className="text-right text-zinc-300 font-mono py-2">{actuals.breakdown!.ytd[key]}</td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-700">
                  <td className="py-2 text-zinc-400 font-bold">Total</td>
                  <td className="text-right text-white font-bold font-mono py-2">{activeOutreach}</td>
                  <td className="text-right text-white font-bold font-mono py-2">{displayMtdOutreach}</td>
                  <td className="text-right text-white font-bold font-mono py-2">{displayYtdOutreach}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div></div>
  )
}

// ─── PipelineVelocityScorecard ───────────────────────────────────────────────

const SCORECARD_COLS = [
  { key: 'engagedToNda', label: 'Engaged → NDA', goal: 21 },
  { key: 'ndaToLoi',     label: 'NDA → LOI',     goal: 30 },
  { key: 'loiToApa',     label: 'LOI → APA',     goal: 55 },
  { key: 'apaToClose',   label: 'APA → Close',   goal: 14 },
] as const
type ScorecardColKey = typeof SCORECARD_COLS[number]['key']

function daysBetweenStr(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  return Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}
function daysSinceStr(d: string | null): number | null {
  if (!d) return null
  return Math.max(0, Math.floor((TODAY.getTime() - new Date(d).getTime()) / 86400000))
}

function VelocityBadge({ days, goal }: { days: number; goal: number }) {
  const diff = days - goal
  if (diff === 0) return <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-500">+0d</span>
  if (diff > 0)   return <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-red-950 text-red-400">+{diff}d</span>
  return           <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-950 text-emerald-400">{diff}d</span>
}

function VelocityCell({ days, goal, isCurrent }: { days: number | null; goal: number; isCurrent: boolean }) {
  if (days === null) return <span className="text-zinc-600">—</span>
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={isCurrent ? 'text-zinc-200 font-medium' : 'text-zinc-400'}>{days}d</span>
      <VelocityBadge days={days} goal={goal} />
    </div>
  )
}

// Sub-phase breakdown panel for NDA→LOI column
function NdaToLoiPanel({ preLoiStages }: { preLoiStages: PreLoiStage[] }) {
  const maxDays = Math.max(...preLoiStages.map(s => s.days ?? 0), 1)
  const PARTY_COLOR: Record<string, string> = {
    seller:       '#fb7185',
    internal:     '#2dd4bf',
    unattributed: '#52525b',
  }
  return (
    <div className="space-y-2.5">
      {preLoiStages.map((s, i) => {
        const days = s.days
        const barPct = days !== null ? Math.max((days / maxDays) * 100, 1) : 0
        const color = PARTY_COLOR[s.party] ?? '#52525b'
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-52 text-xs text-zinc-400 shrink-0 leading-tight">{s.label}</div>
            <div className="flex-1 bg-zinc-800 rounded-sm h-3 overflow-hidden">
              {days !== null && (
                <div className="h-3 rounded-sm" style={{ width: `${barPct}%`, background: color }} />
              )}
            </div>
            <div className="w-10 text-xs text-right shrink-0" style={{ color: days !== null ? color : '#52525b' }}>
              {days !== null ? `${days}d` : '—'}
            </div>
          </div>
        )
      })}
      <div className="flex gap-4 pt-1">
        {[['#fb7185','Seller'],['#2dd4bf','Internal'],['#52525b','Untracked']].map(([c,l]) => (
          <span key={l} className="flex items-center gap-1 text-xs text-zinc-500">
            <span className="w-2 h-2 rounded-sm inline-block shrink-0" style={{ background: c }} />{l}
          </span>
        ))}
      </div>
    </div>
  )
}

function PipelineVelocityScorecard({ deals }: { deals: DealItem[] }) {
  const [vintageDeals, setVintageDeals] = useState<VintageDeal[]>([])
  const [expandedCell, setExpandedCell] = useState<{ rowId: string; colKey: ScorecardColKey } | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/vintages')
      .then(r => r.json())
      .then((d: { vintages?: VintageRow[] }) => {
        if (d.vintages) setVintageDeals(d.vintages.flatMap(r => r.deals))
      })
      .catch(console.error)
  }, [])

  const stageRank = Object.fromEntries(CRM_STAGE_ORDER.map((s, i) => [s, i]))
  const activeDeals = deals
    .filter(d => d.crmStage !== 'Closed' && d.crmStage !== 'APA Signed')
    .sort((a, b) => stageRank[b.crmStage] - stageRank[a.crmStage])

  const rows = activeDeals.map(deal => {
    const vd = vintageDeals.find(v => v.dealId === deal.id)

    const currentPhase: ScorecardColKey | null =
      !vd?.ndaSignedDate             ? 'engagedToNda' :
      !vd?.loiSignedDate             ? 'ndaToLoi'     :
      !vd?.integrationCompletionDate ? 'loiToApa'     :
      !vd?.officialClosedDate        ? 'apaToClose'   : null

    const phases: Record<ScorecardColKey, number | null> = {
      engagedToNda: currentPhase === 'engagedToNda'
        ? daysSinceStr(vd?.engagedDate ?? null)
        : daysBetweenStr(vd?.engagedDate ?? null, vd?.ndaSignedDate ?? null),
      ndaToLoi: currentPhase === 'ndaToLoi'
        ? daysSinceStr(vd?.ndaSignedDate ?? null)
        : currentPhase === 'engagedToNda' ? null
        : daysBetweenStr(vd?.ndaSignedDate ?? null, vd?.loiSignedDate ?? null),
      loiToApa: currentPhase === 'loiToApa'
        ? daysSinceStr(vd?.loiSignedDate ?? null)
        : (currentPhase === 'engagedToNda' || currentPhase === 'ndaToLoi') ? null
        : daysBetweenStr(vd?.loiSignedDate ?? null, vd?.integrationCompletionDate ?? null),
      apaToClose: currentPhase === 'apaToClose'
        ? daysSinceStr(vd?.integrationCompletionDate ?? null)
        : currentPhase !== null ? null
        : daysBetweenStr(vd?.integrationCompletionDate ?? null, vd?.officialClosedDate ?? null),
    }

    const totalDays = Object.values(phases).reduce<number>((s, v) => s + (v ?? 0), 0)
    return { deal, phases, currentPhase, totalDays }
  })

  const avgTotalDays = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.totalDays, 0) / rows.length)
    : null

  // Static closed-deal examples with APA_DEAL_DATA reference for drill-down
  const staticRows: { name: string; apaDealName: string; phases: Record<ScorecardColKey, number | null>; totalDays: number }[] = [
    {
      name: 'Dr. Casey Stepnik',
      apaDealName: 'Great Lakes Veterinary Dermatology',
      phases: { engagedToNda: null, ndaToLoi: 367, loiToApa: 65, apaToClose: 27 },
      totalDays: 459,
    },
    {
      name: 'Dr. Judy Force',
      apaDealName: 'Dentistry for Animals',
      phases: { engagedToNda: null, ndaToLoi: 134, loiToApa: 55, apaToClose: 18 },
      totalDays: 207,
    },
  ]

  const toggleCell = (rowId: string, colKey: ScorecardColKey) => {
    setExpandedCell(prev =>
      prev?.rowId === rowId && prev?.colKey === colKey ? null : { rowId, colKey }
    )
  }

  const isExpanded = (rowId: string, colKey: ScorecardColKey) =>
    expandedCell?.rowId === rowId && expandedCell?.colKey === colKey

  const thCls = 'text-left py-2 pr-6 text-xs font-semibold text-zinc-500 whitespace-nowrap border-b border-zinc-800 pb-3'
  const tdCls = 'py-3 pr-6 border-b border-zinc-800/50 align-top'

  return (
    <div className={card}><div className={cardPad}>
      <div className="mb-5">
        <h2 className={h2Cls}>Pipeline Velocity Scorecard</h2>
        <p className={`text-xs ${mutedCls} mt-0.5`}>Days per milestone phase · badge vs. goal · bright = current · click NDA→LOI for breakdown</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr>
              <th className={`${thCls} min-w-[140px]`}>Deal</th>
              <th className={thCls}>EBITDA</th>
              <th className={thCls}>Stage</th>
              {SCORECARD_COLS.map(col => (
                <th key={col.key} className={thCls}>
                  {col.label}
                  <span className="block text-zinc-600 font-normal mt-0.5">goal: {col.goal}d</span>
                </th>
              ))}
              <th className={thCls}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ deal, phases, currentPhase, totalDays }) => {
              const apaDeal = APA_DEAL_DATA.find(d =>
                deal.name.toLowerCase().includes(d.dealName.toLowerCase()) ||
                d.dealName.toLowerCase().includes(deal.name.toLowerCase())
              )
              const expanded = isExpanded(deal.id, 'ndaToLoi')
              return (
                <tr key={deal.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className={tdCls}>
                    <div className="font-medium text-zinc-200 text-sm">{deal.name}</div>
                    {deal.doctor && <div className="text-xs text-zinc-500 mt-0.5">{deal.doctor}</div>}
                  </td>
                  <td className={`${tdCls} text-zinc-400 text-sm`}>
                    {deal.ebitda > 0 ? `$${(deal.ebitda / 1000).toFixed(1)}M` : '—'}
                  </td>
                  <td className={`${tdCls} text-xs`}>
                    <span className="font-medium" style={{ color: CRM_STAGE_COLORS[deal.crmStage] ?? '#a1a1aa' }}>
                      {STAGE_SHORT[deal.crmStage] ?? deal.crmStage}
                    </span>
                  </td>
                  {SCORECARD_COLS.map(col => (
                    <td
                      key={col.key}
                      className={`${tdCls}${col.key === 'ndaToLoi' ? ' cursor-pointer' : ''}`}
                      onClick={col.key === 'ndaToLoi' ? () => toggleCell(deal.id, col.key) : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        <VelocityCell days={phases[col.key]} goal={col.goal} isCurrent={currentPhase === col.key} />
                        {col.key === 'ndaToLoi' && phases[col.key] !== null && (
                          <span className="text-zinc-600 text-xs">{expanded ? '▲' : '▼'}</span>
                        )}
                      </div>
                      {col.key === 'ndaToLoi' && expanded && (
                        <div className="mt-3 min-w-[280px]">
                          {apaDeal?.preLoiStages?.length
                            ? <NdaToLoiPanel preLoiStages={apaDeal.preLoiStages} />
                            : <p className="text-xs text-zinc-600 italic leading-relaxed">Sub-phase dates not yet tracked —<br/>needs HubSpot custom fields</p>
                          }
                        </div>
                      )}
                    </td>
                  ))}
                  <td className={`${tdCls} font-medium text-zinc-300 text-sm`}>
                    {totalDays > 0 ? `${totalDays}d` : '—'}
                  </td>
                </tr>
              )
            })}
            {/* Avg row */}
            {rows.length > 0 && (() => {
              const avgPhases = SCORECARD_COLS.map(col => {
                const vals = rows.map(r => r.phases[col.key]).filter((v): v is number => v !== null)
                return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
              })
              return (
                <tr className="bg-zinc-900/60">
                  <td className="py-3 pr-6 text-xs font-semibold text-zinc-500" colSpan={3}>Avg — active deals</td>
                  {avgPhases.map((avg, i) => (
                    <td key={SCORECARD_COLS[i].key} className="py-3 pr-6">
                      {avg !== null
                        ? <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-zinc-300 text-sm">{avg}d</span>
                            <VelocityBadge days={avg} goal={SCORECARD_COLS[i].goal} />
                          </div>
                        : <span className="text-zinc-600">—</span>}
                    </td>
                  ))}
                  <td className="py-3 text-sm font-semibold text-zinc-300">
                    {avgTotalDays !== null ? `${avgTotalDays}d` : '—'}
                  </td>
                </tr>
              )
            })()}
            {/* Closed examples section label */}
            <tr>
              <td colSpan={3 + SCORECARD_COLS.length + 1} className="pt-6 pb-2 text-xs font-semibold text-zinc-600 uppercase tracking-widest border-t border-zinc-800">
                Closed examples
              </td>
            </tr>
            {staticRows.map(row => {
              const apaDeal = APA_DEAL_DATA.find(d => d.dealName === row.apaDealName)
              const expanded = isExpanded(row.name, 'ndaToLoi')
              return (
                <tr key={row.name} className="border-b border-zinc-800/40 last:border-0">
                  <td className="py-2.5 pr-6 align-top">
                    <div className="font-medium text-zinc-400 text-sm">{row.name}</div>
                    <div className="text-xs text-zinc-600 mt-0.5">Closed</div>
                  </td>
                  <td className="py-2.5 pr-6 text-zinc-600 text-sm align-top">—</td>
                  <td className="py-2.5 pr-6 text-zinc-600 text-xs align-top">Closed</td>
                  {SCORECARD_COLS.map(col => (
                    <td
                      key={col.key}
                      className={`py-2.5 pr-6 align-top${col.key === 'ndaToLoi' ? ' cursor-pointer' : ''}`}
                      onClick={col.key === 'ndaToLoi' ? () => toggleCell(row.name, col.key) : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        <VelocityCell days={row.phases[col.key]} goal={col.goal} isCurrent={false} />
                        {col.key === 'ndaToLoi' && row.phases[col.key] !== null && (
                          <span className="text-zinc-600 text-xs">{expanded ? '▲' : '▼'}</span>
                        )}
                      </div>
                      {col.key === 'ndaToLoi' && expanded && (
                        <div className="mt-3 min-w-[280px]">
                          {apaDeal?.preLoiStages?.length
                            ? <NdaToLoiPanel preLoiStages={apaDeal.preLoiStages} />
                            : <p className="text-xs text-zinc-600 italic">No sub-phase data</p>
                          }
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="py-2.5 text-sm font-medium text-zinc-400 align-top">{row.totalDays}d</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div></div>
  )
}

// ─── TopPriorities ────────────────────────────────────────────────────────────

function TopPriorities({ deals, actuals }: { deals: DealItem[]; actuals: PipelineActuals }) {
  const EMPTY = [1, 2, 3, 4, 5].map((id) => ({ id, text: '', impact: '', done: false }))
  const [priorities, setPriorities] = useState(EMPTY)
  const [aiRows, setAiRows] = useState<{ priority: string; impact: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/priorities')
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) setPriorities(rows)
      })
      .catch(console.error)
  }, [])

  const save = (updated: typeof EMPTY) => {
    setPriorities(updated)
    fetch('/api/dashboard/priorities', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(console.error)
  }
  const update = (id: number, f: string, v: string | boolean) =>
    save(priorities.map((p) => (p.id === id ? { ...p, [f]: v } : p)))
  const toggle = (id: number) =>
    save(priorities.map((p) => (p.id === id ? { ...p, done: !p.done } : p)))

  const generate = async () => {
    if (loading) return
    setLoading(true)
    try {
      const ctx = await fetchAIContext(deals, actuals)
      const loiDeals = deals.filter((d) => ['LOI Signed/Diligence', 'LOI Extended'].includes(d.crmStage))

      // Generate impact for manual priorities if any are filled
      const filledPriorities = priorities.filter((p) => p.text.trim())
      if (filledPriorities.length > 0) {
        const priorityList = priorities.map((p, i) => `${i + 1}. ${p.text.trim() || '(empty)'}`).join('\n')
        const impactPrompt = `The team has set the following priorities for this week:\n${priorityList}\n\nFor each priority, generate a concise impact statement (max 10 words) grounded in the pipeline and universe data provided. Return ONLY a raw JSON array of exactly 5 objects with one field: "impact". No markdown, no explanation.`
        const impactData = await callAI({ model: 'claude-sonnet-4-6', max_tokens: 300, system: ctx, messages: [{ role: 'user', content: impactPrompt }] })
        const impactRaw = impactData.content?.find((b: any) => b.type === 'text')?.text || '[]'
        const impactArr = JSON.parse(impactRaw.replace(/```json|```/g, '').trim())
        save(priorities.map((p, i) => ({ ...p, impact: impactArr[i]?.impact || p.impact })))
      }

      // Generate AI-suggested priorities + impact
      const aiPrompt = `LOI DEALS: ${loiDeals.map((d) => `${d.name} $${(d.ebitda / 1000).toFixed(1)}M`).join('; ') || 'None'}\n\nBased on the full pipeline, universe, and outreach data provided, identify the 5 highest-impact priorities for this week. For each, write a short action-oriented priority (max 8 words) and a concise impact statement (max 10 words) grounded in specific contacts, touch counts, deal names, or metric gaps. Return ONLY a raw JSON array of exactly 5 objects with fields: "priority" and "impact". No markdown, no explanation.`
      const aiData = await callAI({ model: 'claude-sonnet-4-6', max_tokens: 500, system: ctx, messages: [{ role: 'user', content: aiPrompt }] })
      const aiRaw = aiData.content?.find((b: any) => b.type === 'text')?.text || '[]'
      const aiArr = JSON.parse(aiRaw.replace(/```json|```/g, '').trim())
      setAiRows(aiArr)
    } catch (e) {
      console.error('Generation failed:', e)
    }
    setLoading(false)
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Manual priorities */}
      <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>This Week — Top Priorities <span style={{ color: '#71717a', fontWeight: 400, fontSize: 12 }}>(work in progress)</span></div>
            <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>Enter your priorities manually · click Generate to fill impact and get AI suggestions below</div>
          </div>
          <button onClick={generate} disabled={loading}
            style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {loading ? '⏳ Generating…' : '✦ Generate'}
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#27272a' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#71717a', fontSize: 11, fontWeight: 600, width: 32 }}>#</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#a1a1aa', fontSize: 11, fontWeight: 600 }}>Priority</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#a1a1aa', fontSize: 11, fontWeight: 600, width: 60 }}>Done</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#a1a1aa', fontSize: 11, fontWeight: 600 }}>Impact</th>
            </tr>
          </thead>
          <tbody>
            {priorities.map((p, i) => (
              <tr key={p.id} style={{ borderTop: '1px solid #27272a', background: p.done ? 'rgba(6,78,59,0.2)' : 'transparent' }}>
                <td style={{ padding: '8px 12px', color: '#52525b', fontSize: 11, fontWeight: 600 }}>{i + 1}</td>
                <td style={{ padding: '8px 12px' }}>
                  <input type="text" value={p.text} placeholder="Enter priority…"
                    onChange={(e) => update(p.id, 'text', e.target.value)}
                    style={{ width: '100%', background: 'transparent', border: '1px solid #3f3f46', borderRadius: 6, padding: '6px 10px', color: p.done ? '#52525b' : '#f4f4f5', fontSize: 13, outline: 'none', textDecoration: p.done ? 'line-through' : 'none', boxSizing: 'border-box' }} />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <span onClick={() => toggle(p.id)} style={{ fontSize: 22, cursor: 'pointer', color: p.done ? '#34d399' : '#3f3f46', userSelect: 'none' }}>✓</span>
                </td>
                <td style={{ padding: '8px 16px', maxWidth: 320 }}>
                  {loading
                    ? <div style={{ height: 14, background: '#27272a', borderRadius: 4, width: '60%' }} />
                    : p.impact
                    ? <span style={{ color: '#e4e4e7', fontSize: 12, lineHeight: '1.5' }}>{p.impact}</span>
                    : <span style={{ color: '#3f3f46', fontSize: 12, fontStyle: 'italic' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* AI-generated priorities */}
      {(aiRows.length > 0 || loading) && (
        <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #3f3f46' }}>
            <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: 13 }}>✦ AI-Suggested Priorities</div>
            <div style={{ color: '#52525b', fontSize: 11, marginTop: 2 }}>Generated from current pipeline data</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#27272a' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#71717a', fontSize: 11, fontWeight: 600, width: 32 }}>#</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#a1a1aa', fontSize: 11, fontWeight: 600 }}>Priority</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#a1a1aa', fontSize: 11, fontWeight: 600 }}>Impact</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [1,2,3,4,5].map((i) => (
                <tr key={i} style={{ borderTop: '1px solid #27272a' }}>
                  <td style={{ padding: '12px', color: '#52525b', fontSize: 11 }}>{i}</td>
                  <td style={{ padding: '12px' }}><div style={{ height: 14, background: '#27272a', borderRadius: 4, width: '70%' }} /></td>
                  <td style={{ padding: '12px' }}><div style={{ height: 14, background: '#27272a', borderRadius: 4, width: '40%' }} /></td>
                </tr>
              )) : aiRows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #27272a' }}>
                  <td style={{ padding: '8px 12px', color: '#52525b', fontSize: 11, fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: '8px 12px', color: '#f4f4f5', fontSize: 13 }}>{r.priority}</td>
                  <td style={{ padding: '8px 16px', maxWidth: 320 }}>
                    <span style={{ color: '#a78bfa', fontSize: 12, lineHeight: '1.5' }}>{r.impact}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── DealPipelineTable ────────────────────────────────────────────────────────

const STAGE_FILTERS = ['All', ...CRM_STAGE_ORDER.filter((s) => s !== 'Closed')]

function DealPipelineTable({ deals, onNotesChange }: { deals: DealItem[]; onNotesChange: (id: string, notes: string) => void }) {
  const [stageFilter, setStageFilter] = useState('All')
  const [specFilter, setSpecFilter] = useState('All')
  const [sort, setSort] = useState('stage')
  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  const specialties = ['All', ...Array.from(new Set(deals.map((d) => d.specialty))).filter(Boolean).sort()]
  const stageRank = Object.fromEntries(CRM_STAGE_ORDER.map((s, i) => [s, i]))

  const filtered = deals
    .filter((d) => stageFilter === 'All' || d.crmStage === stageFilter)
    .filter((d) => specFilter === 'All' || d.specialty === specFilter)
    .sort((a, b) => {
      if (sort === 'stage') return stageRank[b.crmStage] - stageRank[a.crmStage]
      if (sort === 'ebitda') return b.ebitda - a.ebitda
      if (sort === 'risk') return (isAtRisk(b) ? 1 : 0) - (isAtRisk(a) ? 1 : 0)
      if (sort === 'days') return daysInStage(b) - daysInStage(a)
      return 0
    })

  const stageCounts = Object.fromEntries(
    STAGE_FILTERS.map((s) => [s, s === 'All' ? deals.length : deals.filter((d) => d.crmStage === s).length])
  )

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="p-4 border-b border-zinc-700">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className={h2Cls}>
              Deal Pipeline — {filtered.length} of {deals.length} deals · {filtered.reduce((s, d) => s + d.dvms, 0)} DVMs · ${(filtered.reduce((s, d) => s + d.ebitda, 0) / 1000).toFixed(1)}M EBITDA
            </h2>
            <p className={`text-xs ${mutedCls}`}>
              Prob-wtd: ${(filtered.reduce((s, d) => s + d.ebitda * d.prob, 0) / 1000).toFixed(1)}M · At risk: {filtered.filter(isAtRisk).length} deals
            </p>
          </div>
          <select className="text-xs bg-zinc-800 border border-zinc-600 text-zinc-300 rounded px-2 py-1.5"
            value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="stage">Stage (advanced first)</option>
            <option value="ebitda">EBITDA</option>
            <option value="risk">At Risk first</option>
            <option value="days">Days in Stage</option>
          </select>
        </div>
        <div className="flex gap-1 flex-wrap mb-3 overflow-x-auto pb-1">
          {STAGE_FILTERS.map((s) => {
            const count = stageCounts[s] || 0
            const active = stageFilter === s
            const stageColor = s !== 'All' ? CRM_STAGE_COLORS[s] : null
            return (
              <button key={s} onClick={() => setStageFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap border transition-all ${active ? 'text-black border-transparent' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'}`}
                style={active ? { background: stageColor || '#6366f1', borderColor: 'transparent' } : {}}>
                {s === 'All' ? 'All Stages' : STAGE_SHORT[s]} {count > 0 && <span className={active ? 'opacity-70' : 'text-zinc-600'}>({count})</span>}
              </button>
            )
          })}
        </div>
        <div className="flex gap-1 flex-wrap overflow-x-auto pb-1">
          {specialties.map((s) => {
            const count = s === 'All' ? deals.length : deals.filter((d) => d.specialty === s).length
            const active = specFilter === s
            return (
              <button key={s} onClick={() => setSpecFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap border transition-all ${active ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'}`}>
                {s} {count > 0 && <span className={active ? 'opacity-70' : 'text-zinc-600'}>({count})</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 w-8">#</th>
              {['Deal', 'Specialty', 'DVMs', 'EBITDA', 'Prob-Wtd', 'Stage', 'Days', 'vs Plan', 'Est. Close', 'Risk', 'Notes'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((d, idx) => {
              const days = daysInStage(d)
              const plan = STAGE_PLAN_DAYS[d.crmStage] || 14
              const diff = days - plan
              const risk = isAtRisk(d)
              const close = estimatedCloseDate(d)
              const in2026 = close <= new Date('2026-12-31')
              return (
                <tr key={d.id} className={`hover:bg-zinc-800/60 ${risk ? 'bg-red-950/20' : ''}`}>
                  <td className="px-3 py-2 text-zinc-600 text-xs font-medium">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <div className="max-w-xs truncate text-xs font-semibold text-zinc-100" title={d.name}>{d.name}</div>
                    <div className="text-xs text-zinc-500">{d.doctor}</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5">{d.specialty || '—'}</span>
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-sm text-zinc-200">{d.dvms || '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-sm text-zinc-100 whitespace-nowrap">${(d.ebitda / 1000).toFixed(2)}M</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-indigo-400 whitespace-nowrap">${(d.ebitda * d.prob / 1000).toFixed(2)}M</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold text-black" style={{ background: CRM_STAGE_COLORS[d.crmStage] || '#818cf8' }}>
                      {STAGE_SHORT[d.crmStage] || d.crmStage}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-sm" style={{ color: diff > 0 ? '#f87171' : '#d4d4d8' }}>{days}d</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <span className={`text-xs font-bold ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{diff >= 0 ? '+' : ''}{diff}d</span>
                    <div className="text-xs text-zinc-600">/{plan}d</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className={`text-xs font-semibold ${in2026 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {close.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="text-xs text-zinc-600">{in2026 ? '✓ 2026' : '⚠ 2027'}</div>
                  </td>
                  <td className="px-3 py-2">
                    {risk
                      ? <span className="text-xs font-bold text-red-400 bg-red-950 border border-red-800 px-2 py-0.5 rounded-full">⚠ At Risk</span>
                      : <span className="text-xs font-semibold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full">✓ On Track</span>}
                  </td>
                  <td className="px-3 py-2 min-w-44">
                    {editId === d.id ? (
                      <div className="flex gap-1">
                        <input className="flex-1 bg-zinc-800 border border-indigo-500 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none"
                          value={editVal} onChange={(e) => setEditVal(e.target.value)} autoFocus />
                        <button onClick={() => { onNotesChange(d.id, editVal); setEditId(null) }}
                          className="text-xs bg-indigo-600 text-white px-2 rounded">✓</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 cursor-pointer group"
                        onClick={() => { setEditId(d.id); setEditVal(d.nextSteps || '') }}>
                        <span className="text-xs text-zinc-500 group-hover:text-indigo-400 truncate max-w-xs">
                          {d.nextSteps || <span className="text-zinc-700">Add notes…</span>}
                        </span>
                        <span className="text-zinc-700 group-hover:text-indigo-400 text-xs ml-1">✎</span>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-zinc-600 text-sm">No deals match the selected filters.</td></tr>
            )}
            {filtered.length > 0 && (
              <tr className="bg-zinc-800 border-t-2 border-zinc-600">
                <td className="px-3 py-2 text-zinc-500 text-xs font-bold" />
                <td className="px-3 py-2"><span className="text-xs font-black text-zinc-300">TOTAL ({filtered.length} deals)</span></td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-center font-black text-sm text-white">{filtered.reduce((s, d) => s + d.dvms, 0)}</td>
                <td className="px-3 py-2 text-right font-black text-sm text-white whitespace-nowrap">${(filtered.reduce((s, d) => s + d.ebitda, 0) / 1000).toFixed(1)}M</td>
                <td className="px-3 py-2 text-right font-black text-xs text-indigo-400 whitespace-nowrap">${(filtered.reduce((s, d) => s + d.ebitda * d.prob, 0) / 1000).toFixed(1)}M</td>
                <td colSpan={6} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── WeeklyChanges ────────────────────────────────────────────────────────────

interface SnapshotDeal { dealId: string; dealName: string | null; stage: string | null; ebitda: number | null; probability: number | null }

function WeeklyChanges({ deals, closedWonIds }: { deals: DealItem[]; closedWonIds: Set<string> }) {
  const [snapshot, setSnapshot] = useState<{ snapshotAt: string | null; deals: SnapshotDeal[] }>({ snapshotAt: null, deals: [] })
  const [snapshotList, setSnapshotList] = useState<string[]>([])
  const [selectedAt, setSelectedAt] = useState<string>('')
  const [snapping, setSnapping] = useState(false)
  const [loadingSnap, setLoadingSnap] = useState(true)
  const [aiSummary, setAiSummary] = useState<{ headline: string; summary: string } | null>(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const hasAutoGenerated = useRef(false)

  // Load list of available snapshots, then load the most recent
  useEffect(() => {
    fetch('/api/snapshots?list=true')
      .then((r) => r.json())
      .then((list: string[]) => {
        setSnapshotList(list)
        if (list.length > 0) {
          setSelectedAt(list[0])
          return fetch(`/api/snapshots?at=${encodeURIComponent(list[0])}`).then((r) => r.json())
        }
        return { snapshotAt: null, deals: [] }
      })
      .then((data) => setSnapshot(data))
      .catch(console.error)
      .finally(() => setLoadingSnap(false))
  }, [])

  // Load snapshot when dropdown selection changes
  const handleSelectSnapshot = (at: string) => {
    setSelectedAt(at)
    setAiSummary(null)
    hasAutoGenerated.current = false
    setLoadingSnap(true)
    fetch(`/api/snapshots?at=${encodeURIComponent(at)}`)
      .then((r) => r.json())
      .then((data) => setSnapshot(data))
      .catch(console.error)
      .finally(() => setLoadingSnap(false))
  }

  const takeSnapshot = async () => {
    setSnapping(true)
    try {
      await fetch('/api/snapshots', { method: 'POST' })
      const [listRes, snapRes] = await Promise.all([
        fetch('/api/snapshots?list=true').then((r) => r.json()),
        fetch('/api/snapshots').then((r) => r.json()),
      ])
      setSnapshotList(listRes)
      setSelectedAt(listRes[0] ?? '')
      setSnapshot(snapRes)
    } catch (e) { console.error(e) }
    setSnapping(false)
  }

  const stageColor = (s: string) => CRM_STAGE_COLORS[s] || '#6366f1'

  const DeltaBadge = ({ val, prefix = '', suffix = '' }: { val: number; prefix?: string; suffix?: string }) => {
    const color = val === 0 ? '#71717a' : val > 0 ? '#34d399' : '#f87171'
    return <span style={{ color, fontWeight: 700, fontSize: 13 }}>{val > 0 ? '+' : ''}{prefix}{val.toFixed(Math.abs(val) < 10 && val % 1 !== 0 ? 1 : 0)}{suffix}</span>
  }

  // Computed values (safe when snapshot.snapshotAt is null)
  const snapMap = new Map(snapshot.deals.map((d) => [d.dealId, d]))
  const currentMap = new Map(deals.map((d) => [d.id, d]))
  const snapDate = snapshot.snapshotAt ? new Date(snapshot.snapshotAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  const thisWeekLabel = TODAY.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  type DealChange = { type: 'new' | 'removed' | 'stage' | 'closed_won'; deal: DealItem | SnapshotDeal; prior?: SnapshotDeal; change: string }
  const dealChanges: DealChange[] = []
  deals.forEach((curr) => {
    const prior = snapMap.get(curr.id)
    if (!prior) { dealChanges.push({ type: 'new', deal: curr, change: 'New deal added to pipeline' }) }
    else if (prior.stage !== curr.crmStage) { dealChanges.push({ type: 'stage', deal: curr, prior, change: `${STAGE_SHORT[prior.stage!] || prior.stage} → ${STAGE_SHORT[curr.crmStage] || curr.crmStage}` }) }
  })
  snapshot.deals.forEach((prior) => {
    if (!currentMap.has(prior.dealId)) {
      if (closedWonIds.has(prior.dealId)) {
        dealChanges.push({ type: 'closed_won', deal: prior, change: 'Closed Won 🎉' })
      } else {
        dealChanges.push({ type: 'removed', deal: prior, change: 'Removed from pipeline' })
      }
    }
  })

  const snapProbWtd = Math.round(snapshot.deals.reduce((s, d) => s + (d.ebitda ?? 0) * (d.probability ?? 0), 0))
  const currProbWtd = Math.round(deals.reduce((s, d) => s + d.ebitda * d.prob, 0))
  const ebitdaDelta = currProbWtd - snapProbWtd

  const generateAISummary = async () => {
    setLoadingAI(true)
    try {
      const prompt = `You are the M&A chief of staff for AOSN. Summarize the week-over-week pipeline changes in 3-4 sentences. Be direct and focus on what matters for closing the ${((TARGETS.totalEBITDA - currProbWtd) / 1000).toFixed(1)}M EBITDA gap.\n\nPRIOR WEEK (${snapDate}): ${(snapProbWtd / 1000).toFixed(1)}M prob-wtd EBITDA\nTHIS WEEK (${thisWeekLabel}): ${(currProbWtd / 1000).toFixed(1)}M prob-wtd EBITDA\nEBITDA CHANGE: ${ebitdaDelta >= 0 ? '+' : ''}${(ebitdaDelta / 1000).toFixed(1)}M\nDEAL CHANGES: ${dealChanges.length > 0 ? dealChanges.map((c) => {
        const name = 'name' in c.deal ? (c.deal as DealItem).name : (c.deal as SnapshotDeal).dealName
        return `${name}: ${c.change}`
      }).join('; ') : 'No stage changes'}\n\nReturn ONLY raw JSON: {"headline": "...", "summary": "..."}. No markdown.`
      const data = await callAI({ model: 'claude-sonnet-4-6', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
      const raw = data.content?.find((b: any) => b.type === 'text')?.text || '{}'
      setAiSummary(JSON.parse(raw.replace(/```json|```/g, '').trim()))
    } catch (e) { console.error(e) }
    setLoadingAI(false)
  }

  // Auto-generate on first load when snapshot exists — must be before any conditional returns
  useEffect(() => {
    if (snapshot.snapshotAt && !hasAutoGenerated.current) {
      hasAutoGenerated.current = true
      generateAISummary()
    }
  }, [snapshot.snapshotAt])

  // Early returns after all hooks
  if (loadingSnap) return null

  if (!snapshot.snapshotAt) {
    return (
      <div className={card}><div className={cardPad}>
        <div className="flex justify-between items-center">
          <div>
            <h2 className={h2Cls}>Weekly Changes</h2>
            <p className={`text-xs ${mutedCls} mt-0.5`}>No snapshot yet — take one now to start tracking week-over-week changes</p>
          </div>
          <button onClick={takeSnapshot} disabled={snapping}
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50">
            {snapping ? '⏳ Saving…' : '📸 Take Snapshot'}
          </button>
        </div>
      </div></div>
    )
  }

  const unchanged = deals
    .filter((d) => !dealChanges.find((c) => ('id' in c.deal ? (c.deal as DealItem).id : (c.deal as SnapshotDeal).dealId) === d.id))
    .sort((a, b) => {
      const aOver = daysInStage(a) - (STAGE_PLAN_DAYS[a.crmStage] || 14)
      const bOver = daysInStage(b) - (STAGE_PLAN_DAYS[b.crmStage] || 14)
      return bOver - aOver
    })

  return (
    <div>
      {/* How it works banner */}
      <div style={{ background: '#1c1917', border: '1px solid #44403c', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>How Weekly Changes Works</span>
        </div>
        <p style={{ color: '#a8a29e', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
          Each Monday at 8 AM a snapshot of the pipeline is saved automatically. This tab compares the current state to the last snapshot — surfacing prob-wtd EBITDA movements and deal stage progressions. The AI summary explains what changed and why it matters.
          {' '}<strong style={{ color: '#e7e5e4' }}>Last snapshot: {snapDate}</strong>
        </p>
      </div>

      {/* AI Summary */}
      <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, padding: '20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Pipeline Changes — {thisWeekLabel}</div>
            <div style={{ marginTop: 6 }}>
              <select
                value={selectedAt}
                onChange={(e) => handleSelectSnapshot(e.target.value)}
                style={{ background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46', borderRadius: 6, padding: '4px 10px', fontSize: 12, outline: 'none', cursor: 'pointer' }}
              >
                {snapshotList.map((at, i) => {
                  const d = new Date(at)
                  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                  return <option key={at} value={at}>{i === 0 ? `${label} (latest)` : label}</option>
                })}
              </select>
              <span style={{ color: '#52525b', fontSize: 11, marginLeft: 8 }}>Compare to current pipeline</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={takeSnapshot} disabled={snapping}
              style={{ background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: snapping ? 'not-allowed' : 'pointer', opacity: snapping ? 0.6 : 1 }}>
              {snapping ? '⏳ Saving…' : '📸 New Snapshot'}
            </button>
            <button onClick={generateAISummary} disabled={loadingAI}
              style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: loadingAI ? 'not-allowed' : 'pointer', opacity: loadingAI ? 0.6 : 1 }}>
              {loadingAI ? '⏳ Generating…' : '✦ AI Summary'}
            </button>
          </div>
        </div>
        {loadingAI
          ? <div style={{ height: 60, background: '#27272a', borderRadius: 8 }} />
          : aiSummary
            ? <>
                <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{aiSummary.headline}</div>
                <div style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 1.7 }}>{aiSummary.summary}</div>
              </>
            : <div style={{ color: '#52525b', fontSize: 13 }}>Click Refresh to generate summary.</div>
        }
      </div>

      {/* KPI delta cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Prob-Wtd EBITDA', prior: `${(snapProbWtd / 1000).toFixed(1)}M`, current: `${(currProbWtd / 1000).toFixed(1)}M`, delta: ebitdaDelta / 1000, prefix: '$', suffix: 'M', desc: `vs $${(TARGETS.totalEBITDA / 1000).toFixed(1)}M target` },
          { label: 'Active Deals', prior: String(snapshot.deals.length), current: String(deals.length), delta: deals.length - snapshot.deals.length, prefix: '', suffix: '', desc: `${dealChanges.filter(c => c.type === 'new').length} added · ${dealChanges.filter(c => c.type === 'closed_won').length} closed · ${dealChanges.filter(c => c.type === 'removed').length} dropped` },
          { label: 'Stage Changes', prior: '—', current: String(dealChanges.filter(c => c.type === 'stage').length), delta: dealChanges.filter(c => c.type === 'stage').length, prefix: '', suffix: '', desc: `${dealChanges.filter(c => c.type === 'new').length} new · ${dealChanges.filter(c => c.type === 'closed_won').length} closed · ${dealChanges.filter(c => c.type === 'removed').length} removed` },
        ].map((k) => (
          <div key={k.label} style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ color: '#71717a', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
              <span style={{ color: 'white', fontWeight: 900, fontSize: 26 }}>{k.current}</span>
              <span style={{ color: '#52525b', fontSize: 13, marginBottom: 4 }}>was {k.prior}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <DeltaBadge val={k.delta} prefix={k.prefix} suffix={k.suffix} />
              <span style={{ color: '#52525b', fontSize: 11 }}>week over week</span>
            </div>
            <div style={{ color: '#52525b', fontSize: 11, marginTop: 4 }}>{k.desc}</div>
          </div>
        ))}
      </div>

      {/* Deal Changes table */}
      <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46' }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Deal Changes This Week</div>
          <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{dealChanges.length} changes vs. prior snapshot</div>
        </div>
        {dealChanges.length === 0
          ? <div style={{ padding: '32px', textAlign: 'center', color: '#3f3f46', fontSize: 13 }}>No stage changes this week</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#27272a' }}>
                  {['Deal', 'Specialty', 'EBITDA', 'Change', 'Prior Stage', 'Current Stage'].map((h) => (
                    <th key={h} style={{ padding: '8px 16px', textAlign: 'left', color: '#a1a1aa', fontSize: 11, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dealChanges.map((c, i) => {
                  const isItem = 'id' in c.deal
                  const name = isItem ? (c.deal as DealItem).name : ((c.deal as SnapshotDeal).dealName ?? '')
                  const doctor = isItem ? (c.deal as DealItem).doctor : ''
                  const specialty = isItem ? (c.deal as DealItem).specialty : ''
                  const ebitda = isItem ? (c.deal as DealItem).ebitda : ((c.deal as SnapshotDeal).ebitda ?? 0)
                  const currStage = isItem ? (c.deal as DealItem).crmStage : ((c.deal as SnapshotDeal).stage ?? '')
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #27272a', background: c.type === 'new' ? 'rgba(99,102,241,0.07)' : c.type === 'closed_won' ? 'rgba(52,211,153,0.07)' : c.type === 'removed' ? 'rgba(248,113,113,0.07)' : 'transparent' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ color: '#f4f4f5', fontSize: 12, fontWeight: 600, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        {doctor && <div style={{ color: '#71717a', fontSize: 11 }}>{doctor}</div>}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {specialty && <span style={{ color: '#a1a1aa', fontSize: 11, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 4, padding: '2px 6px' }}>{specialty}</span>}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#f4f4f5', fontWeight: 700, fontSize: 13 }}>${(ebitda / 1000).toFixed(2)}M</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px',
                          background: c.type === 'new' ? 'rgba(99,102,241,0.2)' : c.type === 'closed_won' ? 'rgba(52,211,153,0.2)' : c.type === 'removed' ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.15)',
                          color: c.type === 'new' ? '#818cf8' : c.type === 'closed_won' ? '#34d399' : c.type === 'removed' ? '#f87171' : '#fbbf24',
                          border: `1px solid ${c.type === 'new' ? '#4f46e5' : c.type === 'closed_won' ? '#10b981' : c.type === 'removed' ? '#ef4444' : '#d97706'}` }}>
                          {c.type === 'new' ? '🆕 New' : c.type === 'closed_won' ? '🎉 Closed Won' : c.type === 'removed' ? '❌ Dropped' : '⬆ Stage Change'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {c.prior?.stage
                          ? <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px', background: stageColor(c.prior.stage) + '33', color: stageColor(c.prior.stage), border: `1px solid ${stageColor(c.prior.stage)}66` }}>{STAGE_SHORT[c.prior.stage] || c.prior.stage}</span>
                          : <span style={{ color: '#3f3f46' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px', background: stageColor(currStage) + '33', color: stageColor(currStage), border: `1px solid ${stageColor(currStage)}66` }}>
                          {STAGE_SHORT[currStage] || currStage}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        }
      </div>

      {/* No Change table */}
      <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46' }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Pipeline — No Change</div>
          <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>Deals with no stage movement since {snapDate}</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#27272a' }}>
              {['Deal', 'Specialty', 'EBITDA', 'Stage', 'Days in Stage'].map((h) => (
                <th key={h} style={{ padding: '8px 16px', textAlign: 'left', color: '#a1a1aa', fontSize: 11, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {unchanged.map((d, i) => {
              const days = daysInStage(d), plan = STAGE_PLAN_DAYS[d.crmStage] || 14, over = days > plan
              return (
                <tr key={i} style={{ borderTop: '1px solid #27272a' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ color: '#f4f4f5', fontSize: 12, fontWeight: 600, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                    <div style={{ color: '#71717a', fontSize: 11 }}>{d.doctor}</div>
                  </td>
                  <td style={{ padding: '10px 16px' }}><span style={{ color: '#a1a1aa', fontSize: 11, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 4, padding: '2px 6px' }}>{d.specialty || '—'}</span></td>
                  <td style={{ padding: '10px 16px', color: '#f4f4f5', fontWeight: 700, fontSize: 13 }}>${(d.ebitda / 1000).toFixed(2)}M</td>
                  <td style={{ padding: '10px 16px' }}><span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px', background: stageColor(d.crmStage) + '33', color: stageColor(d.crmStage), border: `1px solid ${stageColor(d.crmStage)}66` }}>{STAGE_SHORT[d.crmStage] || d.crmStage}</span></td>
                  <td style={{ padding: '10px 16px' }}><span style={{ color: over ? '#f87171' : '#34d399', fontWeight: 700, fontSize: 12 }}>{days}d</span><span style={{ color: '#52525b', fontSize: 11 }}> / {plan}d plan</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Vintage Cohort Analysis ─────────────────────────────────────────────────

type VintageDeal = {
  dealId: string
  dealName: string | null
  stage: string | null
  dealCreatedAt: string | null
  engagedDate: string | null
  ndaSignedDate: string | null
  loiSignedDate: string | null
  integrationCompletionDate: string | null
  officialClosedDate: string | null
  milestone: string
}

// ─── APA sub-phase types ──────────────────────────────────────────────────

type ApaTurn = {
  turnNumber: number
  date: string
  direction: 'us_to_seller' | 'seller_to_us'
  delayParty: 'internal' | 'seller' | 'counsel' | 'thirdparty' | null
  daysToRespond: number | null
}

type ApaPhase = {
  key: string
  label: string
  date: string | null
  daysFromPrev: number | null
  party: 'internal' | 'seller' | 'counsel' | 'thirdparty' | 'unattributed'
}

type PreLoiStage = {
  label: string
  days: number | null
  party: 'internal' | 'seller' | 'unattributed'
}

type ApaDealDetail = {
  dealName: string
  closedDate: string
  preLoiStages: PreLoiStage[]
  totalTurns: number
  aosnTurns: number
  sellerTurns: number
  totalDays: number
  internalDays: number
  externalDays: number
  unattributedDays: number
  preLOIPhases: ApaPhase[]
  turns: ApaTurn[]
}

// TODO: replace with GET /api/dashboard/apa-subphases when endpoint is ready
const APA_DEAL_DATA: ApaDealDetail[] = [
  {
    dealName: 'Van Lue Veterinary Surgical',
    closedDate: '2026-03-11',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: 4,   party: 'seller' },
      { label: 'Min. viable data → cmte',   days: 4,   party: 'internal' },
      { label: 'First cmte → LOI',          days: 9,   party: 'internal' },
    ],
    totalTurns: 0, aosnTurns: 0, sellerTurns: 0,
    totalDays: 150, internalDays: 0, externalDays: 0, unattributedDays: 150,
    preLOIPhases: [], turns: [],
  },
  {
    dealName: 'Veterinary Dental Center',
    closedDate: '2025-09-04',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: 54,  party: 'seller' },
      { label: 'Min. viable data → cmte',   days: 2,   party: 'internal' },
      { label: 'First cmte → LOI',          days: 35,  party: 'internal' },
    ],
    totalTurns: 0, aosnTurns: 0, sellerTurns: 0,
    totalDays: 47, internalDays: 0, externalDays: 0, unattributedDays: 47,
    preLOIPhases: [], turns: [],
  },
  {
    dealName: 'Great Lakes Veterinary Dermatology',
    closedDate: '2026-01-20',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: 340, party: 'seller' },
      { label: 'Min. viable data → cmte',   days: 3,   party: 'internal' },
      { label: 'First cmte → LOI',          days: 24,  party: 'internal' },
    ],
    totalTurns: 11, aosnTurns: 6, sellerTurns: 5,
    totalDays: 65, internalDays: 16, externalDays: 49, unattributedDays: 0,
    preLOIPhases: [
      { key: 'qoe_kick',       label: 'QoE kicked off',           date: null, daysFromPrev: null, party: 'internal' },
      { key: 'qoe_delivered',  label: 'QoE delivered',            date: null, daysFromPrev: null, party: 'thirdparty' },
      { key: 'legal_kickoff',  label: 'Legal diligence kick-off', date: null, daysFromPrev: null, party: 'internal' },
      { key: 'apa_draft_sent', label: 'APA draft sent to seller', date: null, daysFromPrev: null, party: 'internal' },
    ],
    // APA version history: v1 Oct 20 internal, v2 Oct 22 initial draft, v3 Nov 20 seller,
    // v4 Dec 1 Fredrikson, v5 Dec 15 seller, v6 Dec 17 Fredrikson, v7 Dec 19 seller,
    // v8 Dec 20 Fredrikson, v9 Dec 23 seller, v10 Dec 23 Fredrikson, v11 Dec 24 seller, v12 Dec 24 final
    turns: [
      { turnNumber: 1,  date: '2025-10-20', direction: 'seller_to_us', delayParty: 'internal', daysToRespond: 2  },
      { turnNumber: 2,  date: '2025-10-22', direction: 'us_to_seller', delayParty: 'seller',   daysToRespond: 29 },
      { turnNumber: 3,  date: '2025-11-20', direction: 'seller_to_us', delayParty: 'internal', daysToRespond: 11 },
      { turnNumber: 4,  date: '2025-12-01', direction: 'us_to_seller', delayParty: 'seller',   daysToRespond: 14 },
      { turnNumber: 5,  date: '2025-12-15', direction: 'seller_to_us', delayParty: 'internal', daysToRespond: 2  },
      { turnNumber: 6,  date: '2025-12-17', direction: 'us_to_seller', delayParty: 'seller',   daysToRespond: 2  },
      { turnNumber: 7,  date: '2025-12-19', direction: 'seller_to_us', delayParty: 'internal', daysToRespond: 1  },
      { turnNumber: 8,  date: '2025-12-20', direction: 'us_to_seller', delayParty: 'seller',   daysToRespond: 3  },
      { turnNumber: 9,  date: '2025-12-23', direction: 'seller_to_us', delayParty: 'internal', daysToRespond: 0  },
      { turnNumber: 10, date: '2025-12-23', direction: 'us_to_seller', delayParty: 'seller',   daysToRespond: 1  },
      { turnNumber: 11, date: '2025-12-24', direction: 'seller_to_us', delayParty: null,       daysToRespond: 0  },
    ],
  },
  {
    dealName: 'Lehigh Valley Veterinary Dermatology',
    closedDate: '2025-12-30',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: 1,   party: 'seller' },
      { label: 'Min. viable data → cmte',   days: 13,  party: 'internal' },
      { label: 'First cmte → LOI',          days: 56,  party: 'internal' },
    ],
    totalTurns: 0, aosnTurns: 0, sellerTurns: 0,
    totalDays: 41, internalDays: 0, externalDays: 0, unattributedDays: 41,
    preLOIPhases: [], turns: [],
  },
  {
    dealName: 'Dentistry for Animals',
    closedDate: '2026-02-09',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: 113, party: 'seller' },
      { label: 'Min. viable data → cmte',   days: null, party: 'unattributed' },
      { label: 'First cmte → LOI',          days: 21,  party: 'internal' },
    ],
    totalTurns: 3, aosnTurns: 2, sellerTurns: 1,
    totalDays: 55, internalDays: 14, externalDays: 41, unattributedDays: 0,
    preLOIPhases: [
      { key: 'qoe_kick',       label: 'QoE kicked off',           date: null, daysFromPrev: null, party: 'internal' },
      { key: 'qoe_delivered',  label: 'QoE delivered',            date: null, daysFromPrev: null, party: 'thirdparty' },
      { key: 'legal_kickoff',  label: 'Legal diligence kick-off', date: null, daysFromPrev: null, party: 'internal' },
      { key: 'apa_draft_sent', label: 'APA draft sent to seller', date: null, daysFromPrev: null, party: 'internal' },
    ],
    // APA version history: v4 Nov 28 internal, v5 Nov 29 internal, v6 Dec 2 initial draft,
    // v7 Jan 12 seller, v8 Jan 12 Fredrikson, v9 Jan 18 Fredrikson, v10 Jan 22 Fredrikson, v11 Jan 22 final
    turns: [
      { turnNumber: 1, date: '2025-11-28', direction: 'seller_to_us', delayParty: 'internal', daysToRespond: 4  },
      { turnNumber: 2, date: '2025-12-02', direction: 'us_to_seller', delayParty: 'seller',   daysToRespond: 41 },
      { turnNumber: 3, date: '2026-01-12', direction: 'seller_to_us', delayParty: 'internal', daysToRespond: 10 },
    ],
  },
  {
    dealName: 'Animal Eye Clinic of N. Florida',
    closedDate: '2025-11-05',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: 16,  party: 'seller' },
      { label: 'Min. viable data → cmte',   days: 2,   party: 'internal' },
      { label: 'First cmte → LOI',          days: 104, party: 'internal' },
    ],
    totalTurns: 0, aosnTurns: 0, sellerTurns: 0,
    totalDays: 43, internalDays: 0, externalDays: 0, unattributedDays: 43,
    preLOIPhases: [], turns: [],
  },
  {
    dealName: 'Golden Gate Specialists',
    closedDate: '2025-12-08',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: 616, party: 'seller' },
      { label: 'Min. viable data → cmte',   days: 4,   party: 'internal' },
      { label: 'First cmte → LOI',          days: 20,  party: 'internal' },
    ],
    totalTurns: 0, aosnTurns: 0, sellerTurns: 0,
    totalDays: 57, internalDays: 0, externalDays: 0, unattributedDays: 57,
    preLOIPhases: [], turns: [],
  },
  {
    dealName: 'Veterinary Dentistry and Oral Surgery of NM',
    closedDate: '2026-03-03',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: 104, party: 'seller' },
      { label: 'Min. viable data → cmte',   days: 5,   party: 'internal' },
      { label: 'First cmte → LOI',          days: 42,  party: 'internal' },
    ],
    totalTurns: 12, aosnTurns: 8, sellerTurns: 4,
    totalDays: 102, internalDays: 40, externalDays: 62, unattributedDays: 0,
    preLOIPhases: [
      { key: 'qoe_kick',       label: 'QoE kicked off',           date: null, daysFromPrev: null, party: 'internal' },
      { key: 'qoe_delivered',  label: 'QoE delivered',            date: null, daysFromPrev: null, party: 'thirdparty' },
      { key: 'legal_kickoff',  label: 'Legal diligence kick-off', date: null, daysFromPrev: null, party: 'internal' },
      { key: 'apa_draft_sent', label: 'APA draft sent to seller', date: null, daysFromPrev: null, party: 'internal' },
    ],
    turns: [],
  },
  {
    dealName: 'Veterinary Cancer & Surgery Specialists',
    closedDate: '2026-03-11',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: null, party: 'unattributed' },
      { label: 'Min. viable data → cmte',   days: 7,   party: 'internal' },
      { label: 'First cmte → LOI',          days: 112, party: 'internal' },
    ],
    totalTurns: 9, aosnTurns: 6, sellerTurns: 3,
    totalDays: 43, internalDays: 20, externalDays: 23, unattributedDays: 0,
    preLOIPhases: [
      { key: 'qoe_kick',       label: 'QoE kicked off',           date: null, daysFromPrev: null, party: 'internal' },
      { key: 'qoe_delivered',  label: 'QoE delivered',            date: null, daysFromPrev: null, party: 'thirdparty' },
      { key: 'legal_kickoff',  label: 'Legal diligence kick-off', date: null, daysFromPrev: null, party: 'internal' },
      { key: 'apa_draft_sent', label: 'APA draft sent to seller', date: null, daysFromPrev: null, party: 'internal' },
    ],
    turns: [],
  },
  {
    dealName: 'Animal Dermatology Center',
    closedDate: '2025-10-17',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: 67,  party: 'seller' },
      { label: 'Min. viable data → cmte',   days: 7,   party: 'internal' },
      { label: 'First cmte → LOI',          days: 49,  party: 'internal' },
    ],
    totalTurns: 0, aosnTurns: 0, sellerTurns: 0,
    totalDays: 63, internalDays: 0, externalDays: 0, unattributedDays: 63,
    preLOIPhases: [], turns: [],
  },
  {
    dealName: 'Animal Dental Clinic of Pittsburgh',
    closedDate: '',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: 7,   party: 'seller' },
      { label: 'Min. viable data → cmte',   days: 2,   party: 'internal' },
      { label: 'First cmte → LOI',          days: 39,  party: 'internal' },
    ],
    totalTurns: 0, aosnTurns: 0, sellerTurns: 0,
    totalDays: 0, internalDays: 0, externalDays: 0, unattributedDays: 0,
    preLOIPhases: [], turns: [],
  },
  {
    dealName: 'OREV Specialty Vet Care',
    closedDate: '2026-02-24',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: 12,  party: 'seller' },
      { label: 'Min. viable data → cmte',   days: 2,   party: 'internal' },
      { label: 'First cmte → LOI',          days: 39,  party: 'internal' },
    ],
    totalTurns: 8, aosnTurns: 6, sellerTurns: 2,
    totalDays: 61, internalDays: 36, externalDays: 25, unattributedDays: 0,
    preLOIPhases: [
      { key: 'qoe_kick',       label: 'QoE kicked off',           date: null, daysFromPrev: null, party: 'internal' },
      { key: 'qoe_delivered',  label: 'QoE delivered',            date: null, daysFromPrev: null, party: 'thirdparty' },
      { key: 'legal_kickoff',  label: 'Legal diligence kick-off', date: null, daysFromPrev: null, party: 'internal' },
      { key: 'apa_draft_sent', label: 'APA draft sent to seller', date: null, daysFromPrev: null, party: 'internal' },
    ],
    turns: [],
  },
  {
    dealName: 'Derm for Pets',
    closedDate: '2025-09-19',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: null, party: 'unattributed' },
      { label: 'Min. viable data → cmte',   days: null, party: 'unattributed' },
      { label: 'First cmte → LOI',          days: null, party: 'unattributed' },
    ],
    totalTurns: 0, aosnTurns: 0, sellerTurns: 0,
    totalDays: 144, internalDays: 0, externalDays: 0, unattributedDays: 144,
    preLOIPhases: [], turns: [],
  },
  {
    dealName: 'Texas Specialty Veterinary Services',
    closedDate: '',
    preLoiStages: [
      { label: 'NDA → min. viable data',    days: 104, party: 'seller' },
      { label: 'Min. viable data → cmte',   days: null, party: 'unattributed' },
      { label: 'First cmte → LOI',          days: null, party: 'unattributed' },
    ],
    totalTurns: 0, aosnTurns: 0, sellerTurns: 0,
    totalDays: 0, internalDays: 0, externalDays: 0, unattributedDays: 0,
    preLOIPhases: [], turns: [],
  },
]

function findApaDeal(dealName: string | null): ApaDealDetail | undefined {
  if (!dealName) return undefined
  const n = dealName.toLowerCase()
  return APA_DEAL_DATA.find(d =>
    d.dealName.toLowerCase().includes(n) || n.includes(d.dealName.toLowerCase())
  )
}

// Extracts the last name from HubSpot deal names like "Animal Eye Vet- (Ashton) - Murrieta, CA"
function extractShortName(hubspotName: string | null): string | null {
  if (!hubspotName) return null
  const match = hubspotName.match(/\(([^)]+)\)/)
  return match ? match[1] : null
}

type VintageRow = {
  quarter: string
  engaged: number
  ndas: number
  ndaConv: number
  avgDaysToNda: number | null
  lois: number
  loiConv: number
  avgDaysNdaToLoi: number | null
  apas: number
  apaConv: number
  avgDaysLoiToApa: number | null
  closed: number
  closedConv: number
  avgDaysApaToClose: number | null
  deals: VintageDeal[]
}

const MILESTONE_COLORS: Record<string, string> = {
  Closed:  'text-emerald-400 bg-emerald-900/40 border-emerald-700',
  APA:     'text-amber-400 bg-amber-900/40 border-amber-700',
  LOI:     'text-violet-400 bg-violet-900/40 border-violet-700',
  NDA:     'text-indigo-400 bg-indigo-900/40 border-indigo-700',
  Engaged: 'text-zinc-400 bg-zinc-800 border-zinc-600',
}

function ConvBadge({ pct, count }: { pct: number; count: number }) {
  if (count === 0) return <span className="text-zinc-600 text-xs">—</span>
  const color = pct >= 50 ? 'text-emerald-400' : pct >= 25 ? 'text-amber-400' : 'text-zinc-400'
  return <span className={`text-xs font-bold ${color}`}>{pct}%</span>
}

function VintageAnalysis() {
  const [rows, setRows] = useState<VintageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<ApaDealDetail | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/vintages')
      .then((r) => r.json())
      .then((d) => { if (d.vintages) setRows(d.vintages) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Build trend map: for each row, find the previous row that had data
  const prevWithData = (idx: number, field: (r: VintageRow) => number | null) => {
    for (let i = idx - 1; i >= 0; i--) {
      const v = field(rows[i])
      if (v != null && rows[i].engaged > 0) return v
    }
    return null
  }

  function Trend({ cur, prev, lowerIsBetter = false }: { cur: number | null; prev: number | null; lowerIsBetter?: boolean }) {
    if (cur == null || prev == null) return null
    if (cur === prev) return null
    const improved = lowerIsBetter ? cur < prev : cur > prev
    return <span className={`ml-1 text-[10px] font-black ${improved ? 'text-emerald-400' : 'text-red-400'}`}>{improved ? '↑' : '↓'}</span>
  }

  if (loading) return (
    <div className={`${card} p-6`}>
      <div className="h-4 w-40 bg-zinc-800 rounded animate-pulse mb-4" />
      <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />)}</div>
    </div>
  )

  return (
    <div className={`${card} overflow-hidden`}>
      <div className={cardPad}>
        <div className="mb-5">
          <h2 className={h2Cls}>Pipeline Vintage Analysis</h2>
          <p className={`text-xs ${mutedCls} mt-0.5`}>Cohort conversion by quarter of deal creation — click a row to see deals. ↑ green = improving vs prior quarter</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-2 pr-4 text-xs font-black text-zinc-500 uppercase tracking-widest w-6" />
                <th className="text-left py-2 pr-4 text-xs font-black text-zinc-500 uppercase tracking-widest">Vintage</th>
                <th className="text-right py-2 px-3 text-xs font-black text-zinc-500 uppercase tracking-widest">Engaged</th>
                <th className="text-right py-2 px-3 text-xs font-black text-zinc-500 uppercase tracking-widest">NDAs</th>
                <th className="text-right py-2 px-3 text-xs font-black text-zinc-500 uppercase tracking-widest">Conv%</th>
                <th className="text-right py-2 px-3 text-xs font-black text-zinc-500 uppercase tracking-widest">Avg Eng→NDA</th>
                <th className="text-right py-2 px-3 text-xs font-black text-zinc-500 uppercase tracking-widest">LOIs</th>
                <th className="text-right py-2 px-3 text-xs font-black text-zinc-500 uppercase tracking-widest">Conv%</th>
                <th className="text-right py-2 px-3 text-xs font-black text-zinc-500 uppercase tracking-widest">Avg NDA→LOI</th>
                <th className="text-right py-2 px-3 text-xs font-black text-zinc-500 uppercase tracking-widest">APAs</th>
                <th className="text-right py-2 px-3 text-xs font-black text-zinc-500 uppercase tracking-widest">Conv%</th>
                <th className="text-right py-2 pl-3 text-xs font-black text-zinc-500 uppercase tracking-widest">Closed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const isOpen = expanded === r.quarter
                const hasDeals = r.engaged > 0
                const pNdaConv    = prevWithData(idx, x => x.ndas > 0 ? x.ndaConv : null)
                const pDaysToNda  = prevWithData(idx, x => x.avgDaysToNda)
                const pLoiConv    = prevWithData(idx, x => x.lois > 0 ? x.loiConv : null)
                const pDaysNdaLoi = prevWithData(idx, x => x.avgDaysNdaToLoi)
                const pApaConv    = prevWithData(idx, x => x.apas > 0 ? x.apaConv : null)
                return (
                  <React.Fragment key={r.quarter}>
                    <tr
                      onClick={() => hasDeals && setExpanded(isOpen ? null : r.quarter)}
                      className={`border-b border-zinc-800/50 transition-colors ${hasDeals ? 'cursor-pointer hover:bg-zinc-800/40' : ''} ${isOpen ? 'bg-zinc-800/40' : ''}`}
                    >
                      <td className="py-3 pl-1 pr-2 text-zinc-500 text-xs">
                        {hasDeals && <span>{isOpen ? '▾' : '▸'}</span>}
                      </td>
                      <td className="py-3 pr-4 font-black text-white text-sm">{r.quarter}</td>
                      <td className="py-3 px-3 text-right font-bold text-zinc-200">{r.engaged || '—'}</td>
                      <td className="py-3 px-3 text-right font-bold text-indigo-300">{r.ndas || '—'}</td>
                      <td className="py-3 px-3 text-right">
                        <ConvBadge pct={r.ndaConv} count={r.ndas} />
                        <Trend cur={r.ndas > 0 ? r.ndaConv : null} prev={pNdaConv} />
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-zinc-400">
                        {r.avgDaysToNda != null ? `${r.avgDaysToNda}d` : '—'}
                        <Trend cur={r.avgDaysToNda} prev={pDaysToNda} lowerIsBetter />
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-violet-300">{r.lois > 0 ? r.lois : '—'}</td>
                      <td className="py-3 px-3 text-right">
                        <ConvBadge pct={r.loiConv} count={r.lois} />
                        <Trend cur={r.lois > 0 ? r.loiConv : null} prev={pLoiConv} />
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-zinc-400">
                        {r.avgDaysNdaToLoi != null ? `${r.avgDaysNdaToLoi}d` : '—'}
                        <Trend cur={r.avgDaysNdaToLoi} prev={pDaysNdaLoi} lowerIsBetter />
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-amber-300">{r.apas > 0 ? r.apas : '—'}</td>
                      <td className="py-3 px-3 text-right">
                        <ConvBadge pct={r.apaConv} count={r.apas} />
                        <Trend cur={r.apas > 0 ? r.apaConv : null} prev={pApaConv} />
                      </td>
                      <td className="py-3 pl-3 text-right font-bold text-emerald-400">{r.closed > 0 ? r.closed : '—'}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-zinc-800/50">
                        <td colSpan={12} className="px-4 py-3 bg-zinc-900/60">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-zinc-700/50">
                                <th className="text-left pb-2 pr-4 font-black text-zinc-500 uppercase tracking-widest">Deal</th>
                                <th className="text-left pb-2 px-3 font-black text-zinc-500 uppercase tracking-widest">Milestone</th>
                                <th className="text-left pb-2 px-3 font-black text-zinc-500 uppercase tracking-widest">Engaged</th>
                                <th className="text-left pb-2 px-3 font-black text-zinc-500 uppercase tracking-widest">NDA</th>
                                <th className="text-left pb-2 px-3 font-black text-zinc-500 uppercase tracking-widest">LOI</th>
                                <th className="text-left pb-2 px-3 font-black text-zinc-500 uppercase tracking-widest">APA</th>
                                <th className="text-left pb-2 pl-3 font-black text-zinc-500 uppercase tracking-widest">Closed</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/30">
                              {r.deals.map((d) => {
                                const mc = MILESTONE_COLORS[d.milestone] ?? MILESTONE_COLORS.Engaged
                                const apaSub = findApaDeal(d.dealName)
                                return (
                                  <tr
                                    key={d.dealId}
                                    className={`hover:bg-zinc-800/20 ${apaSub ? 'cursor-pointer' : ''}`}
                                    onClick={() => apaSub && setSelectedDeal(apaSub)}
                                  >
                                    <td className="py-2 pr-4 text-zinc-200 font-medium max-w-xs truncate">
                                      {d.dealName ?? d.dealId}
                                      {apaSub && <span className="ml-1.5 text-indigo-500 text-[10px]">↗</span>}
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-black ${mc}`}>{d.milestone}</span>
                                    </td>
                                    <td className="py-2 px-3 text-zinc-400">{d.engagedDate ?? '—'}</td>
                                    <td className="py-2 px-3 text-zinc-400">{d.ndaSignedDate ?? '—'}</td>
                                    <td className="py-2 px-3 text-zinc-400">{d.loiSignedDate ?? '—'}</td>
                                    <td className="py-2 px-3 text-zinc-400">{d.integrationCompletionDate ?? '—'}</td>
                                    <td className="py-2 pl-3 text-zinc-400">{d.officialClosedDate ?? '—'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-zinc-800">
          <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />Engaged → NDA</span>
          <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />NDA → LOI</span>
          <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />LOI → APA</span>
          <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Closed</span>
          <span className="text-xs text-zinc-600 ml-auto">Conv% = % of prior stage that advanced · Avg Days = time between milestones</span>
        </div>
      </div>

      {/* Deal phase drill-through modal */}
      {selectedDeal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setSelectedDeal(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700/60 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between p-5 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-medium text-zinc-100">{selectedDeal.dealName}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">NDA → close deal cycle</p>
              </div>
              <button
                onClick={() => setSelectedDeal(null)}
                className="text-zinc-500 hover:text-zinc-300 text-xs ml-4 mt-0.5"
              >
                close ✕
              </button>
            </div>

            <div className="p-5 space-y-6">
              {(() => {
                // Full-cycle aggregates
                const preLoiTotal       = selectedDeal.preLoiStages.reduce((s, st) => s + (st.days ?? 0), 0)
                const preLoiInternal    = selectedDeal.preLoiStages.filter(st => st.party === 'internal').reduce((s, st) => s + (st.days ?? 0), 0)
                const preLoiSeller      = selectedDeal.preLoiStages.filter(st => st.party === 'seller').reduce((s, st) => s + (st.days ?? 0), 0)
                const preLoiUnattrib    = selectedDeal.preLoiStages.filter(st => st.party === 'unattributed').reduce((s, st) => s + (st.days ?? 0), 0)
                const fullTotal         = preLoiTotal + selectedDeal.totalDays
                const fullInternal      = preLoiInternal + selectedDeal.internalDays
                const fullExternal      = preLoiSeller   + selectedDeal.externalDays
                const fullUnattributed  = preLoiUnattrib + selectedDeal.unattributedDays
                const hasFullCycle      = fullTotal > 0

                return (
                  <>
                    {/* Summary stat row — full cycle */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-zinc-800/60 rounded-lg px-3 py-2.5">
                        <p className="text-zinc-500 text-xs mb-1">Total days</p>
                        <p className="text-zinc-100 text-lg font-medium">{fullTotal}d</p>
                      </div>
                      <div className="bg-zinc-800/60 rounded-lg px-3 py-2.5">
                        <p className="text-zinc-500 text-xs mb-1">Our court</p>
                        <p className="text-teal-400 text-lg font-medium">{fullInternal}d</p>
                      </div>
                      <div className="bg-zinc-800/60 rounded-lg px-3 py-2.5">
                        <p className="text-zinc-500 text-xs mb-1">Seller court</p>
                        <p className="text-rose-400 text-lg font-medium">{fullExternal}d</p>
                      </div>
                    </div>

                    {/* Full-cycle stacked bar */}
                    {hasFullCycle && (
                      <div>
                        <div className="flex justify-between mb-2">
                          <p className="text-zinc-500 text-xs">Time allocation — NDA → close</p>
                          <div className="flex gap-3">
                            <span className="text-teal-400 text-xs">{Math.round((fullInternal / fullTotal) * 100)}% our court</span>
                            <span className="text-rose-400 text-xs">{Math.round((fullExternal / fullTotal) * 100)}% seller</span>
                          </div>
                        </div>
                        {/* Bar: pre-LOI segments (muted) + divider + LOI→APA segments (full color) */}
                        <div className="flex w-full h-4 rounded overflow-hidden bg-zinc-800">
                          {selectedDeal.preLoiStages.map((st, i) => st.days && st.days > 0 ? (
                            <div
                              key={i}
                              style={{ width: `${(st.days / fullTotal) * 100}%` }}
                              className={`h-full ${st.party === 'internal' ? 'bg-teal-300/60' : st.party === 'seller' ? 'bg-rose-300/60' : 'bg-zinc-700'}`}
                              title={`${st.label}: ${st.days}d`}
                            />
                          ) : null)}
                          {/* 1px divider between NDA→LOI and LOI→APA */}
                          {preLoiTotal > 0 && selectedDeal.totalDays > 0 && (
                            <div className="w-px h-full bg-zinc-900 flex-shrink-0" />
                          )}
                          {selectedDeal.internalDays > 0 && (
                            <div
                              style={{ width: `${(selectedDeal.internalDays / fullTotal) * 100}%` }}
                              className="bg-teal-400 h-full"
                              title={`LOI→APA our court: ${selectedDeal.internalDays}d`}
                            />
                          )}
                          {selectedDeal.externalDays > 0 && (
                            <div
                              style={{ width: `${(selectedDeal.externalDays / fullTotal) * 100}%` }}
                              className="bg-rose-400 h-full"
                              title={`LOI→APA seller: ${selectedDeal.externalDays}d`}
                            />
                          )}
                          {selectedDeal.unattributedDays > 0 && (
                            <div
                              style={{ width: `${(selectedDeal.unattributedDays / fullTotal) * 100}%` }}
                              className="bg-zinc-600 h-full"
                            />
                          )}
                        </div>
                        <div className="flex gap-4 mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-zinc-500">
                            <span className="w-2 h-2 rounded-sm bg-teal-300/60 inline-block" />NDA→LOI internal
                          </span>
                          <span className="flex items-center gap-1 text-xs text-zinc-500">
                            <span className="w-2 h-2 rounded-sm bg-rose-300/60 inline-block" />NDA→LOI seller
                          </span>
                          <span className="flex items-center gap-1 text-xs text-zinc-500">
                            <span className="w-2 h-2 rounded-sm bg-teal-400 inline-block" />LOI→APA internal
                          </span>
                          <span className="flex items-center gap-1 text-xs text-zinc-500">
                            <span className="w-2 h-2 rounded-sm bg-rose-400 inline-block" />LOI→APA seller
                          </span>
                        </div>
                      </div>
                    )}

                    {/* NDA → LOI pipeline stages — moved above APA turns */}
                    {selectedDeal.preLoiStages.some(s => s.days !== null) && (
                      <div>
                        <p className="text-zinc-500 text-xs mb-3">NDA → LOI pipeline stages</p>
                        <div className="space-y-0">
                          {selectedDeal.preLoiStages.map((stage, i) => {
                            const partyColor =
                              stage.party === 'internal' ? 'text-teal-400' :
                              stage.party === 'seller'   ? 'text-rose-400' :
                              'text-zinc-600'
                            const isLong = stage.days !== null && stage.days > 30
                            return (
                              <div key={i} className="flex items-center gap-3 py-2 border-b border-zinc-800/60 last:border-0">
                                <div className="flex-1 text-zinc-400 text-xs">{stage.label}</div>
                                <span className={`text-xs font-medium ${isLong ? 'text-amber-400' : 'text-zinc-300'}`}>
                                  {stage.days !== null ? `${stage.days}d` : '—'}
                                </span>
                                <span className={`text-xs w-16 text-right ${partyColor}`}>{stage.party}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* APA turns summary */}
                    {selectedDeal.totalDays > 0 && (
                      <div>
                        <p className="text-zinc-500 text-xs mb-2">APA negotiation turns</p>
                        <div className="flex gap-3 flex-wrap">
                          <span className="text-zinc-300 bg-zinc-800 text-xs px-2.5 py-1 rounded">
                            {selectedDeal.totalTurns} total turns
                          </span>
                          <span className="text-teal-400 bg-teal-400/10 text-xs px-2.5 py-1 rounded">
                            {selectedDeal.aosnTurns} AOSN / Fredrikson
                          </span>
                          <span className="text-rose-400 bg-rose-400/10 text-xs px-2.5 py-1 rounded">
                            {selectedDeal.sellerTurns} seller
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}

              {/* LOI→APA process phases — only for deals with detail */}
              {selectedDeal.preLOIPhases.length > 0 && (
                <div>
                  <p className="text-zinc-500 text-xs mb-3">LOI → APA process phases</p>
                  <div className="space-y-0">
                    {selectedDeal.preLOIPhases.map((phase, i) => {
                      const partyColor =
                        phase.party === 'internal'   ? 'text-teal-400' :
                        phase.party === 'seller'     ? 'text-rose-400' :
                        phase.party === 'counsel'    ? 'text-blue-400' :
                        phase.party === 'thirdparty' ? 'text-amber-400' :
                        'text-zinc-500'
                      return (
                        <div key={phase.key} className="flex items-start gap-3 py-2 border-b border-zinc-800/60 last:border-0">
                          <div className="flex flex-col items-center mt-0.5 flex-shrink-0">
                            <div className="w-2 h-2 rounded-full bg-zinc-600 flex-shrink-0" />
                            {i < selectedDeal.preLOIPhases.length - 1 && (
                              <div className="w-px h-5 bg-zinc-800 mt-0.5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-zinc-300 text-xs">{phase.label}</span>
                            {phase.date ? (
                              <span className="text-zinc-500 text-xs ml-2">
                                {new Date(phase.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                              </span>
                            ) : (
                              <span className="text-zinc-700 text-xs ml-2">date not logged</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {phase.daysFromPrev !== null && (
                              <span className="text-zinc-500 text-xs">{phase.daysFromPrev}d</span>
                            )}
                            <span className={`text-xs ${partyColor}`}>{phase.party}</span>
                          </div>
                        </div>
                      )
                    })}

                    {/* APA turns — only if populated */}
                    {selectedDeal.turns.length > 0 ? selectedDeal.turns.map((turn, i) => {
                      const dirLabel = turn.direction === 'us_to_seller' ? 'us → seller' : 'seller → us'
                      const partyColor =
                        turn.delayParty === 'internal'   ? 'text-teal-400' :
                        turn.delayParty === 'seller'     ? 'text-rose-400' :
                        turn.delayParty === 'counsel'    ? 'text-blue-400' :
                        turn.delayParty === 'thirdparty' ? 'text-amber-400' :
                        'text-zinc-600'
                      return (
                        <div key={`turn-${i}`} className="flex items-start gap-3 py-2 border-b border-zinc-800/60 last:border-0">
                          <div className="flex flex-col items-center mt-0.5 flex-shrink-0">
                            <div className="w-2 h-2 rounded-sm bg-zinc-700 flex-shrink-0" />
                            {i < selectedDeal.turns.length - 1 && (
                              <div className="w-px h-5 bg-zinc-800 mt-0.5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-zinc-400 text-xs">Turn {turn.turnNumber}</span>
                            <span className="text-zinc-600 text-xs ml-2">{dirLabel}</span>
                            {turn.date && (
                              <span className="text-zinc-500 text-xs ml-2">
                                {new Date(turn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {turn.daysToRespond !== null && (
                              <span className={`text-xs ${turn.daysToRespond > 14 ? 'text-rose-400' : 'text-zinc-500'}`}>
                                {turn.daysToRespond}d
                              </span>
                            )}
                            {turn.delayParty && (
                              <span className={`text-xs ${partyColor}`}>{turn.delayParty}</span>
                            )}
                          </div>
                        </div>
                      )
                    }) : (
                      <div className="py-2 text-zinc-700 text-xs">
                        Turn-level detail not yet logged
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* No LOI→APA detail */}
              {selectedDeal.totalDays === 0 && (
                <p className="text-zinc-600 text-xs">LOI → APA detail not yet available for this deal.</p>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Velocity Explorer ────────────────────────────────────────────────────────

const VELOCITY_STAGES = [
  { key: 'avgDaysToNda',    label: 'Eng→NDA',    color: '#818cf8' }, // indigo-400
  { key: 'avgDaysNdaToLoi', label: 'NDA→LOI',    color: '#a78bfa' }, // violet-400
  { key: 'avgDaysLoiToApa', label: 'LOI→APA',    color: '#fbbf24' }, // amber-400
  { key: 'avgDaysApaToClose', label: 'APA→Close', color: '#34d399' }, // emerald-400
] as const

type VelocityStageKey = typeof VELOCITY_STAGES[number]['key']

function velAvg(vals: number[]): number | null {
  const filtered = vals.filter((v) => v != null && !isNaN(v))
  return filtered.length > 0 ? Math.round(filtered.reduce((a, b) => a + b, 0) / filtered.length) : null
}

function HeatmapView({ rows }: { rows: VintageRow[] }) {
  const active = rows.filter((r) => r.engaged > 0)

  // Baseline = avg across all active vintages for each stage
  const baselines: Record<VelocityStageKey, number | null> = {} as any
  for (const s of VELOCITY_STAGES) {
    baselines[s.key] = velAvg(active.map((r) => r[s.key] as number).filter((v) => v != null))
  }

  function cellStyle(val: number | null, baseline: number | null): string {
    if (val == null || baseline == null) return 'text-zinc-600'
    const ratio = (baseline - val) / baseline // positive = faster
    if (ratio > 0.15) return 'bg-emerald-900/60 text-emerald-300'
    if (ratio > 0.05) return 'bg-emerald-900/30 text-emerald-400'
    if (ratio < -0.15) return 'bg-red-900/60 text-red-300'
    if (ratio < -0.05) return 'bg-red-900/30 text-red-400'
    return 'bg-zinc-800/40 text-zinc-300'
  }

  function TrendArrow({ val, baseline }: { val: number | null; baseline: number | null }) {
    if (val == null || baseline == null) return null
    const ratio = (baseline - val) / baseline
    if (ratio > 0.15) return <span className="ml-1 text-[10px] text-emerald-400">↓</span>
    if (ratio < -0.15) return <span className="ml-1 text-[10px] text-red-400">↑</span>
    return null
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left py-2 pr-6 text-xs font-black text-zinc-500 uppercase tracking-widest">Vintage</th>
            {VELOCITY_STAGES.map((s) => (
              <th key={s.key} className="text-center py-2 px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">
                {s.label}
              </th>
            ))}
          </tr>
          <tr className="border-b border-zinc-800/40">
            <td className="py-1 pr-6 text-xs text-zinc-600 italic">Baseline</td>
            {VELOCITY_STAGES.map((s) => (
              <td key={s.key} className="py-1 px-4 text-center text-xs text-zinc-600">
                {baselines[s.key] != null ? `${baselines[s.key]}d` : '—'}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {active.map((r) => (
            <tr key={r.quarter} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
              <td className="py-2.5 pr-6 font-black text-white text-sm">{r.quarter}</td>
              {VELOCITY_STAGES.map((s) => {
                const val = r[s.key] as number | null
                return (
                  <td key={s.key} className={`py-2.5 px-4 text-center text-xs font-bold rounded ${cellStyle(val, baselines[s.key])}`}>
                    {val != null ? (
                      <>{val}d<TrendArrow val={val} baseline={baselines[s.key]} /></>
                    ) : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-zinc-800 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-900/60 inline-block" />Faster than baseline (&gt;15%)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-900/60 inline-block" />Slower than baseline (&gt;15%)</span>
        <span className="text-zinc-600 ml-auto">↓ green = faster · ↑ red = slower</span>
      </div>
    </div>
  )
}

function TrendLinesView({ rows }: { rows: VintageRow[] }) {
  const active = rows.filter((r) => r.engaged > 0)
  const data = active.map((r) => ({
    quarter: r.quarter,
    ...Object.fromEntries(VELOCITY_STAGES.map((s) => [s.label, r[s.key]])),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#71717a' }} />
        <YAxis
          tick={{ fontSize: 11, fill: '#71717a' }}
          label={{ value: 'Avg Days', angle: -90, position: 'insideLeft', fill: '#52525b', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6 }}
          labelStyle={{ color: '#e4e4e7', fontWeight: 700 }}
          itemStyle={{ color: '#a1a1aa' }}
          formatter={(val: any) => val != null ? `${val}d` : '—'}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
        {VELOCITY_STAGES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, fill: s.color }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function BreakdownView({ rows }: { rows: VintageRow[] }) {
  const active = rows.filter((r) =>
    r.engaged > 0 &&
    VELOCITY_STAGES.some((s) => r[s.key] != null)
  )

  const data = active.map((r) => ({
    quarter: r.quarter,
    'Eng→NDA': r.avgDaysToNda ?? 0,
    'NDA→LOI': r.avgDaysNdaToLoi ?? 0,
    'LOI→APA': r.avgDaysLoiToApa ?? 0,
    'APA→Close': r.avgDaysApaToClose ?? 0,
  }))

  const CustomTooltip = ({ active: a, payload, label }: any) => {
    if (!a || !payload?.length) return null
    const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0)
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded p-3 text-xs">
        <p className="font-black text-white mb-1.5">{label}</p>
        {payload.map((p: any) => p.value > 0 && (
          <p key={p.dataKey} style={{ color: p.fill }}>{p.dataKey}: {p.value}d</p>
        ))}
        <p className="text-zinc-400 mt-1.5 border-t border-zinc-700 pt-1.5">Total: {total}d</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3">Stacked avg days per stage contributing to total cycle time</p>
      <ResponsiveContainer width="100%" height={Math.max(180, active.length * 44)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#71717a' }} unit="d" />
          <YAxis type="category" dataKey="quarter" tick={{ fontSize: 11, fill: '#a1a1aa' }} width={60} />
          <Tooltip content={<CustomTooltip />} />
          {VELOCITY_STAGES.map((s) => (
            <Bar key={s.label} dataKey={s.label} stackId="a" fill={s.color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function VelocityExplorer() {
  const [rows, setRows] = useState<VintageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'heatmap' | 'trends' | 'breakdown' | 'accountability'>('heatmap')

  useEffect(() => {
    fetch('/api/dashboard/vintages')
      .then((r) => r.json())
      .then((d) => { if (d.vintages) setRows(d.vintages) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const views = [
    { key: 'heatmap' as const,        label: 'Stage Duration Heatmap' },
    { key: 'trends' as const,         label: 'Velocity Trend Lines' },
    { key: 'breakdown' as const,      label: 'Days-to-Close Breakdown' },
    { key: 'accountability' as const, label: 'Accountability Split' },
  ]

  if (loading) return (
    <div className={`${card} p-6`}>
      <div className="h-4 w-48 bg-zinc-800 rounded animate-pulse mb-4" />
      <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />)}</div>
    </div>
  )

  return (
    <div className={`${card} overflow-hidden`}>
      <div className={cardPad}>
        <div className="mb-5">
          <h2 className={h2Cls}>Velocity Explorer</h2>
          <p className={`text-xs ${mutedCls} mt-0.5`}>Pipeline cycle time analysis by vintage cohort — lower days = faster progression</p>
        </div>

        {/* Inner tab switcher */}
        <div className="flex gap-1 mb-5 bg-zinc-900 rounded-lg p-1 w-fit">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                view === v.key ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {view === 'heatmap'    && <HeatmapView rows={rows} />}
        {view === 'trends'     && <TrendLinesView rows={rows} />}
        {view === 'breakdown'  && <BreakdownView rows={rows} />}
        {view === 'accountability' && (
          <div>
            {APA_DEAL_DATA.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-12">
                No sub-phase data yet.
              </p>
            ) : (
              <>
                {/* Only showing Dr. Casey Stepnik (Great Lakes Vet Dermatology) and Dr. Judy Force (Dentistry for Animals) */}
                {(() => {
                  const DOCTOR_DEALS: Record<string, string> = {
                    'Great Lakes Veterinary Dermatology': 'Dr. Casey Stepnik',
                    'Dentistry for Animals':              'Dr. Judy Force',
                  }
                  const focusedData = APA_DEAL_DATA.filter(d => d.dealName in DOCTOR_DEALS)

                  {/* Stat cards — post-LOI only */}
                  const withData = focusedData.filter(d => d.totalDays > 0)
                  const avgExt   = Math.round(withData.reduce((s, d) => s + (d.externalDays / d.totalDays) * 100, 0) / withData.length)
                  const avgInt   = Math.round(withData.reduce((s, d) => s + (d.internalDays / d.totalDays) * 100, 0) / withData.length)
                  const avgTurns = (withData.reduce((s, d) => s + d.totalTurns, 0) / withData.length).toFixed(1)

                  {/* Stat cards — full cycle (NDA→LOI + LOI→APA) — commented out for now
                  const withDataFull = APA_DEAL_DATA.filter(d => {
                    const preLoiTotal = d.preLoiStages.reduce((s, st) => s + (st.days ?? 0), 0)
                    return (preLoiTotal + d.totalDays) > 0
                  })
                  const avgExtFull = Math.round(withDataFull.reduce((s, d) => {
                    const preLoiTotal    = d.preLoiStages.reduce((a, st) => a + (st.days ?? 0), 0)
                    const preLoiSeller   = d.preLoiStages.filter(st => st.party === 'seller').reduce((a, st) => a + (st.days ?? 0), 0)
                    const fullTotal      = preLoiTotal + d.totalDays
                    const fullExternal   = preLoiSeller + d.externalDays
                    return s + (fullExternal / fullTotal) * 100
                  }, 0) / withDataFull.length)
                  const avgIntFull = Math.round(withDataFull.reduce((s, d) => {
                    const preLoiTotal    = d.preLoiStages.reduce((a, st) => a + (st.days ?? 0), 0)
                    const preLoiInternal = d.preLoiStages.filter(st => st.party === 'internal').reduce((a, st) => a + (st.days ?? 0), 0)
                    const fullTotal      = preLoiTotal + d.totalDays
                    const fullInternal   = preLoiInternal + d.internalDays
                    return s + (fullInternal / fullTotal) * 100
                  }, 0) / withDataFull.length)
                  */}

                  const maxTurns = Math.max(...focusedData.map(d => d.turns.length))
                  const chartData = focusedData.map(d => {
                    const entry: Record<string, number | string> = { name: DOCTOR_DEALS[d.dealName] }
                    d.turns.forEach((t, i) => { entry[`t${i}`] = t.daysToRespond ?? 0 })
                    return entry
                  })

                  return (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-zinc-900/60 rounded-lg px-4 py-3">
                          <p className="text-zinc-500 text-xs mb-1">Avg seller % (LOI→APA)</p>
                          <p className="text-rose-400 text-xl font-medium">{avgExt}%</p>
                        </div>
                        <div className="bg-zinc-900/60 rounded-lg px-4 py-3">
                          <p className="text-zinc-500 text-xs mb-1">Avg internal % (LOI→APA)</p>
                          <p className="text-teal-400 text-xl font-medium">{avgInt}%</p>
                        </div>
                        <div className="bg-zinc-900/60 rounded-lg px-4 py-3">
                          <p className="text-zinc-500 text-xs mb-1">Avg turns / deal (LOI→APA)</p>
                          <p className="text-zinc-200 text-xl font-medium">{avgTurns}</p>
                        </div>
                      </div>

                      {/* Stacked horizontal bar chart — per-turn slivers */}
                      <ResponsiveContainer width="100%" height={focusedData.length * 52 + 40}>
                        <BarChart
                          data={chartData}
                          layout="vertical"
                          margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
                          barSize={26}
                        >
                          <XAxis
                            type="number"
                            tick={{ fill: '#71717a', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            tickCount={6}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={160}
                            tick={{ fill: '#a1a1aa', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                            content={(props) => {
                              if (!props.active || !props.payload?.length) return null
                              const label = props.label as string
                              const deal = focusedData.find(d => DOCTOR_DEALS[d.dealName] === label)
                              if (!deal) return null
                              const items = (props.payload as any[]).filter(p => (p.value ?? 0) > 0)
                              if (!items.length) return null
                              return (
                                <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                                  <p style={{ color: '#a1a1aa', marginBottom: 4 }}>{label}</p>
                                  {items.map((p: any) => {
                                    const idx = parseInt(p.dataKey.replace('t', ''))
                                    const turn = deal.turns[idx]
                                    if (!turn) return null
                                    const party = turn.direction === 'us_to_seller' ? 'seller court' : 'our court'
                                    const color = turn.direction === 'us_to_seller' ? '#fb7185' : '#2dd4bf'
                                    return <p key={p.dataKey} style={{ color, margin: '2px 0' }}>{`Turn ${turn.turnNumber}: ${p.value}d (${party})`}</p>
                                  })}
                                </div>
                              )
                            }}
                          />
                          {Array.from({ length: maxTurns }, (_, i) => (
                            <Bar key={i} dataKey={`t${i}`} stackId="a" isAnimationActive={false}>
                              {focusedData.map((d, di) => {
                                const turn = d.turns[i]
                                const days = turn?.daysToRespond ?? 0
                                if (!turn || days === 0) return <Cell key={di} fill="transparent" />
                                return <Cell key={di} fill={turn.direction === 'us_to_seller' ? '#fb7185' : '#2dd4bf'} />
                              })}
                              <LabelList
                                dataKey={`t${i}`}
                                position="insideLeft"
                                style={{ fontSize: 11, fontWeight: 500, fill: '#fff' }}
                                formatter={(v: unknown) => typeof v === 'number' && v > 8 ? `${v}d` : ''}
                              />
                            </Bar>
                          ))}
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Legend */}
                      <div className="flex gap-4 mt-4 flex-wrap">
                        {[
                          { color: 'bg-teal-400', label: 'Our court' },
                          { color: 'bg-rose-400', label: 'Seller court' },
                        ].map(({ color, label }) => (
                          <span key={label} className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <span className={`w-2.5 h-2.5 rounded-sm ${color} inline-block`} />
                            {label}
                          </span>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [deals, setDeals] = useState<DealItem[]>([])
  const [closedWonIds, setClosedWonIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [tab, setTab] = useState<'dashboard' | 'pipeline' | 'weekly'>('dashboard')
  const [actuals, setActuals] = useState<PipelineActuals>(DEFAULT_ACTUALS)
  const [weeklyHistory, setWeeklyHistory] = useState<WeekPoint[]>([])
  const [lastWeekStart, setLastWeekStart] = useState<string>('')

  const loadDeals = useCallback(async (syncFirst = false) => {
    setLoading(true)
    setError(null)
    try {
      if (syncFirst) {
        await fetch('/api/dashboard/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'deals' }),
        })
      }
      const [res, closedRes] = await Promise.all([
        fetch('/api/dashboard/pipeline?isOpenOnly=true'),
        fetch('/api/dashboard/pipeline?isOpenOnly=false'),
      ])
      const data = await res.json()
      const closedData = await closedRes.json()
      if (data.error) {
        setError(data.error)
      } else if (data.deals) {
        const savedNotes: Record<string, string> = JSON.parse(lsGet('aosn_notes_v1') || '{}')
        setDeals(data.deals.map((raw: any) => {
          const d = transformDeal(raw)
          if (savedNotes[d.id]) d.nextSteps = savedNotes[d.id]
          return d
        }))
        setLastSync(new Date().toLocaleTimeString())
      }
      if (closedData.deals) {
        setClosedWonIds(new Set(
          closedData.deals.filter((d: any) => d.stage === 'Closed Won').map((d: any) => d.dealId)
        ))
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadDeals(false) }, [loadDeals])

  useEffect(() => {
    fetch('/api/dashboard/pipeline-stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.actuals) setActuals(data.actuals)
        if (data.weeklyHistory) setWeeklyHistory(data.weeklyHistory)
        if (data.lastWeekStart) setLastWeekStart(data.lastWeekStart)
      })
      .catch(console.error)
  }, [])

  const handleNotesChange = (id: string, notes: string) => {
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, nextSteps: notes } : d)))
    const saved: Record<string, string> = JSON.parse(lsGet('aosn_notes_v1') || '{}')
    saved[id] = notes
    lsSet('aosn_notes_v1', JSON.stringify(saved))
  }

  const atRiskCount = deals.filter(isAtRisk).length

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">AOSN M&A Pipeline</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              2026 Acquisition Plan · {deals.length} active deals ·{' '}
              {atRiskCount > 0 && <span className="text-red-400 font-semibold">{atRiskCount} at risk</span>}
              {lastSync && <span className="text-zinc-600"> · synced {lastSync}</span>}
            </p>
          </div>
          <button
            onClick={() => loadDeals(true)}
            disabled={loading}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 ${loading ? 'bg-zinc-800 text-zinc-500' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>⟳</span>
            {loading ? 'Syncing HubSpot…' : 'Sync & Refresh'}
          </button>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm mb-4">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-zinc-900 rounded-lg p-1 w-fit border border-zinc-700">
          {([['dashboard', '📊 Dashboard'], ['pipeline', '🏗 Pipeline'], ['weekly', '📅 Weekly Changes']] as [typeof tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${tab === k ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}>
              {l}
            </button>
          ))}
        </div>

        {loading && deals.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-zinc-900 animate-pulse rounded-xl border border-zinc-800" />
            ))}
          </div>
        ) : (
          <>
            {tab === 'dashboard' && (
              <>
                <EBITDATargetBar deals={deals} closedEBITDA={actuals.closedEBITDA} />
                <OutreachSection actuals={actuals} weeklyHistory={weeklyHistory} lastWeekStart={lastWeekStart} />
                <PipelineVelocityScorecard deals={deals} />
                <VintageAnalysis />
                <VelocityExplorer />
                <TopPriorities deals={deals} actuals={actuals} />
              </>
            )}
            {tab === 'pipeline' && (
              <DealPipelineTable deals={deals} onNotesChange={handleNotesChange} />
            )}
            {tab === 'weekly' && <WeeklyChanges deals={deals} closedWonIds={closedWonIds} />}
          </>
        )}
      </div>
    </div>
  )
}
