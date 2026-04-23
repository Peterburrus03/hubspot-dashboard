'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, Users } from 'lucide-react'
import ContactModal from '@/components/contacts/ContactModal'

type MatchedContact = {
  contactId: string | null
  contactName: string
  specialty: string | null
  state: string | null
  ownerName: string | null
  rank: number
  score: number | null
  explanation: string
}

type DvmRow = {
  dvmName: string
  totalContacts: number
  avgScore: number | null
  rankCounts: { rank1: number; rank2: number; rank3: number; rank4: number; rank5: number }
  contacts: MatchedContact[]
}

export default function PeerToPeerPage() {
  const [dvms, setDvms] = useState<DvmRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [rankFilter, setRankFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedContact, setSelectedContact] = useState<MatchedContact | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/peer-to-peer')
      .then(r => r.json())
      .then(d => setDvms(d.dvms ?? []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return dvms
      .map(row => {
        const contacts = row.contacts.filter(c => {
          if (minScore > 0 && (c.score ?? 0) < minScore) return false
          if (rankFilter !== 'all' && c.rank !== rankFilter) return false
          return true
        })
        const scores = contacts.map(c => c.score).filter((s): s is number => typeof s === 'number')
        return {
          ...row,
          contacts,
          totalContacts: contacts.length,
          avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
        }
      })
      .filter(row => row.totalContacts > 0)
      .filter(row => !q || row.dvmName.toLowerCase().includes(q))
      .sort((a, b) => b.totalContacts - a.totalContacts || a.dvmName.localeCompare(b.dvmName))
  }, [dvms, search, minScore, rankFilter])

  const toggle = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Peer-to-Peer Referrals</h2>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            AOSN DVMs ranked by contact-match volume
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-fuchsia-600">{filtered.length}</div>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">DVMs Matched</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by DVM name..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-gray-200 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <span className="px-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">Rank</span>
          {(['all', 1, 2, 3, 4, 5] as const).map(r => (
            <button
              key={String(r)}
              onClick={() => setRankFilter(r)}
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors ${
                rankFilter === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {r === 'all' ? 'All' : `#${r}`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <span className="px-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">Min Score</span>
          {[0, 3, 5, 7, 10].map(s => (
            <button
              key={s}
              onClick={() => setMinScore(s)}
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors ${
                minScore === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {s === 0 ? 'Any' : `≥${s}`}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-center text-sm text-gray-400 animate-pulse py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm font-bold text-gray-400 uppercase py-12">No DVMs match the current filters</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {filtered.map(row => {
            const isOpen = expanded.has(row.dvmName)
            return (
              <div key={row.dvmName} className="border-b border-gray-100 last:border-b-0">
                <button
                  onClick={() => toggle(row.dvmName)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-gray-900 truncate">{row.dvmName}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      <span className="font-bold">#1:</span> {row.rankCounts.rank1} · <span className="font-bold">#2:</span> {row.rankCounts.rank2} · <span className="font-bold">#3:</span> {row.rankCounts.rank3} · <span className="font-bold">#4:</span> {row.rankCounts.rank4} · <span className="font-bold">#5:</span> {row.rankCounts.rank5}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {row.avgScore != null && (
                      <div className="text-center">
                        <div className="text-sm font-black text-gray-700">{row.avgScore}</div>
                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Avg</div>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-fuchsia-50 text-fuchsia-700 rounded-lg">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-sm font-black">{row.totalContacts}</span>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="bg-gray-50/50 border-t border-gray-100">
                    {row.contacts.map((c, i) => (
                      <button
                        key={`${c.contactId ?? c.contactName}-${i}`}
                        onClick={() => c.contactId && setSelectedContact(c)}
                        disabled={!c.contactId}
                        className={`w-full flex gap-3 px-4 py-2.5 text-left border-b border-gray-100 last:border-b-0 ${c.contactId ? 'hover:bg-white cursor-pointer' : 'cursor-default opacity-60'}`}
                      >
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-fuchsia-100 text-fuchsia-700 text-xs font-black flex items-center justify-center">
                          {c.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-gray-900 truncate">{c.contactName}</span>
                            {c.score != null && (
                              <span className="flex-shrink-0 px-2 py-0.5 rounded-md bg-fuchsia-50 text-fuchsia-700 text-[10px] font-black uppercase tracking-wider">
                                {c.score}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {[c.specialty, c.state, c.ownerName].filter(Boolean).join(' · ') || '—'}
                          </div>
                          {c.explanation && (
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{c.explanation}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedContact?.contactId && (
        <ContactModal
          contact={{
            contactId: selectedContact.contactId,
            name: selectedContact.contactName,
            specialty: selectedContact.specialty,
            ownerName: selectedContact.ownerName ?? '',
          }}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </div>
  )
}
