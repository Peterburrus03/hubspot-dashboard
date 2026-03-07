import { StatCard } from '@/components/ui/Card'

interface PipelineSummary {
  totalDeals: number
  totalRevenue: number
  totalWeighted: number
}

interface PipelineStatsProps {
  summary: PipelineSummary | null
  loading: boolean
}

export default function PipelineStats({ summary, loading }: PipelineStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!summary) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <StatCard
        label="Total Deals"
        value={summary.totalDeals}
        sublabel="Open pipeline deals"
        color="gray"
      />
      <StatCard
        label="Total Pipeline Revenue"
        value={`$${(summary.totalRevenue / 1000000).toFixed(1)}M`}
        sublabel="Face value"
        color="blue"
      />
      <StatCard
        label="Weighted Pipeline"
        value={`$${(summary.totalWeighted / 1000000).toFixed(1)}M`}
        sublabel="Probability adjusted"
        color="green"
      />
    </div>
  )
}
