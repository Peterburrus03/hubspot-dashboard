'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY = new Date()
const NDA_DEADLINE = new Date('2026-09-07')
const CURRENT_MONTH = TODAY.getMonth() + 1

const STAGE_PLAN_DAYS: Record<string, number> = {
  'Engaged': 14,
  'Data Collection (including NDA)': 21,
  'Pre-LOI Analysis': 14,
  'Presented to Growth Committee': 7,
  'LOI Signed/Diligence': 30,
  'LOI Extended': 30,
  'APA Signed': 30,
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
  'LOI Signed/Diligence',
  'LOI Extended',
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

interface ActivityBreakdown { emails: number; calls: number; notes: number; meetings: number }
interface PipelineActuals {
  wtdOutreach: number; mtdOutreach: number; ytdOutreach: number
  wtdNDAs: number; mtdNDAs: number; ytdNDAs: number
  ytdNDADvms: number; ytdLOIs: number; ytdAPAs: number; closedEBITDA: number
  breakdown?: { wtd: ActivityBreakdown; mtd: ActivityBreakdown; ytd: ActivityBreakdown }
}
interface WeekPoint { week: string; outreach: number; ndas: number }

const DEFAULT_ACTUALS: PipelineActuals = {
  wtdOutreach: 0, mtdOutreach: 0, ytdOutreach: 0,
  wtdNDAs: 0, mtdNDAs: 0, ytdNDAs: 0,
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
    crmStage: raw.stage || 'Engaged',
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
  return (
    days > plan * 1.5 ||
    close > new Date('2026-12-31') ||
    (['Engaged', 'Data Collection (including NDA)', 'Pre-LOI Analysis'].includes(deal.crmStage) && days > plan * 2)
  )
}

async function callAI(body: object): Promise<any> {
  const res = await fetch('/api/ai/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
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

function OutreachSection({ actuals, weeklyHistory }: { actuals: PipelineActuals; weeklyHistory: WeekPoint[] }) {
  const [showDetail, setShowDetail] = useState(false)
  const mGoal = TARGETS.monthlyOutreach[CURRENT_MONTH] || 318
  const mNdaGoal = TARGETS.monthlyNDAs[CURRENT_MONTH] || 9
  const chartStyle = { fontSize: 10, fill: '#71717a' }
  const conversionRate = actuals.ytdOutreach > 0 ? ((actuals.ytdNDAs / actuals.ytdOutreach) * 100).toFixed(1) : '—'

  const TYPE_META = [
    { key: 'emails' as const, label: 'Emails', icon: '✉️', color: '#818cf8' },
    { key: 'calls' as const, label: 'Calls', icon: '📞', color: '#34d399' },
    { key: 'meetings' as const, label: 'Meetings', icon: '🤝', color: '#fbbf24' },
    { key: 'notes' as const, label: 'Notes', icon: '📝', color: '#f87171' },
  ]
  return (
    <div className={card}><div className={cardPad}>
      <h2 className={h2Cls}>Outreach & NDA Tracker</h2>
      <p className={`text-xs ${mutedCls} mb-5 mt-0.5`}>68 contacts/week · 2 NDAs/week · 1,820 total by Sep 7</p>
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <div className="text-xs font-bold text-indigo-400 uppercase tracking-wide mb-3">📞 Outreach Contacts</div>
          <div className="flex justify-around">
            <MiniGauge actual={actuals.wtdOutreach} goal={TARGETS.weeklyOutreach} color="#818cf8" label="WTD" sublabel={`goal ${TARGETS.weeklyOutreach}`} />
            <MiniGauge actual={actuals.mtdOutreach} goal={mGoal} color="#818cf8" label="MTD" sublabel={`goal ${mGoal}`} />
            <MiniGauge actual={actuals.ytdOutreach} goal={TARGETS.totalOutreach} color="#818cf8" label="YTD" sublabel={`goal ${TARGETS.totalOutreach}`} />
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-purple-400 uppercase tracking-wide mb-3">📋 NDAs Signed</div>
          <div className="flex justify-around">
            <MiniGauge actual={actuals.wtdNDAs} goal={TARGETS.weeklyNDAs} color="#c084fc" label="WTD" sublabel={`goal ${TARGETS.weeklyNDAs}`} />
            <MiniGauge actual={actuals.mtdNDAs} goal={mNdaGoal} color="#c084fc" label="MTD" sublabel={`goal ${mNdaGoal}`} />
            <MiniGauge actual={actuals.ytdNDAs} goal={TARGETS.totalNDAs} color="#c084fc" label="YTD" sublabel={`goal ${TARGETS.totalNDAs}`} />
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
            <div className={`${labelCls} mb-3`}>Activity by type</div>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-zinc-500 font-semibold pb-2 w-32">Type</th>
                  <th className="text-right text-zinc-500 font-semibold pb-2">WTD</th>
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
                    <td className="text-right text-zinc-300 font-mono py-2">{actuals.breakdown!.wtd[key]}</td>
                    <td className="text-right text-zinc-300 font-mono py-2">{actuals.breakdown!.mtd[key]}</td>
                    <td className="text-right text-zinc-300 font-mono py-2">{actuals.breakdown!.ytd[key]}</td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-700">
                  <td className="py-2 text-zinc-400 font-bold">Total</td>
                  <td className="text-right text-white font-bold font-mono py-2">{actuals.wtdOutreach}</td>
                  <td className="text-right text-white font-bold font-mono py-2">{actuals.mtdOutreach}</td>
                  <td className="text-right text-white font-bold font-mono py-2">{actuals.ytdOutreach}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div></div>
  )
}

// ─── PipelineWeightedTiming ───────────────────────────────────────────────────

function PipelineWeightedTiming({ deals }: { deals: DealItem[] }) {
  const activeStages = CRM_STAGE_ORDER.filter((s) => s !== 'Closed' && s !== 'APA Signed')
  const GLOBAL_MAX = 120
  const stageData = activeStages.map((stage) => {
    const sd = deals.filter((d) => d.crmStage === stage)
    const totalE = sd.reduce((s, d) => s + (d.ebitda || 1), 0)
    const wtd = sd.length ? sd.reduce((s, d) => s + daysInStage(d) * (d.ebitda || 1), 0) / totalE : 0
    const plan = STAGE_PLAN_DAYS[stage] || 14
    const actual = Math.round(wtd)
    const diff = actual - plan
    const lbl =
      stage === 'Data Collection (including NDA)' ? 'NDA' :
      stage === 'Presented to Growth Committee' ? 'Growth Cmte' :
      stage === 'LOI Signed/Diligence' ? 'LOI' :
      stage === 'LOI Extended' ? 'LOI Extended' : stage
    return { label: lbl, fullStage: stage, actual, plan, diff, over: diff > 0, count: sd.length }
  })
  const totalBehind = stageData.filter((s) => s.over && s.count > 0).reduce((sum, s) => sum + s.diff, 0)
  const totalAhead = stageData.filter((s) => !s.over && s.count > 0).reduce((sum, s) => sum + Math.abs(s.diff), 0)
  const netDays = totalBehind - totalAhead
  const isNetBehind = netDays > 0

  return (
    <div className={`${card} overflow-hidden`}><div className={cardPad}>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className={h2Cls}>Pipeline Velocity — Days in Stage</h2>
          <p className={`text-xs ${mutedCls} mt-0.5`}>EBITDA-weighted avg · vertical line = plan target</p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded inline-block bg-emerald-500" />On track</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded inline-block bg-red-500" />Over plan</span>
        </div>
      </div>
      <div className="space-y-4">
        {stageData.map((s) => {
          const isEmpty = s.count === 0
          const color = s.over ? '#f87171' : '#34d399'
          const actualW = Math.min(Math.round((s.actual / GLOBAL_MAX) * 100), 92)
          const planW = Math.min(Math.round((s.plan / GLOBAL_MAX) * 100), 92)
          return (
            <div key={s.fullStage} className="flex items-center gap-3">
              <div className="w-28 flex-shrink-0 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">{s.label}</span>
                {s.count > 0 && (
                  <span className="text-xs font-bold rounded-full px-1.5 py-0.5 text-black flex-shrink-0"
                    style={{ background: CRM_STAGE_COLORS[s.fullStage], fontSize: '10px' }}>{s.count}</span>
                )}
              </div>
              <div className="flex-1 relative" style={{ height: 44 }}>
                {isEmpty ? (
                  <div className="absolute top-2 left-0 right-0 h-8 rounded-lg bg-zinc-800 border border-dashed border-zinc-600 flex items-center px-3">
                    <span className="text-xs text-zinc-600">No deals</span>
                  </div>
                ) : (
                  <>
                    <div className="absolute top-2 left-0 right-0 h-8 rounded-lg bg-zinc-800" />
                    <div className="absolute top-2 left-0 h-8 rounded-lg transition-all" style={{ width: actualW + '%', background: color }} />
                    <div className="absolute flex items-center h-8 z-20" style={{ top: 2, left: actualW + '%' }}>
                      <span className="text-xs font-black ml-2 whitespace-nowrap" style={{ color }}>{s.actual}d</span>
                    </div>
                    <div className="absolute z-10" style={{ left: planW + '%', top: 0, bottom: 0 }}>
                      <span className="absolute text-zinc-400 font-bold whitespace-nowrap bg-zinc-900 px-1 rounded border border-zinc-600"
                        style={{ fontSize: '10px', bottom: '100%', marginBottom: 2, transform: 'translateX(-50%)' }}>
                        {s.plan}d
                      </span>
                      <div className="absolute h-8 w-0.5 bg-zinc-400" style={{ top: 8 }} />
                    </div>
                  </>
                )}
              </div>
              <div className="w-20 flex-shrink-0 text-right">
                {!isEmpty && (
                  s.over
                    ? <span className="text-xs font-bold text-red-400">+{s.diff}d behind</span>
                    : <span className="text-xs font-bold text-emerald-400">{Math.abs(s.diff)}d ahead</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
    <div className={`px-6 py-3 flex items-center justify-center ${isNetBehind ? 'bg-red-950 border-t border-red-800' : 'bg-emerald-950 border-t border-emerald-800'}`}>
      <span className={`text-sm font-black ${isNetBehind ? 'text-red-400' : 'text-emerald-400'}`}>
        Net: {isNetBehind ? `+${netDays}d behind plan` : `${Math.abs(netDays)}d ahead of plan`} across all stages
      </span>
    </div></div>
  )
}

// ─── TopPriorities ────────────────────────────────────────────────────────────

function TopPriorities({ deals, actuals }: { deals: DealItem[]; actuals: PipelineActuals }) {
  const EMPTY = [1, 2, 3, 4, 5].map((id) => ({ id, text: '', impact: '', done: false }))
  const [priorities, setPriorities] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const hasGenerated = useRef(false)

  useEffect(() => {
    fetch('/api/dashboard/priorities')
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0 && rows[0].text) {
          setPriorities(rows)
          hasGenerated.current = true
        } else if (!hasGenerated.current) {
          generate()
        }
      })
      .catch(() => { if (!hasGenerated.current) generate() })
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
    if (hasGenerated.current && loading) return
    hasGenerated.current = true
    setLoading(true)
    try {
      const probWtd = (deals.reduce((s, d) => s + d.ebitda * d.prob, 0) / 1000).toFixed(1)
      const gap = ((TARGETS.totalEBITDA - deals.reduce((s, d) => s + d.ebitda * d.prob, 0)) / 1000).toFixed(1)
      const daysLeft = Math.max(0, Math.floor((NDA_DEADLINE.getTime() - TODAY.getTime()) / 86400000))
      const loiDeals = deals.filter((d) => ['LOI Signed/Diligence', 'LOI Extended'].includes(d.crmStage))
      const atRisk = deals.filter(isAtRisk).map((d) => d.name).join(', ') || 'None'
      const prompt = `You are the M&A chief of staff for AOSN (Animal Outpatient Specialty Network). Today is ${TODAY.toDateString()}.\n\nTARGETS: $18.9M EBITDA | 60 NDAs | 23 APAs | 1,820 outreach\nACTUALS: ${actuals.ytdNDAs} NDAs | ${actuals.ytdLOIs} LOIs | ${actuals.ytdAPAs} APAs | ${actuals.ytdOutreach} outreach | $${(actuals.closedEBITDA / 1000).toFixed(1)}M closed\nPIPELINE: ${probWtd}M prob-wtd | Gap: ${gap}M | ${daysLeft} days to NDA deadline\nLOI DEALS: ${loiDeals.map((d) => `${d.name} ${(d.ebitda / 1000).toFixed(1)}M`).join('; ')}\nAT RISK: ${atRisk}\n\nReturn ONLY a raw JSON array of exactly 5 objects with two fields: "priority" (action, max 12 words) and "impact" (specific $ or metric impact, max 10 words). No markdown, no explanation.`
      const data = await callAI({ model: 'claude-sonnet-4-6', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
      const raw = data.content?.find((b: any) => b.type === 'text')?.text || '[]'
      const arr = JSON.parse(raw.replace(/```json|```/g, '').trim())
      const updated = arr.slice(0, 5).map((item: any, i: number) => ({
        id: i + 1,
        text: typeof item === 'string' ? item : (item.priority || ''),
        impact: typeof item === 'object' ? (item.impact || '') : '',
        done: false,
      }))
      save(updated)
    } catch (e) {
      console.error('Priority generation failed:', e)
      hasGenerated.current = false
    }
    setLoading(false)
  }

  return (
    <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>This Week — Top Priorities</div>
          <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>AI-generated based on live pipeline gaps & goals</div>
        </div>
        <button onClick={generate} disabled={loading}
          style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {loading ? '⏳ Generating…' : '✦ Regenerate'}
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
          {loading ? [1, 2, 3, 4, 5].map((i) => (
            <tr key={i} style={{ borderTop: '1px solid #27272a' }}>
              <td style={{ padding: '12px', color: '#52525b', fontSize: 11 }}>{i}</td>
              <td style={{ padding: '12px' }}><div style={{ height: 14, background: '#27272a', borderRadius: 4, width: '70%' }} /></td>
              <td /><td style={{ padding: '12px' }}><div style={{ height: 14, background: '#27272a', borderRadius: 4, width: '40%' }} /></td>
            </tr>
          )) : priorities.map((p, i) => (
            <tr key={p.id} style={{ borderTop: '1px solid #27272a', background: p.done ? 'rgba(6,78,59,0.2)' : 'transparent' }}>
              <td style={{ padding: '8px 12px', color: '#52525b', fontSize: 11, fontWeight: 600 }}>{i + 1}</td>
              <td style={{ padding: '8px 12px' }}>
                <input type="text" value={p.text} placeholder="Click Regenerate to generate priorities…"
                  onChange={(e) => update(p.id, 'text', e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: '1px solid #3f3f46', borderRadius: 6, padding: '6px 10px', color: p.done ? '#52525b' : '#f4f4f5', fontSize: 13, outline: 'none', textDecoration: p.done ? 'line-through' : 'none', boxSizing: 'border-box' }} />
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                <span onClick={() => toggle(p.id)} style={{ fontSize: 22, cursor: 'pointer', color: p.done ? '#34d399' : '#3f3f46', userSelect: 'none' }}>✓</span>
              </td>
              <td style={{ padding: '8px 16px', maxWidth: 320 }}>
                {p.impact
                  ? <span style={{ color: '#e4e4e7', fontSize: 12, lineHeight: '1.5' }}>{p.impact}</span>
                  : <span style={{ color: '#3f3f46', fontSize: 12, fontStyle: 'italic' }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

// ─── AIChat ───────────────────────────────────────────────────────────────────

function AIChat({ deals, actuals }: { deals: DealItem[]; actuals: PipelineActuals }) {
  const [msgs, setMsgs] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    if (!input.trim()) return
    const userMsg = input.trim()
    setInput('')
    const newMsgs = [...msgs, { role: 'user', content: userMsg }]
    setMsgs(newMsgs)
    setLoading(true)
    try {
      const ctx = `You are an M&A pipeline analyst for AOSN. Today is ${TODAY.toDateString()}. TARGETS: $18.9M EBITDA | 60 NDAs | 23 APAs | 1,820 outreach. NDA DEADLINE: Sep 7 (${Math.floor((NDA_DEADLINE.getTime() - TODAY.getTime()) / 86400000)} days). YTD: ${actuals.ytdNDAs} NDAs | ${actuals.ytdLOIs} LOIs | ${actuals.ytdOutreach} outreach | $${(actuals.closedEBITDA / 1000).toFixed(1)}M closed. PIPELINE: ${(deals.reduce((s, d) => s + d.ebitda * d.prob, 0) / 1000).toFixed(1)}M prob-wtd.\n${deals.map((d) => `- ${d.name} | ${d.crmStage} | ${d.dvms} DVMs | ${d.ebitda}K | ${daysInStage(d)}d | ${isAtRisk(d) ? 'AT RISK' : 'ok'}`).join('\n')}`
      const data = await callAI({ model: 'claude-sonnet-4-6', max_tokens: 1000, system: ctx, messages: newMsgs })
      setMsgs((m) => [...m, { role: 'assistant', content: data.content?.find((b: any) => b.type === 'text')?.text || 'No response.' }])
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Error contacting API.' }])
    }
    setLoading(false)
  }

  return (
    <div className={card}>
      <div className={`${cardPad} border-b border-zinc-700`}>
        <h2 className={h2Cls}>AI Pipeline Analysis</h2>
        <p className={`text-xs ${mutedCls} mt-0.5`}>Full pipeline context · gaps · risk · NDA deadline</p>
      </div>
      <div className="p-4 h-64 overflow-y-auto space-y-3 bg-zinc-950">
        {msgs.length === 0 && (
          <div className="text-xs text-zinc-600 text-center mt-20">
            Try: "What's the EBITDA gap?" · "Which deals are at risk?" · "How many NDAs do we need per week?"
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={'text-sm rounded-xl px-3 py-2 max-w-lg ' + (m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 border border-zinc-700 text-zinc-200')}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="text-sm bg-zinc-800 border border-zinc-700 text-zinc-500 rounded-xl px-3 py-2">Thinking…</div>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-zinc-700 flex gap-2">
        <input
          className="flex-1 bg-zinc-800 border border-zinc-600 text-zinc-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 placeholder-zinc-600"
          placeholder="Ask about the pipeline…" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button onClick={send} disabled={loading}
          className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  )
}

// ─── WeeklyChanges ────────────────────────────────────────────────────────────

interface SnapshotDeal { dealId: string; dealName: string | null; stage: string | null; ebitda: number | null; probability: number | null }

function WeeklyChanges({ deals }: { deals: DealItem[] }) {
  const [snapshot, setSnapshot] = useState<{ snapshotAt: string | null; deals: SnapshotDeal[] }>({ snapshotAt: null, deals: [] })
  const [snapping, setSnapping] = useState(false)
  const [loadingSnap, setLoadingSnap] = useState(true)
  const [aiSummary, setAiSummary] = useState<{ headline: string; summary: string } | null>(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const hasAutoGenerated = useRef(false)

  useEffect(() => {
    fetch('/api/snapshots')
      .then((r) => r.json())
      .then((data) => { setSnapshot(data); return data })
      .catch(console.error)
      .finally(() => setLoadingSnap(false))
  }, [])

  const takeSnapshot = async () => {
    setSnapping(true)
    try {
      await fetch('/api/snapshots', { method: 'POST' })
      const res = await fetch('/api/snapshots')
      setSnapshot(await res.json())
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

  type DealChange = { type: 'new' | 'removed' | 'stage'; deal: DealItem | SnapshotDeal; prior?: SnapshotDeal; change: string }
  const dealChanges: DealChange[] = []
  deals.forEach((curr) => {
    const prior = snapMap.get(curr.id)
    if (!prior) { dealChanges.push({ type: 'new', deal: curr, change: 'New deal added to pipeline' }) }
    else if (prior.stage !== curr.crmStage) { dealChanges.push({ type: 'stage', deal: curr, prior, change: `${STAGE_SHORT[prior.stage!] || prior.stage} → ${STAGE_SHORT[curr.crmStage] || curr.crmStage}` }) }
  })
  snapshot.deals.forEach((prior) => {
    if (!currentMap.has(prior.dealId)) dealChanges.push({ type: 'removed', deal: prior, change: 'Removed from pipeline' })
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

  const unchanged = deals.filter((d) => !dealChanges.find((c) => ('id' in c.deal ? (c.deal as DealItem).id : (c.deal as SnapshotDeal).dealId) === d.id))

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
          <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Weekly Summary — {thisWeekLabel}</div>
          <div className="flex gap-2">
            <button onClick={takeSnapshot} disabled={snapping}
              style={{ background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: snapping ? 'not-allowed' : 'pointer', opacity: snapping ? 0.6 : 1 }}>
              {snapping ? '⏳ Saving…' : '📸 New Snapshot'}
            </button>
            <button onClick={generateAISummary} disabled={loadingAI}
              style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: loadingAI ? 'not-allowed' : 'pointer', opacity: loadingAI ? 0.6 : 1 }}>
              {loadingAI ? '⏳ Generating…' : '✦ Refresh'}
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
          { label: 'Active Deals', prior: String(snapshot.deals.length), current: String(deals.length), delta: deals.length - snapshot.deals.length, prefix: '', suffix: '', desc: `${dealChanges.filter(c => c.type === 'new').length} added · ${dealChanges.filter(c => c.type === 'removed').length} dropped` },
          { label: 'Stage Changes', prior: '—', current: String(dealChanges.filter(c => c.type === 'stage').length), delta: dealChanges.filter(c => c.type === 'stage').length, prefix: '', suffix: '', desc: `${dealChanges.filter(c => c.type === 'new').length} new · ${dealChanges.filter(c => c.type === 'removed').length} removed` },
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
                    <tr key={i} style={{ borderTop: '1px solid #27272a', background: c.type === 'new' ? 'rgba(99,102,241,0.07)' : c.type === 'removed' ? 'rgba(248,113,113,0.07)' : 'transparent' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ color: '#f4f4f5', fontSize: 12, fontWeight: 600, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        {doctor && <div style={{ color: '#71717a', fontSize: 11 }}>{doctor}</div>}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {specialty && <span style={{ color: '#a1a1aa', fontSize: 11, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 4, padding: '2px 6px' }}>{specialty}</span>}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#f4f4f5', fontWeight: 700, fontSize: 13 }}>${(ebitda / 1000).toFixed(2)}M</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px', background: c.type === 'new' ? 'rgba(99,102,241,0.2)' : c.type === 'removed' ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.15)', color: c.type === 'new' ? '#818cf8' : c.type === 'removed' ? '#f87171' : '#fbbf24', border: `1px solid ${c.type === 'new' ? '#4f46e5' : c.type === 'removed' ? '#ef4444' : '#d97706'}` }}>
                          {c.type === 'new' ? '🆕 New' : c.type === 'removed' ? '❌ Dropped' : '⬆ Stage Change'}
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

export default function PipelinePage() {
  const [deals, setDeals] = useState<DealItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [tab, setTab] = useState<'dashboard' | 'pipeline' | 'weekly' | 'ai'>('dashboard')
  const [actuals, setActuals] = useState<PipelineActuals>(DEFAULT_ACTUALS)
  const [weeklyHistory, setWeeklyHistory] = useState<WeekPoint[]>([])

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
      const res = await fetch('/api/dashboard/pipeline?isOpenOnly=true')
      const data = await res.json()
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
          {([['dashboard', '📊 Dashboard'], ['pipeline', '🏗 Pipeline'], ['weekly', '📅 Weekly Changes'], ['ai', '🤖 AI Analysis']] as [typeof tab, string][]).map(([k, l]) => (
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
                <OutreachSection actuals={actuals} weeklyHistory={weeklyHistory} />
                <PipelineWeightedTiming deals={deals} />
                <TopPriorities deals={deals} actuals={actuals} />
              </>
            )}
            {tab === 'pipeline' && (
              <DealPipelineTable deals={deals} onNotesChange={handleNotesChange} />
            )}
            {tab === 'weekly' && <WeeklyChanges deals={deals} />}
            {tab === 'ai' && <AIChat deals={deals} actuals={actuals} />}
          </>
        )}
      </div>
    </div>
  )
}
