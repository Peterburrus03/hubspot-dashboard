// Shared "addressable universe" bucketing logic.
//
// This is the single source of truth for how a contact is sorted into a universe
// bucket. Both the Game Plan API (app/api/dashboard/gameplan) and the Map API
// (app/api/dashboard/map) classify contacts through classifyContact() so the two
// views always agree on which bucket a contact lands in.

export const ACTIVE_PIPELINE_STAGES = [
  'Engaged',
  'Presented to Growth Committee',
  'Data Collection (including NDA)',
  'LOI Extended',
  'LOI Signed/Diligence',
  'Pre-LOI Analysis',
]

export const TERMINAL_DEAL_STAGES = ['Closed Won', 'Closed Lost', 'Closed LOST', 'Closed PASS']

export const OPEN_LEAD_STATUSES = ['OPEN', 'NEW', 'CONNECTED']
export const CLOSED_NURTURE_STATUSES = ['Closed and Nurturing']

export const BIZ_MISMATCH_BUCKETS = ['Model / Financial Mismatch', 'Geography / Strategic Hold', 'Complex Ownership']

export type UniverseKey =
  | 'inPipeline'
  | 'fairGame'
  | 'notNow'
  | 'notInterested'
  | 'businessModelMismatch'
  | 'other'

export const UNIVERSE_KEYS: UniverseKey[] = [
  'inPipeline', 'fairGame', 'notNow', 'notInterested', 'businessModelMismatch', 'other',
]

export const UNIVERSE_LABELS: Record<string, string> = {
  inPipeline:            'In Pipeline',
  fairGame:              'Fair Game',
  notNow:                'Not Now',
  notInterested:         'Not Interested',
  businessModelMismatch: 'Biz Model Mismatch',
  other:                 'Other',
}

// Colors mirror the Game Plan universe cards (violet / sky / amber / rose / slate / gray).
// Exception: the map paints "In Pipeline" green instead of violet, because the map's
// ADG / AOSN layer already owns violet and pins of the same hue would be indistinguishable.
export const UNIVERSE_COLORS: Record<string, string> = {
  inPipeline:            '#16a34a',
  fairGame:              '#0284c7',
  notNow:                '#d97706',
  notInterested:         '#e11d48',
  businessModelMismatch: '#475569',
  other:                 '#9ca3af',
}

// "Model / Financial Mismatch — <detail>" -> "Model / Financial Mismatch"
export function parseBucketName(reason: string | null | undefined): string | null {
  if (!reason) return null
  const idx = reason.indexOf(' — ')
  return (idx === -1 ? reason : reason.slice(0, idx)).trim()
}

export function normalizeBucket(bucket: string | null): UniverseKey {
  if (!bucket) return 'other'
  if (bucket === 'Unresponsive') return 'fairGame'
  if (bucket === 'Too Early / Timing') return 'notNow'
  if (bucket === 'Not Interested') return 'notInterested'
  if (BIZ_MISMATCH_BUCKETS.includes(bucket) || bucket === 'Business Model Mismatch') return 'businessModelMismatch'
  return 'other'
}

export type ClassifyInput = {
  leadStatus: string | null | undefined
  isInPipeline: boolean
  hasTerminalDeal: boolean
  // For OPEN_DEAL contacts, the bucket is parsed from the deal's closedNurtureReason.
  closedNurtureReason?: string | null
  // For "Closed and Nurturing" contacts, the bucket is parsed from the contact's notes.
  notes?: string | null
}

// Returns the universe bucket for a contact, or null if the contact is not part of
// the addressable universe (terminally closed deal, or a lead status that maps to no
// column — e.g. UNSUBSCRIBED / null). Mirrors the Game Plan's column logic exactly:
//   - active pipeline deal               -> inPipeline
//   - terminally closed deal             -> excluded (null)
//   - leadStatus OPEN_DEAL               -> bucket parsed from deal.closedNurtureReason
//   - leadStatus OPEN / NEW / CONNECTED  -> fairGame
//   - leadStatus "Closed and Nurturing"  -> bucket parsed from contact.notes
//   - anything else                      -> excluded (null)
export function classifyContact(input: ClassifyInput): UniverseKey | null {
  if (input.isInPipeline) return 'inPipeline'
  if (input.hasTerminalDeal) return null

  const status = input.leadStatus ?? null
  if (status === 'OPEN_DEAL') return normalizeBucket(parseBucketName(input.closedNurtureReason))
  if (status && OPEN_LEAD_STATUSES.includes(status)) return 'fairGame'
  if (status && CLOSED_NURTURE_STATUSES.includes(status)) return normalizeBucket(parseBucketName(input.notes))
  return null
}
