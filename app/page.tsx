'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell
} from 'recharts'
import { Card, StatCard } from '@/components/ui/Card'
import { TrendingUp } from 'lucide-react'

export default function OverviewPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/overview')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse font-bold uppercase tracking-widest">Loading Q1 Performance...</div>

  const lastActiveWeekIndex = [...data.weeklyData].reverse().findIndex((w: any) => w.actual > 0)
  const currentWeekIdx = lastActiveWeekIndex === -1 ? 0 : 11 - lastActiveWeekIndex
  const currentStatus = data.weeklyData[currentWeekIdx]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Q1 Outreach Performance</h2>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Marketing Plan vs. Real-time Actuals</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Q1 Total Goal" value={data.q1TotalTarget} sublabel="Total touches target" color="gray" />
        <StatCard label="Actual to Date" value={data.q1TotalActual} sublabel={`${((data.q1TotalActual / data.q1TotalTarget) * 100).toFixed(1)}% of Q1 complete`} color="blue" />
        <StatCard 
          label="Current Delta" 
          value={currentStatus.cumulativeDelta > 0 ? `+${currentStatus.cumulativeDelta}` : currentStatus.cumulativeDelta} 
          sublabel="Ahead/Behind budget" 
          color={currentStatus.cumulativeDelta >= 0 ? 'green' : 'rose'}
        />
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-lg">
            <TrendingUp className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pace Status</div>
            <div className="text-2xl font-black text-gray-900">{currentStatus.cumulativeDelta >= 0 ? 'AHEAD' : 'BEHIND'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm">Q1 Cumulative Progress</h3>
            <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-600" /> Actual</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-gray-300" /> Target</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.weeklyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} domain={[0, 'auto']} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700 }} />
              <Area type="monotone" dataKey="cumulativeTarget" stroke="#d1d5db" fill="#f3f4f6" strokeWidth={2} />
              <Area type="monotone" dataKey="cumulativeActual" stroke="#2563eb" fill="#dbeafe" strokeWidth={4} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm mb-6">Weekly Performance Variance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.weeklyData.slice(0, currentWeekIdx + 1)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                {data.weeklyData.slice(0, currentWeekIdx + 1).map((entry: any, index: number) => (
                  <Cell key={index} fill={entry.delta >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card padding="none">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm">Q1 Marketing Outreach Ledger</h3>
          <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-1 rounded uppercase tracking-widest shadow-sm shadow-blue-100">Live HubSpot Sync</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white border-b border-gray-100">
                <th className="text-left py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest">Period</th>
                <th className="text-right py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest">Budget</th>
                <th className="text-right py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest">Tier 1</th>
                <th className="text-right py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest">Tier 2</th>
                <th className="text-right py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest">Actual</th>
                <th className="text-right py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest">Delta</th>
                <th className="text-right py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest">Cumulative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.weeklyData.map((w: any) => (
                <tr key={w.week} className={w.actual > 0 ? 'bg-white' : 'bg-gray-50/30'}>
                  <td className="py-4 px-4 font-black text-gray-900">{w.week}</td>
                  <td className="py-4 px-4 text-right font-bold text-gray-400">{w.target}</td>
                  <td className="py-4 px-4 text-right font-black text-purple-600">{w.tier1 > 0 ? w.tier1 : '—'}</td>
                  <td className="py-4 px-4 text-right font-black text-blue-600">{w.tier2 > 0 ? w.tier2 : '—'}</td>
                  <td className="py-4 px-4 text-right">
                    <span className={`inline-block font-black text-gray-900 ${w.actual > 0 ? 'bg-gray-100' : 'text-gray-300'} px-3 py-1 rounded-lg text-xs`}>
                      {w.actual > 0 ? w.actual : 0}
                    </span>
                  </td>
                  <td className={`py-4 px-4 text-right font-black text-xs ${w.delta >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                    {w.delta > 0 ? `+${w.delta}` : w.delta}
                  </td>
                  <td className="py-4 px-4 text-right font-black text-gray-900 bg-blue-50/30">
                    {w.cumulativeActual}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
