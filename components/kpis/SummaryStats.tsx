import { StatCard } from '@/components/ui/Card'
import type { ActivitySummary } from '@/types/hubspot'

interface SummaryStatsProps {
  summary: ActivitySummary | null
  loading: boolean
  taskCategories?: { label: string; count: number }[]
}

export default function SummaryStats({ summary, loading, taskCategories = [] }: SummaryStatsProps) {
  const catCount = taskCategories.length || 1
  const totalCols = 4 + catCount // Total, Emails, Calls, Meetings + one per category

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!summary) return null

  const total =
    summary.totalEmails +
    summary.totalCalls +
    summary.totalMeetings +
    summary.totalTasks

  const CATEGORY_COLORS: Record<string, 'blue' | 'green' | 'rose' | 'purple' | 'orange' | 'gray'> = {
    'LinkedIn Outreach': 'blue',
    'Postal / Snail Mail Letter': 'purple',
    'Greeting Card / Gift Card': 'rose',
    'FedEx Letter': 'orange',
    'Text': 'green',
    'Peer to Peer': 'orange',
    'Other': 'gray',
    'Uncategorized': 'gray',
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-${Math.min(totalCols, 6)} gap-4`}>
      <StatCard
        label="Total Activities"
        value={total}
        sublabel="All engagement types"
        color="gray"
      />
      <StatCard
        label="Emails Sent"
        value={summary.totalEmails}
        sublabel="Manual outbound"
        color="blue"
      />
      <StatCard
        label="Calls Logged"
        value={summary.totalCalls}
        sublabel="Outbound & inbound"
        color="green"
      />
      <StatCard
        label="Meetings Booked"
        value={summary.totalMeetings}
        sublabel="Scheduled meetings"
        color="orange"
      />
      {taskCategories.length > 0 ? (
        taskCategories.map(({ label, count }) => (
          <StatCard
            key={label}
            label={label}
            value={count}
            sublabel="Sales activity"
            color={CATEGORY_COLORS[label] ?? 'gray'}
          />
        ))
      ) : (
        <StatCard
          label="Sales Activity"
          value={summary.totalTasks}
          sublabel="Completed tasks"
          color="rose"
        />
      )}
    </div>
  )
}
