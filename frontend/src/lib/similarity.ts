import type { SearchHit, Snippet } from './types'

export function dot(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0)
  }
  return sum
}

export function topKSemantic(
  query: number[],
  snippets: Snippet[],
  embeddings: number[][],
  k: number,
): SearchHit[] {
  const scored: SearchHit[] = []
  for (let i = 0; i < snippets.length; i++) {
    const snippet = snippets[i]
    const vector = embeddings[i]
    if (!snippet || !vector) continue
    scored.push({
      id: snippet.id,
      text: snippet.text,
      label: snippet.label,
      score: dot(query, vector),
    })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}

export function keywordSearch(query: string, snippets: Snippet[], k: number): SearchHit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []
  const scored: SearchHit[] = []
  for (const snippet of snippets) {
    const hay = snippet.text.toLowerCase()
    const hits = terms.reduce((acc, term) => acc + (hay.includes(term) ? 1 : 0), 0)
    if (hits === 0) continue
    scored.push({
      id: snippet.id,
      text: snippet.text,
      label: snippet.label,
      score: hits / terms.length,
    })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}
