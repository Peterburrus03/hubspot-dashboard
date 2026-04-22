'use client'

import { useState, useEffect } from 'react'
import { X, Phone, Mail, FileText, CalendarDays, Tablet, Users } from 'lucide-react'
import { format } from 'date-fns'

function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  CALL:          <Phone className="w-3.5 h-3.5" />,
  EMAIL:         <Mail className="w-3.5 h-3.5" />,
  NOTE:          <FileText className="w-3.5 h-3.5" />,
  MEETING:       <CalendarDays className="w-3.5 h-3.5" />,
  IPAD_COVER_SHIPPED: <Tablet className="w-3.5 h-3.5" />,
  IPAD_SHIPPED:       <Tablet className="w-3.5 h-3.5" />,
  IPAD_RESPONSE:      <Tablet className="w-3.5 h-3.5" />,
}
const TYPE_COLOR: Record<string, string> = {
  CALL:          'bg-emerald-100 text-emerald-700',
  EMAIL:         'bg-sky-100 text-sky-700',
  NOTE:          'bg-amber-100 text-amber-700',
  MEETING:       'bg-violet-100 text-violet-700',
  IPAD_COVER_SHIPPED: 'bg-purple-100 text-purple-700',
  IPAD_SHIPPED:       'bg-indigo-100 text-indigo-700',
  IPAD_RESPONSE:      'bg-pink-100 text-pink-700',
}
const TYPE_LABEL: Record<string, string> = {
  CALL:          'Call',
  EMAIL:         'Email',
  NOTE:          'Note',
  MEETING:       'Meeting',
  IPAD_COVER_SHIPPED: 'iPad Cover Shipped',
  IPAD_SHIPPED:       'iPad Shipped',
  IPAD_RESPONSE:      'iPad Response',
}

const TIMELINE_FILTERS = [
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
  { label: '1yr', days: 365 },
  { label: 'All', days: null },
]

type Tab = 'history' | 'peer'

export default function ContactModal({ contact, onClose }: {
  contact: { contactId: string; name: string; specialty: string | null; ownerName: string }
  onClose: () => void
}) {
  const [engagements, setEngagements] = useState<any[]>([])
  const [closestReferral, setClosestReferral] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('history')

  useEffect(() => {
    setLoading(true)
    const qs = days ? `?contactId=${contact.contactId}&days=${days}` : `?contactId=${contact.contactId}`
    fetch(`/api/dashboard/contact${qs}`)
      .then(r => r.json())
      .then(d => {
        setEngagements(d.engagements ?? [])
        setClosestReferral(d.closestReferral ?? null)
      })
      .finally(() => setLoading(false))
  }, [contact.contactId, days])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-black text-gray-900">{contact.name}</h3>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
              {contact.specialty ?? '—'} · {contact.ownerName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'history' && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {TIMELINE_FILTERS.map(f => (
                  <button
                    key={f.label}
                    onClick={() => setDays(f.days)}
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors ${days === f.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          <button
            onClick={() => setTab('history')}
            className={`px-3 py-2.5 text-[11px] font-black uppercase tracking-widest border-b-2 transition-colors ${tab === 'history' ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Outreach History
          </button>
          <button
            onClick={() => setTab('peer')}
            className={`px-3 py-2.5 text-[11px] font-black uppercase tracking-widest border-b-2 transition-colors ${tab === 'peer' ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Peer-to-Peer
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {loading && <p className="text-center text-sm text-gray-400 animate-pulse py-8">Loading...</p>}

          {!loading && tab === 'history' && (
            <>
              {engagements.length === 0 && (
                <p className="text-center text-sm font-bold text-gray-400 uppercase py-8">No outreach on record</p>
              )}

              {engagements.map(e => {
                const isIpad = e.type === 'IPAD_COVER_SHIPPED' || e.type === 'IPAD_SHIPPED' || e.type === 'IPAD_RESPONSE'
                const title = isIpad
                  ? e.type === 'IPAD_COVER_SHIPPED' ? 'iPad Cover Shipped'
                  : e.type === 'IPAD_SHIPPED' ? `iPad Shipped${e.ipadGroup ? ` · ${e.ipadGroup}` : ''}`
                  : `iPad Response${e.ipadResponseType ? ` · ${e.ipadResponseType}` : ''}`
                  : e.type === 'TASK'
                  ? (e.taskCategory ?? 'Sales Activity')
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
            </>
          )}

          {!loading && tab === 'peer' && (
            <div className="py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-fuchsia-100 rounded-lg">
                  <Users className="w-5 h-5 text-fuchsia-600" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Closest AOSN Referral</div>
                  <div className="text-[10px] text-gray-400">Sourced from HubSpot · <span className="font-mono text-fuchsia-600">aosn_doctor_closest_referral</span></div>
                </div>
              </div>

              {closestReferral ? (
                <div className="bg-fuchsia-50 border border-fuchsia-100 rounded-xl p-4">
                  <div className="text-lg font-black text-gray-900">{closestReferral}</div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                  <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">No referral on file</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
