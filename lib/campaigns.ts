export type Campaign = {
  id: string
  label: string
  tag: string
  startDate: string
  endDate: string
  // How a "touch" is recorded for this campaign.
  // 'task' (default): completed HubSpot task whose body starts with `tag`.
  // 'email': outbound email matching `subjectMatch` (no task needed — avoids
  // double-counting since the email is already synced as activity).
  channel?: 'task' | 'email'
  subjectMatch?: string
}

export function getActiveCampaign(date: Date = new Date()): Campaign | undefined {
  const d = date.toISOString().slice(0, 10)
  return CAMPAIGNS.find(c => c.startDate <= d && c.endDate >= d)
}

export const CAMPAIGNS: Campaign[] = [
  {
    id: 'aosn-fedex-2026-04',
    label: '09-General AOSN Detailer Sent by FedEx (2 day)',
    tag: '09',
    startDate: '2026-04-27',
    endDate: '2026-05-15',
  },
  {
    id: 'mailer-followup-2026-05',
    label: '10 - Greeting Card',
    tag: '10',
    startDate: '2026-05-18',
    endDate: '2026-06-06',
  },
  {
    id: 'new-website-2026-06',
    label: '11 - New Website',
    tag: '11',
    startDate: '2026-06-14',
    endDate: '2026-07-04',
    channel: 'email',
    subjectMatch: 'Big News from AOSN: A New Digital Home for Specialty Care',
  },
  {
    id: 'mid-year-greeting-card-2026-07',
    label: '12 - Mid Year Greeting Card',
    tag: '12',
    startDate: '2026-07-06',
    endDate: '2026-07-25',
  },
]
