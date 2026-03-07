import { getClient } from './client'
import type { HubSpotProperty } from '@/types/hubspot'

export async function getDealProperties(): Promise<HubSpotProperty[]> {
  const client = getClient()

  try {
    const response = await client.crm.properties.coreApi.getAll('deals')
    return response.results as HubSpotProperty[]
  } catch (error) {
    console.error('Error fetching deal properties:', error)
    throw error
  }
}

export async function getContactProperties(): Promise<HubSpotProperty[]> {
  const client = getClient()

  try {
    const response = await client.crm.properties.coreApi.getAll('contacts')
    return response.results as HubSpotProperty[]
  } catch (error) {
    console.error('Error fetching contact properties:', error)
    throw error
  }
}

export async function getCompanyProperties(): Promise<HubSpotProperty[]> {
  const client = getClient()

  try {
    const response = await client.crm.properties.coreApi.getAll('companies')
    return response.results as HubSpotProperty[]
  } catch (error) {
    console.error('Error fetching company properties:', error)
    throw error
  }
}
