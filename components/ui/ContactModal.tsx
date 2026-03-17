'use client'

import { useState, useEffect } from 'react'
import { X, Phone, Mail, FileText, CalendarDays, Tablet } from 'lucide-react'
import { format } from 'date-fns'

function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  CALL:               <Phone className="w-3.5 h-3.5" />,
  EMAIL:              <Mail className="w-3.5 h-3.5" />,
  NOTE:               <FileText className="w-3.5 h-3.5" />,
  MEETING:            <CalendarDays className="w-3.5 h-3.5" />,
  IPAD_COVER_SHIPPED: <Tablet className="w-3.5 h-3.5" />,
  IPAD_SHIPPED:       <Tablet className="w-3.5 h-3.5" />,
  IPAD_RESPONSE:      <Tablet className="w-3.5 h-3.5" />,
}
const TYPE_COLOR: Record<string, string> = {
  CALL:               'bg-emerald-100 text-emerald-700',
  EMAIL:              'bg-sky-100 text-sky-700',
  NOTE:               'bg-amber-100 text-amber-700',
  MEETING:            'bg-violet-100 text-violet-700',
  IPAD_COVER_SHIPPED: 'bg-purple-100 text-purple-700',
  IPAD_SHIPPED:       'bg-indigo-100 text-indigo-700',
  IPAD_RESPONSE:      'bg-pink-100 text-pink-700',
}
const TYPE_LABEL: Record<string, string> = {
  CALL:               'Call',
  EMAIL:              'Email',
  NOTE:               'Note',
  MEETING:            'Meeting',
  IPAD_COVER_SHIPPED: 'iPad Cover Shipped',
  IPAD_SHIPPED:       'iPad Shipped',
  IPAD_RESPONSE:      'iPad Response',
}

const TIMELINE_FILTERS = [
  { label: '90d',  days: 90 },
  { label: '180d', days: 180 },
  { label: '1yr',  days: 365 },
  { label: 'All',  days: null },
]

const DISPOSITION_COLORS: Record<string, string> = {
  interested:      '#16a34a',
  fairGame:        '#0284c7',
  notNow:          '#d97706',
  notInterested:   '#dc2626',
}
const DISPOSITION_LABELS: Record<string, string> = {
  interested:      'Interested',
  fairGame:        'Fair Game',
  notNow:          'Not Now',
  notInterested:   'Not Interested',
}

export type ModalContact = {
  contactId: string
  name: string
  specialty: string | null
  ownerName: string
  disposition?: string
  clinic?: string | null
  city?: string | null
  state?: string | null
}

export default function ContactModal({
  contact,
  onClose,
}: {
  contact: ModalContact
  onClose: () => void
}) {
  const [engagements, setEngagements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    const qs = days ? `?contactId=${contact.contactId}&days=${days}` : `?contactId=${contact.contactId}`
    fetch(`/api/dashboard/contact${qs}`)
      .then(r => r.json())
      .then(d => setEngagements(d.engagements ?? []))
      .finally(() => setLoading(false))
  }, [contact.contactId, days])

  const disposition = contact.disposition
  const dispColor = disposition ? DISPOSITION_COLORS[disposition] : '#6b7280'
  const dispLabel = disposition ? DISPOSITION_LABELS[disposition] : null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-black text-gray-900">{contact.name}</h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                {contact.specialty ?? '—'} · {contact.ownerName}
              </p>
              {dispLabel && (
                <span
                  className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: dispColor + '20', color: dispColor }}
                >
                  {dispLabel}
                </span>
              )}
            </div>
            {(contact.clinic || contact.city) && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                {contact.clinic ?? ''}{contact.clinic && contact.city ? ' · ' : ''}{contact.city ?? ''}{contact.state ? `, ${contact.state}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {TIMELINE_FILTERS.map(f => (
                <button
                  key={f.label}
                  onClick={() => setDays(f.days)}
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors ${
                    days === f.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {loading && (
            <p className="text-center text-sm text-gray-400 animate-pulse py-8">Loading activity...</p>
          )}
          {!loading && engagements.length === 0 && (
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
                  {e.ownerName && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{e.ownerName}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
