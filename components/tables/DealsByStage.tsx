'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { ChevronDown, ChevronRight, User, LayoutGrid, Zap, Coffee, CheckCircle2 } from 'lucide-react'

interface Deal {
  dealId: string
  dealName: string | null
  stage: string | null
  revenue: number | null
  weightedAmount: number | null
  probability: number | null
  ownerName: string
  specialty: string | null
  city: string | null
  state: string | null
}

interface DealsByStageProps {
  deals: Deal[]
  loading: boolean
}

interface GroupDefinition {
  id: string
  label: string
  icon: any
  color: string
  stages: string[]
}

const GROUPS: GroupDefinition[] = [
  {
    id: 'top',
    label: 'Top of Funnel',
    icon: LayoutGrid,
    color: 'text-blue-600 bg-blue-50',
    stages: ['Sourcing / Research', 'Initial Outreach', 'Second Outreach', 'Third Outreach', 'Forward to Location', 'Future Interest']
  },
  {
    id: 'nurture',
    label: 'Closed Nurture',
    icon: Coffee,
    color: 'text-amber-600 bg-amber-50',
    stages: ['Closed Nurture']
  },
  {
    id: 'active',
    label: 'Active Pipeline',
    icon: Zap,
    color: 'text-green-600 bg-green-50',
    stages: ['Engaged', 'Data Collection (including NDA)', 'Pre-LOI Analysis', 'Presented to Growth Committee', 'Presented to Deal Committee', 'LOI Extended', 'LOI Signed/Diligence']
  },
  {
    id: 'post',
    label: 'Post Active Pipeline',
    icon: CheckCircle2,
    color: 'text-gray-600 bg-gray-50',
    stages: ['Closed Won', 'Closed Lost', 'Closed PASS']
  }
]

export default function DealsByStage({ deals, loading }: DealsByStageProps) {
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({})

  const groupedData = useMemo(() => {
    // 1. Group by exact stage name first
    const stageMap: Record<string, { deals: Deal[], totalRevenue: number, totalWeighted: number }> = {}
    
    deals.forEach(deal => {
      const rawStage = deal.stage ?? 'Unknown Stage'
      const stage = rawStage.trim()
      if (!stageMap[stage]) {
        stageMap[stage] = { deals: [], totalRevenue: 0, totalWeighted: 0 }
      }
      stageMap[stage].deals.push(deal)
      stageMap[stage].totalRevenue += deal.revenue ?? 0
      stageMap[stage].totalWeighted += deal.weightedAmount ?? 0
    })

    // 2. Assign stages to logical sections
    const sections = GROUPS.map(group => {
      const stagesInGroup = Object.entries(stageMap)
        .filter(([stageName]) => {
          // Match if it's in the list OR if it's a "Post Active" catch-all for unknown stages
          const isInList = group.stages.some(s => stageName.toLowerCase().includes(s.toLowerCase().trim()))
          return isInList
        })
        .sort((a, b) => b[1].totalRevenue - a[1].totalRevenue)

      const sectionTotalRevenue = stagesInGroup.reduce((sum, [_, data]) => sum + data.totalRevenue, 0)
      const sectionTotalWeighted = stagesInGroup.reduce((sum, [_, data]) => sum + data.totalWeighted, 0)
      const sectionDealCount = stagesInGroup.reduce((sum, [_, data]) => sum + data.deals.length, 0)

      return {
        ...group,
        stages: stagesInGroup,
        totalRevenue: sectionTotalRevenue,
        totalWeighted: sectionTotalWeighted,
        count: sectionDealCount
      }
    })

    // 3. Catch any stages that didn't fit into a group and put them in "Post Active"
    const matchedStages = new Set(sections.flatMap(s => s.stages.map(st => st[0])))
    const unmatchedStages = Object.entries(stageMap).filter(([name]) => !matchedStages.has(name))
    
    if (unmatchedStages.length > 0) {
      const postSection = sections.find(s => s.id === 'post')!
      postSection.stages.push(...unmatchedStages)
      postSection.totalRevenue += unmatchedStages.reduce((sum, [_, data]) => sum + data.totalRevenue, 0)
      postSection.totalWeighted += unmatchedStages.reduce((sum, [_, data]) => sum + data.totalWeighted, 0)
      postSection.count += unmatchedStages.reduce((sum, [_, data]) => sum + data.deals.length, 0)
    }

    return sections.filter(s => s.count > 0)
  }, [deals])

  const toggleStage = (stage: string) => {
    setExpandedStages(prev => ({
      ...prev,
      [stage]: !prev[stage]
    }))
  }

  if (loading) {
    return (
      <Card>
        <div className="h-64 bg-gray-100 animate-pulse rounded" />
      </Card>
    )
  }

  if (deals.length === 0) {
    return (
      <Card>
        <h3 className="text-base font-semibold text-gray-800 mb-2">Deals by Stage</h3>
        <p className="text-gray-500 text-sm text-center py-6">No deal data found for the selected filters.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-10">
      {groupedData.map((section) => (
        <div key={section.id} className="space-y-4">
          {/* Section Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${section.color}`}>
                <section.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">{section.label}</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {section.count} Deals • ${(section.totalRevenue / 1000).toFixed(0)}k Total
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {section.stages.map(([stageName, data]) => (
              <div key={stageName} className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <button 
                  onClick={() => toggleStage(stageName)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {expandedStages[stageName] ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <h4 className="font-bold text-gray-800">{stageName}</h4>
                      <p className="text-xs text-gray-500 font-medium">{data.deals.length} deals</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-8">
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 uppercase font-black tracking-tighter">Revenue</div>
                      <div className="text-sm font-black text-blue-600">${(data.totalRevenue / 1000).toFixed(0)}k</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-[10px] text-gray-400 uppercase font-black tracking-tighter">Weighted</div>
                      <div className="text-sm font-black text-green-600">${(data.totalWeighted / 1000).toFixed(0)}k</div>
                    </div>
                  </div>
                </button>

                {expandedStages[stageName] && (
                  <div className="border-t border-gray-100 overflow-x-auto bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-widest">Deal Name</th>
                          <th className="text-left py-2.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-widest">Director</th>
                          <th className="text-left py-2.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-widest">Specialty</th>
                          <th className="text-right py-2.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-widest">Revenue</th>
                          <th className="text-right py-2.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-widest">Prob%</th>
                          <th className="text-right py-2.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-widest">Weighted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.deals.map((deal) => (
                          <tr key={deal.dealId} className="hover:bg-blue-50/50 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-gray-900">{deal.dealName || 'Unnamed Deal'}</div>
                              <div className="text-[11px] text-gray-500 font-medium">{deal.city}, {deal.state}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                                <User className="w-3.5 h-3.5 text-gray-300" />
                                {deal.ownerName}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-gray-600 font-medium">{deal.specialty || '—'}</td>
                            <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                              ${(deal.revenue ?? 0).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-right text-gray-400 font-medium">
                              {((deal.probability ?? 0) * 100).toFixed(0)}%
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-blue-600">
                              ${(deal.weightedAmount ?? 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
