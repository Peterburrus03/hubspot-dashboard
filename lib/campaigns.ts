export type Campaign = {
  id: string
  label: string
  tag: string
  startDate: string
  endDate: string
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
    label: '10-Mailer Follow Up',
    tag: '10',
    startDate: '2026-05-18',
    endDate: '2026-06-06',
  },
]
