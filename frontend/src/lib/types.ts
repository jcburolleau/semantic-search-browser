export type Snippet = {
  id: string
  text: string
  label: string
}

export type Dataset = {
  version: string
  source: string
  snippets: Snippet[]
}

export type SearchMode = 'semantic' | 'keyword'
export type EngineMode = 'client' | 'server'

export type SearchHit = {
  id: string
  text: string
  label: string
  score: number
}

export type HealthResponse = {
  status: string
  model: string
  snippet_count: number
  dataset_version: string
  source: string
}
