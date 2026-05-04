'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, AlertCircle } from 'lucide-react'
import ContactModal from '@/components/contacts/ContactModal'

type Meeting = {
  engagementId: string
  date: string
  timestamp: string
  title: string | null
  ownerId: string | null
  ownerName: string | null
  contactId: string | null
  contactName: string | null
  specialty: string | null
  state: string | null
}

const OWNER_COLORS: Record<string, { bg: string; text: string; dot: string }> = {}
const PALETTE = [
  { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
  { bg: 'bg-violet-100', text: 'text-violet-800', dot: 'bg-violet-500' },
  { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500' },
  { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
  { bg: 'bg-teal-100', text: 'text-teal-800', dot: 'bg-teal-500' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', dot: 'bg-fuchsia-500' },
]
let paletteIdx = 0
function ownerColor(ownerId: string | null) {
  if (!ownerId) return { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
  if (!OWNER_COLORS[ownerId]) {
    OWNER_COLORS[ownerId] = PALETTE[paletteIdx % PALETTE.length]
    paletteIdx++
  }
  return OWNER_COLORS[ownerId]
}

function toUTCDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function buildCalendarGrid(year: number, month: number) {
  const firstDay = new Date(Date.UTC(year, month, 1))
  const lastDay = new Date(Date.UTC(year, month + 1, 0))
  const startDow = firstDay.getUTCDay() // 0=Sun
  const daysInMonth = lastDay.getUTCDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [noTitles, setNoTitles] = useState(false)
  const [selectedContact, setSelectedContact] = useState<{ contactId: string; name: string; specialty: string | null; ownerName: string } | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

  useEffect(() => {
    setLoading(true)
    setSelectedDay(null)
    fetch(`/api/dashboard/calendar?month=${monthStr}`)
      .then(r => r.json())
      .then(d => {
        setMeetings(d.meetings ?? [])
        setNoTitles((d.meetings ?? []).length === 0)
      })
      .finally(() => setLoading(false))
  }, [monthStr])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()) }

  const grid = useMemo(() => buildCalendarGrid(year, month), [year, month])

  const byDay = useMemo(() => {
    const map = new Map<number, Meeting[]>()
    for (const m of meetings) {
      const d = toUTCDate(m.date).getUTCDate()
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(m)
    }
    return map
  }, [meetings])

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  const selectedMeetings = selectedDay ? (byDay.get(selectedDay) ?? []) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">New Meeting Calendar</h2>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            Meetings with "New" in the title · {meetings.length} this month
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              Today
            </button>
          )}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="px-3 text-sm font-black text-gray-900 min-w-[130px] text-center">
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {noTitles && !loading && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-amber-800 font-medium">
            No meetings with "New" in the title found for this month. Meeting titles are captured during sync — trigger a meetings re-sync from the Admin panel to populate titles for existing records.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="py-24 text-center text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">
            Loading…
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {grid.map((day, i) => {
              const dayMeetings = day ? (byDay.get(day) ?? []) : []
              const dateStr = day
                ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                : ''
              const isToday = dateStr === todayStr
              const isSelected = day === selectedDay
              const isWeekend = i % 7 === 0 || i % 7 === 6

              return (
                <div
                  key={i}
                  onClick={() => day && setSelectedDay(isSelected ? null : day)}
                  className={`min-h-[100px] border-b border-r border-gray-100 p-2 transition-colors ${
                    !day ? 'bg-gray-50/50' : isSelected ? 'bg-blue-50 cursor-pointer' : isWeekend ? 'bg-gray-50/30 cursor-pointer hover:bg-gray-50' : 'cursor-pointer hover:bg-gray-50'
                  }`}
                >
                  {day && (
                    <>
                      <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-black mb-1 ${
                        isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                      }`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayMeetings.slice(0, 3).map(m => {
                          const color = ownerColor(m.ownerId)
                          return (
                            <div
                              key={m.engagementId}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold truncate ${color.bg} ${color.text}`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.dot}`} />
                              <span className="truncate">{m.contactName ?? m.title ?? 'Meeting'}</span>
                            </div>
                          )
                        })}
                        {dayMeetings.length > 3 && (
                          <div className="text-[10px] font-black text-gray-400 pl-1">
                            +{dayMeetings.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Day detail panel */}
      {selectedDay !== null && selectedMeetings.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <CalendarDays className="w-4 h-4 text-blue-500" />
            <h3 className="font-black text-gray-900 uppercase tracking-tight">
              {MONTHS[month]} {selectedDay}, {year}
            </h3>
            <span className="text-[10px] font-black text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              {selectedMeetings.length} meeting{selectedMeetings.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {selectedMeetings.map(m => {
              const color = ownerColor(m.ownerId)
              const time = new Date(m.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              return (
                <div key={m.engagementId} className="px-5 py-4 flex items-start gap-4">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${color.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {m.title && (
                        <span className="text-sm font-black text-gray-900">{m.title}</span>
                      )}
                      <span className="text-[10px] font-black text-gray-400">{time}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {m.contactName && (
                        <button
                          onClick={() => m.contactId && setSelectedContact({
                            contactId: m.contactId,
                            name: m.contactName!,
                            specialty: m.specialty,
                            ownerName: m.ownerName ?? '',
                          })}
                          disabled={!m.contactId}
                          className={`text-[11px] font-bold ${m.contactId ? 'text-blue-600 hover:underline cursor-pointer' : 'text-gray-500'}`}
                        >
                          {m.contactName}
                        </button>
                      )}
                      {m.specialty && (
                        <span className="text-[10px] text-gray-400 uppercase">{m.specialty}</span>
                      )}
                      {m.state && (
                        <span className="text-[10px] text-gray-400">{m.state}</span>
                      )}
                    </div>
                    {m.ownerName && (
                      <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${color.bg} ${color.text}`}>
                        {m.ownerName}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selectedContact && (
        <ContactModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </div>
  )
}
