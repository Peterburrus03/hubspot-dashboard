'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import { Card } from '@/components/ui/Card'

interface StageRow {
  stage: string
  revenue: number
  weighted: number
  count: number
}

interface PipelineByStageProps {
  data: StageRow[]
  loading: boolean
}

const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#f59e0b', '#14b8a6', '#ec4899', '#ef4444']

export default function PipelineByStage({ data, loading }: PipelineByStageProps) {
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
        <h3 className="text-base font-semibold text-gray-800 mb-2">Pipeline by Stage</h3>
        <p className="text-gray-500 text-sm text-center py-6">No deal data found.</p>
      </Card>
    )
  }

  const chartData = data.map((row) => ({
    stage: row.stage.length > 20 ? row.stage.slice(0, 18) + '…' : row.stage,
    fullStage: row.stage,
    Revenue: row.revenue,
    Weighted: row.weighted,
    Count: row.count,
  }))

  return (
    <Card>
      <h3 className="text-base font-semibold text-gray-800 mb-4">Pipeline by Stage (Revenue)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="stage" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value, name) => [`$${(value as number).toLocaleString()}`, name]}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullStage ?? label}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
          />
          <Legend />
          <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Weighted" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
