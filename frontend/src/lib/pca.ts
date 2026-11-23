/** 2D PCA via covariance + power iteration (no numeric deps). */

function matVec(matrix: number[][], vec: number[]): number[] {
  return matrix.map((row) => {
    let sum = 0
    for (let i = 0; i < vec.length; i++) sum += (row[i] ?? 0) * (vec[i] ?? 0)
    return sum
  })
}

function normalize(vec: number[]): number[] {
  let n = 0
  for (const v of vec) n += v * v
  const mag = Math.sqrt(n) || 1
  return vec.map((v) => v / mag)
}

function powerIteration(cov: number[][], deflate?: number[]): number[] {
  const dim = cov.length
  let vec = Array.from({ length: dim }, () => Math.random() - 0.5)
  vec = normalize(vec)
  for (let iter = 0; iter < 40; iter++) {
    let next = matVec(cov, vec)
    if (deflate) {
      const proj = next.reduce((s, v, i) => s + v * (deflate[i] ?? 0), 0)
      next = next.map((v, i) => v - proj * (deflate[i] ?? 0))
    }
    vec = normalize(next)
  }
  return vec
}

function covariance(centered: number[][]): number[][] {
  const n = centered.length
  const dim = centered[0]?.length ?? 0
  const cov: number[][] = Array.from({ length: dim }, () => Array(dim).fill(0))
  for (const row of centered) {
    for (let i = 0; i < dim; i++) {
      const vi = row[i] ?? 0
      const covRow = cov[i]
      if (!covRow) continue
      for (let j = i; j < dim; j++) {
        covRow[j] = (covRow[j] ?? 0) + vi * (row[j] ?? 0)
      }
    }
  }
  const denom = Math.max(n - 1, 1)
  for (let i = 0; i < dim; i++) {
    const covRow = cov[i]
    if (!covRow) continue
    for (let j = i; j < dim; j++) {
      const v = (covRow[j] ?? 0) / denom
      covRow[j] = v
      const other = cov[j]
      if (other) other[i] = v
    }
  }
  return cov
}

export type Point2 = { x: number; y: number }

export function pca2(vectors: number[][]): Point2[] {
  if (vectors.length === 0) return []
  const dim = vectors[0]?.length ?? 0
  const mean = Array(dim).fill(0)
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) mean[i] = (mean[i] ?? 0) + (v[i] ?? 0)
  }
  for (let i = 0; i < dim; i++) mean[i] = (mean[i] ?? 0) / vectors.length

  const centered = vectors.map((v) => v.map((x, i) => x - (mean[i] ?? 0)))
  const cov = covariance(centered)
  const pc1 = powerIteration(cov)
  const pc2 = powerIteration(cov, pc1)

  return centered.map((row) => ({
    x: row.reduce((s, v, i) => s + v * (pc1[i] ?? 0), 0),
    y: row.reduce((s, v, i) => s + v * (pc2[i] ?? 0), 0),
  }))
}
