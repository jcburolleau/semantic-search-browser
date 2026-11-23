const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'

export function cacheKey(datasetVersion: string): string {
  return `ssb:emb:${MODEL_ID}:v${datasetVersion}`
}

export function loadEmbeddings(datasetVersion: string, count: number): number[][] | null {
  try {
    const raw = localStorage.getItem(cacheKey(datasetVersion))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { vectors?: number[][] }
    if (!Array.isArray(parsed.vectors) || parsed.vectors.length !== count) return null
    return parsed.vectors
  } catch {
    return null
  }
}

export function saveEmbeddings(datasetVersion: string, vectors: number[][]): void {
  try {
    localStorage.setItem(cacheKey(datasetVersion), JSON.stringify({ vectors }))
  } catch {
    // Quota or private mode — in-memory still works.
  }
}
