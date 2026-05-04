'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, Users, UserCheck, UserPlus } from 'lucide-react'
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

type DvmMatch = {
  rank: number
  dvmName: string
  score: number | null
  explanation: string
}

type ContactRow = {
  contactId: string | null
  contactName: string
  specialty: string | null
  state: string | null
  ownerName: string | null
  closestReferral: string | null
  totalMatches: number
  avgScore: number | null
  topScore: number | null
  dvmMatches: DvmMatch[]
}

type View = 'internal' | 'external'

export default function PeerToPeerPage() {
  const [dvms, setDvms] = useState<DvmRow[]>([])
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('internal')
  const [search, setSearch] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [rankFilter, setRankFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedContact, setSelectedContact] = useState<{ contactId: string; name: string; specialty: string | null; ownerName: string } | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/peer-to-peer')
      .then(r => r.json())
      .then(d => {
        setDvms(d.dvms ?? [])
        setContacts(d.contacts ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  // Reset expanded rows and search when toggling views
  useEffect(() => {
    setExpanded(new Set())
    setSearch('')
  }, [view])

  const filteredDvms = useMemo(() => {
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

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts
      .map(row => {
        const matches = row.dvmMatches.filter(m => {
          if (minScore > 0 && (m.score ?? 0) < minScore) return false
          if (rankFilter !== 'all' && m.rank !== rankFilter) return false
          return true
        })
        const scores = matches.map(m => m.score).filter((s): s is number => typeof s === 'number')
        return {
          ...row,
          dvmMatches: matches,
          totalMatches: matches.length,
          avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
          topScore: scores.length ? Math.max(...scores) : null,
        }
      })
      .filter(row => row.totalMatches > 0)
      .filter(row => {
        if (!q) return true
        return (
          row.contactName.toLowerCase().includes(q) ||
          (row.specialty ?? '').toLowerCase().includes(q) ||
          (row.state ?? '').toLowerCase().includes(q) ||
          (row.ownerName ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (b.topScore ?? 0) - (a.topScore ?? 0) || a.contactName.localeCompare(b.contactName))
  }, [contacts, search, minScore, rankFilter])

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Peer-to-Peer Referrals</h2>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            {view === 'internal'
              ? 'AOSN DVMs ranked by contact-match volume'
              : 'External targets in our universe with their top AOSN DVM matches'}
          </p>
        </div>
      </div>

      {/* View toggle */}
      <div className="inline-flex items-center gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setView('internal')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
            view === 'internal' ? 'bg-white text-fuchsia-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Internal Referrals
        </button>
        <button
          onClick={() => setView('external')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
            view === 'external' ? 'bg-white text-fuchsia-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          External Targets
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={view === 'internal' ? 'Search by DVM name...' : 'Search by contact name, specialty, state, or owner...'}
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

      {/* Results */}
      {loading ? (
        <p className="text-center text-sm text-gray-400 animate-pulse py-8">Loading...</p>
      ) : view === 'internal' ? (
        filteredDvms.length === 0 ? (
          <p className="text-center text-sm font-bold text-gray-400 uppercase py-12">No DVMs match the current filters</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {filteredDvms.map(row => {
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
                    </div>
                  </button>

                  {isOpen && (
                    <div className="bg-gray-50/50 border-t border-gray-100">
                      {row.contacts.map((c, i) => (
                        <button
                          key={`${c.contactId ?? c.contactName}-${i}`}
                          onClick={() => c.contactId && setSelectedContact({ contactId: c.contactId, name: c.contactName, specialty: c.specialty, ownerName: c.ownerName ?? '' })}
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
        )
      ) : (
        // External Targets view (contact-first)
        filteredContacts.length === 0 ? (
          <p className="text-center text-sm font-bold text-gray-400 uppercase py-12">No external targets match the current filters</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {filteredContacts.map(row => {
              const key = row.contactId ?? row.contactName
              const isOpen = expanded.has(key)
              return (
                <div key={key} className="border-b border-gray-100 last:border-b-0">
                  <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <button
                      onClick={() => toggle(key)}
                      className="flex-shrink-0 p-0.5 rounded hover:bg-gray-100"
                      aria-label={isOpen ? 'Collapse' : 'Expand'}
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </button>

                    <button
                      onClick={() => row.contactId && setSelectedContact({ contactId: row.contactId, name: row.contactName, specialty: row.specialty, ownerName: row.ownerName ?? '' })}
                      disabled={!row.contactId}
                      className={`flex-1 min-w-0 text-left ${row.contactId ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="text-sm font-black text-gray-900 truncate hover:text-fuchsia-700 transition-colors">
                        {row.contactName}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {[row.specialty, row.state, row.ownerName].filter(Boolean).join(' · ') || '—'}
                        {row.closestReferral && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span className="font-bold text-fuchsia-600">Closest: {row.closestReferral}</span>
                          </>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-4">
                      {row.topScore != null && (
                        <div className="text-center">
                          <div className="text-sm font-black text-gray-700">{row.topScore}</div>
                          <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Top</div>
                        </div>
                      )}
                      {row.avgScore != null && (
                        <div className="text-center">
                          <div className="text-sm font-black text-gray-700">{row.avgScore}</div>
                          <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Avg</div>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-fuchsia-50 text-fuchsia-700 rounded-lg">
                        <Users className="w-3.5 h-3.5" />
                        <span className="text-sm font-black">{row.totalMatches}</span>
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="bg-gray-50/50 border-t border-gray-100">
                      {row.closestReferral && (
                        <div className="px-4 py-2.5 border-b border-gray-100 bg-fuchsia-50/40">
                          <div className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest">Closest AOSN Referral</div>
                          <div className="text-sm font-bold text-gray-900 mt-0.5">{row.closestReferral}</div>
                        </div>
                      )}
                      {row.dvmMatches.map((m, i) => (
                        <div
                          key={`${key}-${m.dvmName}-${i}`}
                          className="flex gap-3 px-4 py-2.5 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-fuchsia-100 text-fuchsia-700 text-xs font-black flex items-center justify-center">
                            {m.rank}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-gray-900 truncate">{m.dvmName}</span>
                              {m.score != null && (
                                <span className="flex-shrink-0 px-2 py-0.5 rounded-md bg-fuchsia-50 text-fuchsia-700 text-[10px] font-black uppercase tracking-wider">
                                  Score {m.score}
                                </span>
                              )}
                            </div>
                            {m.explanation && (
                              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{m.explanation}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
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
