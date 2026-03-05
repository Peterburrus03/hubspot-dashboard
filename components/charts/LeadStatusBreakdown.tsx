'use client'

import { useState, Fragment } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card } from '@/components/ui/Card'

interface StatusRow {
  status: string
  total: number
  byOwner: { ownerId: string; ownerName: string; count: number }[]
}

interface LeadStatusBreakdownProps {
  data: StatusRow[]
  totalContacts: number
  loading: boolean
}

const STATUS_COLORS: Record<string, string> = {
  'New': '#3b82f6',
  'Open': '#22c55e',
  'In Progress': '#f97316',
  'Open Deal': '#8b5cf6',
  'Unqualified': '#6b7280',
  'Attempted to Contact': '#f59e0b',
  'Connected': '#14b8a6',
  'Bad Timing': '#ec4899',
  'Requested Removal From List': '#ef4444',
  'No Status': '#d1d5db',
}

function getColor(status: string, index: number): string {
  if (STATUS_COLORS[status]) return STATUS_COLORS[status]
  const palette = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#f59e0b', '#14b8a6', '#ec4899']
  return palette[index % palette.length]
}

export default function LeadStatusBreakdown({
  data = [],
  totalContacts = 0,
  loading,
}: LeadStatusBreakdownProps) {
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null)

  if (loading) {
    return (
      <Card>
        <div className="h-64 bg-gray-100 animate-pulse rounded" />
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-base font-semibold text-gray-800 mb-2">Lead Status Breakdown</h3>
        <p className="text-gray-500 text-sm text-center py-6">
          No contact data found. Run a sync first.
        </p>
      </Card>
    )
  }

  const chartData = data.map((row, i) => ({
    status:
      row.status.length > 20 ? row.status.slice(0, 18) + '…' : row.status,
    fullStatus: row.status,
    Count: row.total,
    pct: totalContacts > 0 ? ((row.total / totalContacts) * 100).toFixed(1) : '0',
    color: getColor(row.status, i),
  }))

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">
            Lead Status Breakdown
          </h3>
          <span className="text-sm text-gray-500">{totalContacts.toLocaleString()} total contacts</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="status"
              width={150}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value, _name, props) => [
                `${(value ?? 0).toLocaleString()} (${props.payload?.pct ?? 0}%)`,
                props.payload.fullStatus,
              ]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
            />
            <Bar dataKey="Count" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Status detail table */}
      <Card padding="sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Lead Status
              </th>
              <th className="text-right py-2 px-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Contacts
              </th>
              <th className="text-right py-2 px-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                % of Total
              </th>
              <th className="py-2 pl-4" />
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <Fragment key={row.status}>
                <tr
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: getColor(row.status, i) }}
                      />
                      <span className="font-medium text-gray-800">{row.status}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-gray-800">
                    {row.total.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-500">
                    {totalContacts > 0
                      ? ((row.total / totalContacts) * 100).toFixed(1) + '%'
                      : '—'}
                  </td>
                  <td className="py-2.5 pl-4">
                    {row.byOwner.length > 0 && (
                      <button
                        onClick={() =>
                          setExpandedStatus(expandedStatus === row.status ? null : row.status)
                        }
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        {expandedStatus === row.status ? 'Hide' : 'By owner'}
                      </button>
                    )}
                  </td>
                </tr>

                {expandedStatus === row.status && (
                  <tr key={`${row.status}-detail`}>
                    <td colSpan={4} className="bg-gray-50 px-6 py-3">
                      <div className="flex flex-wrap gap-2">
                        {row.byOwner.map((o) => (
                          <div
                            key={o.ownerId}
                            className="flex items-center gap-1.5 bg-white border border-gray-200 rounded px-2.5 py-1"
                          >
                            <span className="text-xs text-gray-700">{o.ownerName}</span>
                            <span className="text-xs font-semibold text-gray-800">
                              {o.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
