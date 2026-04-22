'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card } from '@/components/ui/Card'

interface OwnerRow {
  ownerId: string
  ownerName: string
  emails: number
  calls: number
  meetings: number
  tasks: number
  taskCategories: Record<string, number>
  sequenceTouches: number
  contactsReached: number
  followUps: { contactId: string; contactName: string; touchCount: number; lastTouch: string | null }[]
}

interface ActivityByOwnerProps {
  data: OwnerRow[]
  loading: boolean
}

const BASE_COLORS = {
  emails: '#3b82f6',
  calls: '#22c55e',
  meetings: '#f97316',
  sequenceTouches: '#f43f5e',
}

const CATEGORY_COLORS: Record<string, string> = {
  'LinkedIn Outreach':          '#6366f1',
  'Postal / Snail Mail Letter': '#8b5cf6',
  'Greeting Card / Gift Card':  '#ec4899',
  'FedEx Letter':               '#0ea5e9',
  'Text':                       '#14b8a6',
  'Peer to Peer':               '#f59e0b',
  'Check-in / In Town':         '#0284c7',
  'Other':                      '#94a3b8',
  'Uncategorized':              '#cbd5e1',
}

export default function ActivityByOwner({ data = [], loading }: ActivityByOwnerProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (loading) {
    return <Card><div className="h-72 bg-gray-100 animate-pulse rounded" /></Card>
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <p className="text-gray-500 text-sm text-center py-8">
          No activity data for the selected period. Run a sync first.
        </p>
      </Card>
    )
  }

  // Collect all category labels present across all owners (for consistent bars)
  const allCategories = Array.from(
    new Set(data.flatMap((r) => Object.keys(r.taskCategories ?? {})))
  ).sort((a, b) => {
    const order = ['LinkedIn Outreach', 'Postal / Snail Mail Letter', 'Greeting Card / Gift Card', 'FedEx Letter', 'Text', 'Peer to Peer', 'Check-in / In Town', 'Other', 'Uncategorized']
    return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99)
  })

  const chartData = data.map((row) => {
    const entry: Record<string, string | number> = {
      name: row.ownerName.split(' ')[0],
      fullName: row.ownerName,
      Emails: row.emails,
      Calls: row.calls,
      Meetings: row.meetings,
    }
    for (const cat of allCategories) {
      entry[cat] = row.taskCategories?.[cat] ?? 0
    }
    return entry
  })

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-base font-semibold text-gray-800 mb-4">Activity by Team Member</h3>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={chartData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(value, name) => [(value ?? 0).toLocaleString(), name]}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Emails" stackId="a" fill={BASE_COLORS.emails} />
            <Bar dataKey="Calls" stackId="a" fill={BASE_COLORS.calls} />
            <Bar dataKey="Meetings" stackId="a" fill={BASE_COLORS.meetings} />
            {allCategories.map((cat, i) => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="a"
                fill={CATEGORY_COLORS[cat] ?? '#94a3b8'}
                radius={i === allCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Per-director detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map((row) => (
          <Card key={row.ownerId} padding="sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800">{row.ownerName}</h4>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {row.contactsReached} contacts
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              {[
                { label: 'Emails', value: row.emails, color: 'text-blue-600' },
                { label: 'Calls', value: row.calls, color: 'text-green-600' },
                { label: 'Meetings', value: row.meetings, color: 'text-orange-600' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className={`text-lg font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              ))}
            </div>

            {/* Sales Activity categories */}
            {Object.keys(row.taskCategories ?? {}).length > 0 && (
              <div className="border-t border-gray-100 pt-2 mt-1">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Sales Activity</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(row.taskCategories).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border"
                      style={{ color: CATEGORY_COLORS[label] ?? '#94a3b8', borderColor: CATEGORY_COLORS[label] ?? '#94a3b8', background: (CATEGORY_COLORS[label] ?? '#94a3b8') + '15' }}
                    >
                      {label} · {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {row.followUps.length > 0 && (
              <>
                <button
                  onClick={() => setExpanded(expanded === row.ownerId ? null : row.ownerId)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-3"
                >
                  {expanded === row.ownerId ? 'Hide' : 'Show'} contact follow-ups ({row.followUps.length})
                </button>
                {expanded === row.ownerId && (
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                    {row.followUps.slice(0, 50).map((fu) => (
                      <div key={fu.contactId} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                        <span className="text-gray-700 truncate max-w-[65%]">{fu.contactName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">{fu.touchCount}x</span>
                          {fu.lastTouch && (
                            <span className="text-gray-400">
                              {new Date(fu.lastTouch).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
