import { getClient, getCachedData, setCachedData } from './client'

export interface DealStage {
  id: string
  label: string
  displayOrder: number
}

export interface DealPipeline {
  id: string
  label: string
  stages: DealStage[]
}

export async function getPipelineMap(): Promise<Map<string, string>> {
  // Check cache first
  const cached = getCachedData<Record<string, string>>('pipeline_map')
  if (cached) {
    return new Map(Object.entries(cached))
  }

  const client = getClient()
  const stageMap = new Map<string, string>()

  try {
    const response: any = await client.apiRequest({
      method: 'GET',
      path: '/crm/v3/pipelines/deals',
    })
    
    // apiRequest can return .json() depending on the client version/setup
    const data = typeof response.json === 'function' ? await response.json() : response

    for (const pipeline of data.results || []) {
      for (const stage of pipeline.stages || []) {
        stageMap.set(stage.id, stage.label)
      }
    }

    // Cache the mapping as a plain object for TTL support
    setCachedData('pipeline_map', Object.fromEntries(stageMap))
    return stageMap
  } catch (error: any) {
    console.error('Error fetching deal pipelines:', error.message)
    return new Map() // Return empty map rather than crashing
  }
}
