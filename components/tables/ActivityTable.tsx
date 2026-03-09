'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { X, Phone, Mail, FileText, CalendarDays, Tablet } from 'lucide-react'
import { format } from 'date-fns'

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

const TYPE_ICON: Record<string, React.ReactNode> = {
  CALL:    <Phone className="w-3.5 h-3.5" />,
  EMAIL:   <Mail className="w-3.5 h-3.5" />,
  NOTE:    <FileText className="w-3.5 h-3.5" />,
  MEETING: <CalendarDays className="w-3.5 h-3.5" />,
  IPAD_COVER_SHIPPED: <Tablet className="w-3.5 h-3.5" />,
  IPAD_SHIPPED:       <Tablet className="w-3.5 h-3.5" />,
  IPAD_RESPONSE:      <Tablet className="w-3.5 h-3.5" />,
}
const TYPE_COLOR: Record<string, string> = {
  CALL:    'bg-emerald-100 text-emerald-700',
  EMAIL:   'bg-sky-100 text-sky-700',
  NOTE:    'bg-amber-100 text-amber-700',
  MEETING: 'bg-violet-100 text-violet-700',
  IPAD_COVER_SHIPPED: 'bg-purple-100 text-purple-700',
  IPAD_SHIPPED:       'bg-indigo-100 text-indigo-700',
  IPAD_RESPONSE:      'bg-pink-100 text-pink-700',
}
const TYPE_LABEL: Record<string, string> = {
  CALL: 'Call', EMAIL: 'Email', NOTE: 'Note', MEETING: 'Meeting',
  IPAD_COVER_SHIPPED: 'iPad Cover Shipped', IPAD_SHIPPED: 'iPad Shipped', IPAD_RESPONSE: 'iPad Response',
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
}

function ContactModal({ contactId, contactName, ownerName, onClose }: {
  contactId: string; contactName: string; ownerName: string; onClose: () => void
}) {
  const [engagements, setEngagements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<number | null>(null)

  const FILTERS = [{ label: '90d', days: 90 }, { label: '180d', days: 180 }, { label: '1yr', days: 365 }, { label: 'All', days: null }]

  useMemo(() => {
    setLoading(true)
    const qs = days ? `?contactId=${contactId}&days=${days}` : `?contactId=${contactId}`
    fetch(`/api/dashboard/contact${qs}`)
      .then(r => r.json())
      .then(d => setEngagements(d.engagements ?? []))
      .finally(() => setLoading(false))
  }, [contactId, days])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-black text-gray-900">{contactName}</h3>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{ownerName}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {FILTERS.map(f => (
                <button
                  key={f.label}
                  onClick={() => setDays(f.days)}
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors ${days === f.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {loading && <p className="text-center text-sm text-gray-400 animate-pulse py-8">Loading activity...</p>}
          {!loading && engagements.length === 0 && (
            <p className="text-center text-sm font-bold text-gray-400 uppercase py-8">No outreach on record</p>
          )}
          {engagements.map((e: any) => {
            const isIpad = e.type === 'IPAD_COVER_SHIPPED' || e.type === 'IPAD_SHIPPED' || e.type === 'IPAD_RESPONSE'
            const title = isIpad
              ? e.type === 'IPAD_COVER_SHIPPED' ? 'iPad Cover Shipped'
              : e.type === 'IPAD_SHIPPED' ? `iPad Shipped${e.ipadGroup ? ` · ${e.ipadGroup}` : ''}`
              : `iPad Response${e.ipadResponseType ? ` · ${e.ipadResponseType}` : ''}`
              : e.type === 'TASK'
              ? `Task${e.body ? ` — ${stripHtml(e.body)}` : ''}`
              : e.emailSubject || e.callDisposition || TYPE_LABEL[e.type] || e.type
            return (
              <div key={e.engagementId} className="flex gap-3">
                <div className={`mt-0.5 flex-shrink-0 p-1.5 rounded-lg ${TYPE_COLOR[e.type] ?? 'bg-gray-100 text-gray-500'}`}>
                  {TYPE_ICON[e.type] ?? <FileText className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-700">{title}</span>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {format(new Date(e.timestamp), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {e.body && e.type !== 'TASK' && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{stripHtml(e.body)}</p>
                  )}
                  {e.ownerName && <p className="text-[10px] text-gray-400 mt-0.5">{e.ownerName}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function ActivityTable({ data = [], loading }: ActivityTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [view, setView] = useState<'owner' | 'contact'>('owner')
  const [search, setSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<{ contactId: string; contactName: string; ownerName: string } | null>(null)

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

  const contactRows = useMemo(() => {
    const rows: {
      ownerName: string
      contactId: string
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
            contactId: fu.contactId,
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
        'Team Member,Emails,Calls,Notes,Meetings,Tasks,Seq. Touches,Contacts Reached,Total Activity',
        ...sortedData.map((r) =>
          [
            `"${r.ownerName}"`,
            r.emails, r.calls, r.notes, r.meetings, r.tasks, r.sequenceTouches, r.contactsReached,
            r.emails + r.calls + r.notes + r.meetings + r.sequenceTouches,
          ].join(',')
        ),
      ].join('\n')
    } else {
      csv = [
        'Team Member,Contact,Touch Count,Last Touch',
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
    <>
      {selectedContact && (
        <ContactModal
          contactId={selectedContact.contactId}
          contactName={selectedContact.contactName}
          ownerName={selectedContact.ownerName}
          onClose={() => setSelectedContact(null)}
        />
      )}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800">Raw Activity Data</h3>
            <div className="flex border border-gray-200 rounded overflow-hidden text-xs">
              <button
                onClick={() => setView('owner')}
                className={`px-3 py-1.5 ${view === 'owner' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                By Team Member
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
                      ['Team Member', 'ownerName'],
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
                    <td colSpan={9} className="py-6 text-center text-gray-400 text-sm">No results</td>
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
                  <th className="py-2 px-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Team Member</th>
                  <th className="py-2 px-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Contact</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wide">Touches</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wide">Last Touch</th>
                </tr>
              </thead>
              <tbody>
                {contactRows.slice(0, 200).map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedContact({ contactId: row.contactId, contactName: row.contactName, ownerName: row.ownerName })}
                  >
                    <td className="py-2.5 px-3 text-gray-700">{row.ownerName}</td>
                    <td className="py-2.5 px-3 font-medium text-blue-600 hover:underline">{row.contactName}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-blue-600">{row.touchCount}</td>
                    <td className="py-2.5 px-3 text-right text-gray-500">
                      {row.lastTouch
                        ? new Date(row.lastTouch).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                ))}
                {contactRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-400 text-sm">No results</td>
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
    </>
  )
}
