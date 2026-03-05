'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/Card'

interface ActivityRow {
  ownerId: string
  ownerName: string
  emails: number
  calls: number
  notes: number
  meetings: number
  tasks: number
  sequenceTouches: number
  contactsReached: number
  followUps: { contactId: string; contactName: string; touchCount: number; lastTouch: string | null }[]
}

interface ActivityTableProps {
  data: ActivityRow[]
  loading: boolean
}

type SortKey = 'ownerName' | 'emails' | 'calls' | 'notes' | 'meetings' | 'tasks' | 'sequenceTouches' | 'contactsReached' | 'total'
type SortDir = 'asc' | 'desc'

export default function ActivityTable({ data = [], loading }: ActivityTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [view, setView] = useState<'owner' | 'contact'>('owner')
  const [search, setSearch] = useState('')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedData = useMemo(() => {
    const filtered = data.filter((row) =>
      row.ownerName.toLowerCase().includes(search.toLowerCase())
    )
    return filtered.sort((a, b) => {
      if (sortKey === 'ownerName') {
        return sortDir === 'asc'
          ? a.ownerName.localeCompare(b.ownerName)
          : b.ownerName.localeCompare(a.ownerName)
      }
      const total = (row: typeof a) => row.emails + row.calls + row.notes + row.meetings + row.tasks + row.sequenceTouches
      const aVal = sortKey === 'total' ? total(a) : (a as any)[sortKey]
      const bVal = sortKey === 'total' ? total(b) : (b as any)[sortKey]
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [data, sortKey, sortDir, search])

  // Flatten contact-level view
  const contactRows = useMemo(() => {
    const rows: {
      ownerName: string
      contactName: string
      touchCount: number
      lastTouch: string | null
    }[] = []
    for (const owner of data) {
      for (const fu of owner.followUps) {
        if (
          !search ||
          owner.ownerName.toLowerCase().includes(search.toLowerCase()) ||
          fu.contactName.toLowerCase().includes(search.toLowerCase())
        ) {
          rows.push({
            ownerName: owner.ownerName,
            contactName: fu.contactName,
            touchCount: fu.touchCount,
            lastTouch: fu.lastTouch,
          })
        }
      }
    }
    return rows.sort((a, b) => b.touchCount - a.touchCount)
  }, [data, search])

  function exportCSV() {
    let csv = ''
    if (view === 'owner') {
      csv = [
        'BD Director,Emails,Calls,Notes,Meetings,Tasks,Seq. Touches,Contacts Reached,Total Activity',
        ...sortedData.map((r) =>
          [
            `"${r.ownerName}"`,
            r.emails,
            r.calls,
            r.notes,
            r.meetings,
            r.tasks,
            r.sequenceTouches,
            r.contactsReached,
            r.emails + r.calls + r.notes + r.meetings + r.sequenceTouches,
          ].join(',')
        ),
      ].join('\n')
    } else {
      csv = [
        'BD Director,Contact,Touch Count,Last Touch',
        ...contactRows.map((r) =>
          [`"${r.ownerName}"`, `"${r.contactName}"`, r.touchCount, r.lastTouch ?? ''].join(',')
        ),
      ].join('\n')
    }

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `activity-${view}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-800">Raw Activity Data</h3>
          <div className="flex border border-gray-200 rounded overflow-hidden text-xs">
            <button
              onClick={() => setView('owner')}
              className={`px-3 py-1.5 ${view === 'owner' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              By Director
            </button>
            <button
              onClick={() => setView('contact')}
              className={`px-3 py-1.5 ${view === 'contact' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              By Contact
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-40"
          />
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-48 bg-gray-100 animate-pulse rounded" />
      ) : view === 'owner' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {(
                  [
                    ['BD Director', 'ownerName'],
                    ['Emails', 'emails'],
                    ['Calls', 'calls'],
                    ['Notes', 'notes'],
                    ['Meetings', 'meetings'],
                    ['Tasks', 'tasks'],
                    ['Seq. Touches', 'sequenceTouches'],
                    ['Contacts', 'contactsReached'],
                    ['Total', 'total'],
                  ] as [string, SortKey][]
                ).map(([label, key]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="py-2 px-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none whitespace-nowrap"
                  >
                    {label}
                    <SortIcon col={key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row) => {
                const total = row.emails + row.calls + row.notes + row.meetings + row.sequenceTouches
                return (
                  <tr key={row.ownerId} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-800">{row.ownerName}</td>
                    <td className="py-2.5 px-3 text-blue-600 font-medium">{row.emails}</td>
                    <td className="py-2.5 px-3 text-green-600 font-medium">{row.calls}</td>
                    <td className="py-2.5 px-3 text-purple-600 font-medium">{row.notes}</td>
                    <td className="py-2.5 px-3 text-orange-600 font-medium">{row.meetings}</td>
                    <td className="py-2.5 px-3 text-gray-500">{row.tasks}</td>
                    <td className="py-2.5 px-3 text-rose-600 font-medium">{row.sequenceTouches}</td>
                    <td className="py-2.5 px-3 text-gray-600">{row.contactsReached}</td>
                    <td className="py-2.5 px-3 font-bold text-gray-900">{total}</td>
                  </tr>
                )
              })}
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-gray-400 text-sm">
                    No results
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 px-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                  BD Director
                </th>
                <th className="py-2 px-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Contact
                </th>
                <th className="py-2 px-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Touches
                </th>
                <th className="py-2 px-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Last Touch
                </th>
              </tr>
            </thead>
            <tbody>
              {contactRows.slice(0, 200).map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 px-3 text-gray-700">{row.ownerName}</td>
                  <td className="py-2.5 px-3 font-medium text-gray-800">{row.contactName}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-blue-600">
                    {row.touchCount}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-500">
                    {row.lastTouch
                      ? new Date(row.lastTouch).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
              {contactRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400 text-sm">
                    No results
                  </td>
                </tr>
              )}
              {contactRows.length > 200 && (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-gray-400 text-xs">
                    Showing first 200 of {contactRows.length} — export CSV for full dataset
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
