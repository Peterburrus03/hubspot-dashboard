'use client'

import { useState, useCallback, useEffect } from 'react'
import FilterBar, { FilterState } from '@/components/filters/FilterBar'
import { Card, StatCard } from '@/components/ui/Card'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts'
import { Zap, Clock, Users, ArrowUpRight, Mail, Phone, Calendar as CalendarIcon } from 'lucide-react'

function buildParams(filters: FilterState): string {
  const p = new URLSearchParams()
  if (filters.ownerIds.length) p.set('ownerIds', filters.ownerIds.join(','))
  if (filters.specialties.length) p.set('specialties', filters.specialties.join(','))
  if (filters.companyTypes.length) p.set('companyTypes', filters.companyTypes.join(','))
  return p.toString()
}

export default function TrendsPage() {
  const [filters, setFilters] = useState<FilterState | null>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  const fetchData = useCallback(async (f: FilterState) => {
    const qs = buildParams(f)
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/trends?${qs}`)
      const d = await res.json()
      setData(d)
    } catch (err) {
      console.error('Failed to load trends')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (filters) fetchData(filters)
  }, [filters, fetchData])

  if (loading && !data) return <div className="p-8 text-center text-gray-500 animate-pulse font-bold uppercase tracking-widest">Analyzing Outreach Trends...</div>

  const pieData = data?.summary?.typeDistribution ? [
    { name: 'Manual Email', value: data.summary.typeDistribution.manualEmail, color: '#3b82f6' },
    { name: 'Automated Email', value: data.summary.typeDistribution.automatedEmail, color: '#8b5cf6' },
    { name: 'Calls', value: data.summary.typeDistribution.calls, color: '#22c55e' },
    { name: 'Meetings', value: data.summary.typeDistribution.meetings, color: '#f97316' },
  ].filter(d => d.value > 0) : []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic">Outreach Trends</h2>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Analyzing the Path to Engagement</p>
      </div>

      <FilterBar onFilterChange={setFilters} />

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              label="Avg. Touches" 
              value={data.summary.avgTouches.toFixed(1)} 
              sublabel="Before reaching 'Engaged'" 
              color="blue" 
            />
            <StatCard 
              label="Avg. Days" 
              value={data.summary.avgDays.toFixed(0)} 
              sublabel="From first to last touch" 
              color="purple" 
            />
            <StatCard 
              label="Successful Leads" 
              value={data.summary.totalSuccessfulLeads} 
              sublabel="Active pipeline or higher" 
              color="green" 
            />
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <ArrowUpRight className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Efficiency</div>
                <div className="text-2xl font-black text-gray-900">HIGH</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Outreach Mix */}
            <Card>
              <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm mb-6">Winning Outreach Mix</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Path Length Distribution */}
            <Card>
              <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm mb-6">Touches per Successful Deal</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.attribution.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="dealName" 
                    tick={false} 
                    label={{ value: 'Successful Deals', position: 'insideBottom', offset: -5, fontSize: 10, fontWeight: 700 }} 
                  />
                  <YAxis tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="totalTouches" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Success Stories Table */}
          <Card padding="none">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm">Individual Attribution Paths</h3>
              <span className="text-[10px] font-black bg-green-600 text-white px-2 py-1 rounded uppercase tracking-widest shadow-sm shadow-green-100">Success Profiles</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white border-b border-gray-100">
                    <th className="text-left py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest">Deal Profile</th>
                    <th className="text-left py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest">Current Stage</th>
                    <th className="text-right py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest text-blue-600">Manual Email</th>
                    <th className="text-right py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest text-purple-600">Automated</th>
                    <th className="text-right py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest text-green-600">Calls</th>
                    <th className="text-right py-4 px-4 font-black text-gray-400 text-[10px] uppercase tracking-widest text-orange-600">Meetings</th>
                    <th className="text-right py-4 px-4 font-black text-gray-900 text-[10px] uppercase tracking-widest">Total Touches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.attribution.slice(0, 50).map((a: any) => (
                    <tr key={a.contactId} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-black text-gray-900">{a.dealName || 'Unnamed Deal'}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Path Duration: {a.durationDays} days</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-1 rounded-full uppercase tracking-tighter border border-blue-100">
                          {a.stage}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-black text-blue-600">{a.counts.EMAIL || '—'}</td>
                      <td className="py-4 px-4 text-right font-black text-purple-600">{a.counts.AUTOMATED || '—'}</td>
                      <td className="py-4 px-4 text-right font-black text-green-600">{a.counts.CALL || '—'}</td>
                      <td className="py-4 px-4 text-right font-black text-orange-600">{a.counts.MEETING || '—'}</td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-block font-black text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg text-xs border border-gray-200">
                          {a.totalTouches}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
