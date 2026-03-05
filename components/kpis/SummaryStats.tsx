import { StatCard } from '@/components/ui/Card'
import type { ActivitySummary } from '@/types/hubspot'

interface SummaryStatsProps {
  summary: ActivitySummary | null
  loading: boolean
}

export default function SummaryStats({ summary, loading }: SummaryStatsProps) {
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
    summary.totalNotes +
    summary.totalMeetings +
    summary.totalSequenceTouches +
    summary.totalTasks

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
        label="Notes Created"
        value={summary.totalNotes}
        sublabel="Contact notes"
        color="purple"
      />
      <StatCard
        label="Meetings Booked"
        value={summary.totalMeetings}
        sublabel="Scheduled meetings"
        color="orange"
      />
      <StatCard
        label="Sequence Touches"
        value={summary.totalSequenceTouches}
        sublabel="Automated + enrollments"
        color="rose"
      />
    </div>
  )
}
