'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'

interface SequenceRow {
  sequenceId: string
  sequenceName: string
  totalEnrolled: number
  active: number
  finished: number
  unenrolled: number
  byOwner: { ownerId: string; ownerName: string; count: number }[]
}

interface SequencePerformanceProps {
  data: SequenceRow[]
  loading: boolean
}

export default function SequencePerformance({ data = [], loading }: SequencePerformanceProps) {
  const [expandedSeq, setExpandedSeq] = useState<string | null>(null)

  if (loading) {
    return (
      <Card>
        <div className="h-48 bg-gray-100 animate-pulse rounded" />
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-base font-semibold text-gray-800 mb-2">Sequence Performance</h3>
        <p className="text-gray-500 text-sm text-center py-6">
          No sequence enrollment data found. Ensure sequence enrollment sync has run.
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <h3 className="text-base font-semibold text-gray-800 mb-4">
        Sequence Performance
        <span className="ml-2 text-sm font-normal text-gray-500">({data.length} sequences)</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Sequence
              </th>
              <th className="text-right py-2 px-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Enrolled
              </th>
              <th className="text-right py-2 px-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Active
              </th>
              <th className="text-right py-2 px-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Finished
              </th>
              <th className="text-right py-2 pl-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Unenrolled
              </th>
              <th className="py-2 pl-4" />
            </tr>
          </thead>
          <tbody>
            {data.map((seq) => (
              <>
                <tr
                  key={seq.sequenceId}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-2.5 pr-4">
                    <span className="font-medium text-gray-800">{seq.sequenceName}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-gray-800">
                    {seq.totalEnrolled}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="text-blue-600 font-medium">{seq.active}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="text-green-600 font-medium">{seq.finished}</span>
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <span className="text-gray-400">{seq.unenrolled}</span>
                  </td>
                  <td className="py-2.5 pl-4">
                    {seq.byOwner.length > 0 && (
                      <button
                        onClick={() =>
                          setExpandedSeq(expandedSeq === seq.sequenceId ? null : seq.sequenceId)
                        }
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        {expandedSeq === seq.sequenceId ? 'Hide' : 'By director'}
                      </button>
                    )}
                  </td>
                </tr>

                {expandedSeq === seq.sequenceId && (
                  <tr key={`${seq.sequenceId}-detail`}>
                    <td colSpan={6} className="bg-blue-50 px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        {seq.byOwner.map((o) => (
                          <div
                            key={o.ownerId}
                            className="flex items-center gap-1.5 bg-white border border-blue-100 rounded px-2.5 py-1"
                          >
                            <span className="text-xs text-gray-700">{o.ownerName}</span>
                            <span className="text-xs font-semibold text-blue-700">
                              {o.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
