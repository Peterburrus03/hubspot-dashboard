// HubSpot API response types

export interface HubSpotDeal {
  id: string
  properties: {
    hs_object_id: string
    dealname?: string
    hubspot_owner_id?: string
    dealstage?: string
    hs_forecast_probability?: string
    amount?: string
    hs_projected_amount?: string
    adjusted_ebitda?: string
    initial_outreach_date?: string
    nda_signed_date?: string
    loi_extended_date?: string
    loi_signed_date?: string
    target_close_date?: string
    revised_expected_close_date?: string
    closedate?: string
    city?: string
    state?: string
    specialty?: string
    num_dvms?: string
    next_step?: string
    deal_notes?: string
    closed_lost_reason?: string
    tags?: string
    hs_is_closed?: string
    [key: string]: any
  }
  createdAt: string
  updatedAt: string
}

export interface HubSpotContact {
  id: string
  properties: {
    hs_object_id: string
    firstname?: string
    lastname?: string
    email?: string
    hubspot_owner_id?: string
    specialty?: string
    contact_status?: string
    hs_lead_status?: string
    ipad_shipment_date?: string
    ipad_group?: string
    ipad_response?: string
    ipad_response_type?: string
    associatedcompanyid?: string
    high_priority_target_lead?: string
    [key: string]: any
  }
  createdAt: string
  updatedAt: string
}

export interface HubSpotCompany {
  id: string
  properties: {
    hs_object_id: string
    name?: string
    city?: string
    state?: string
    practice_type?: string
    num_dvms?: string
    annual_revenue?: string
    ebitda?: string
    [key: string]: any
  }
  createdAt: string
  updatedAt: string
}

export interface HubSpotOwner {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  userId?: number
  createdAt?: string
  updatedAt?: string
}

export interface HubSpotProperty {
  name: string
  label: string
  type: string
  fieldType: string
  description?: string
  groupName?: string
  options?: Array<{
    label: string
    value: string
    description?: string
    displayOrder?: number
    hidden?: boolean
  }>
}

export interface HubSpotPaginatedResponse<T> {
  results: T[]
  paging?: {
    next?: {
      after: string
      link?: string
    }
  }
}

// Mapped internal types (after transformation from HubSpot)
export interface Deal {
  dealId: string
  dealName?: string
  ownerId?: string
  stage?: string
  probability?: number
  revenue?: number
  weightedAmount?: number
  ebitda?: number
  dealCreatedAt?: Date
  initialOutreachDate?: Date
  qualifiedToBuyDate?: Date
  engagedDate?: Date
  steveMeetingDate?: Date
  ndaSignedDate?: Date
  dataReceivedDate?: Date
  committeePresentedDate?: Date
  loiExtendedDate?: Date
  loiSignedDate?: Date
  targetCloseDate?: Date
  revisedCloseDate?: Date
  closedDate?: Date
  integrationCompletionDate?: Date
  officialClosedDate?: Date
  city?: string
  state?: string
  specialty?: string
  numDvms?: number
  nextStep?: string
  notes?: string
  closedLostReason?: string
  closedNurtureReason?: string
  tags?: string
  stageEnteredDate?: Date
  isOpen: boolean
  pipelineId?: string
  companyId?: string
  contactId?: string
}

export interface Contact {
  contactId: string
  firstName?: string
  lastName?: string
  email?: string
  ownerId?: string
  specialty?: string
  status?: string
  leadStatus?: string
  city?: string
  state?: string
  ipadShipmentDate?: Date
  ipadGroup?: string
  ipadResponse?: boolean
  ipadResponseType?: string
  companyId?: string
  tier1?: boolean
  professionalStatus?: string
  interestedResponseDate?: Date
  notInterestedNowResponseDate?: Date
  notInterestedAtAllResponseDate?: Date
  ipadCoverShipDate?: Date
  dealStatus?: string
  practiceType?: string
  approximateAge?: number
  yearOpened?: number
  dvms?: string
  notes?: string
  closestReferral?: string
}

export interface EngagementRecord {
  engagementId: string
  type: 'EMAIL' | 'CALL' | 'NOTE' | 'MEETING' | 'TASK'
  ownerId?: string
  contactId?: string
  timestamp: Date
  body?: string
  emailDirection?: string
  emailSubject?: string
  emailStatus?: string
  emailOpens?: number
  emailClicks?: number
  emailReplied?: boolean
  callDirection?: string
  callDuration?: number
  callDisposition?: string
  callStatus?: string
  taskStatus?: string
  sequenceId?: string
}

export interface SequenceEnrollmentRecord {
  enrollmentId: string
  sequenceId?: string
  sequenceName?: string
  contactId?: string
  ownerId?: string
  status?: string
  enrolledAt?: Date
  finishedAt?: Date
}

// Dashboard response types
export interface ActivitySummary {
  totalEmails: number
  totalCalls: number
  totalMeetings: number
  totalSequenceTouches: number
  totalTasks: number
}

export interface OwnerActivity {
  ownerId: string
  ownerName: string
  emails: number
  calls: number
  notes: number
  meetings: number
  tasks: number
  sequenceTouches: number
  contactsReached: number
}

export interface SequencePerformance {
  sequenceId: string
  sequenceName: string
  totalEnrolled: number
  active: number
  finished: number
  unenrolled: number
  byOwner: { ownerName: string; count: number }[]
}

export interface LeadStatusCount {
  status: string
  total: number
  byOwner: { ownerId: string; ownerName: string; count: number }[]
}

export interface ContactTimeline {
  contactId: string
  contactName: string
  ownerId: string
  ownerName: string
  touchCount: number
  lastTouch?: Date
  engagements: {
    type: string
    timestamp: Date
    subject?: string
    direction?: string
  }[]
}

export interface DashboardFilters {
  owners: { id: string; name: string }[]
  specialties: string[]
  companyTypes: string[]
  leadStatuses: string[]
  states: string[]
}

export interface Company {
  companyId: string
  companyName?: string
  city?: string
  state?: string
  companyType?: string
  numDvms?: number
  revenue?: number
  ebitda?: number
}

export interface Owner {
  ownerId: string
  firstName?: string
  lastName?: string
  email?: string
}
