<script setup lang="ts">
import { computed } from 'vue'
import type { Point2 } from '@/lib/pca'
import type { Snippet } from '@/lib/types'

const props = defineProps<{
  points: Point2[]
  snippets: Snippet[]
  hitIds: string[]
  queryPoint: Point2 | null
}>()

const COLORS: Record<string, string> = {
  World: '#0f6e56',
  Sports: '#c45a1a',
  Business: '#1a6b9a',
  'Sci/Tech': '#6b3fa0',
}

const mapped = computed(() => {
  const pts = [...props.points]
  if (props.queryPoint) pts.push(props.queryPoint)
  if (pts.length === 0) return []
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = 24
  const w = 640
  const h = 360
  const sx = maxX === minX ? 1 : (w - pad * 2) / (maxX - minX)
  const sy = maxY === minY ? 1 : (h - pad * 2) / (maxY - minY)
  const project = (p: Point2) => ({
    x: pad + (p.x - minX) * sx,
    y: h - pad - (p.y - minY) * sy,
  })
  return {
    w,
    h,
    dots: props.points.map((p, i) => ({
      ...project(p),
      snippet: props.snippets[i],
      hit: props.snippets[i] ? props.hitIds.includes(props.snippets[i]!.id) : false,
    })),
    query: props.queryPoint ? project(props.queryPoint) : null,
  }
})
</script>

<template>
  <div class="plot">
    <svg v-if="mapped && 'w' in mapped" :viewBox="`0 0 ${mapped.w} ${mapped.h}`" role="img" aria-label="PCA scatter of snippet embeddings">
      <circle
        v-for="(dot, i) in mapped.dots"
        :key="dot.snippet?.id ?? i"
        :cx="dot.x"
        :cy="dot.y"
        :r="dot.hit ? 7 : 4.5"
        :fill="COLORS[dot.snippet?.label ?? ''] ?? '#14241f'"
        :opacity="dot.hit ? 1 : 0.55"
      >
        <title>{{ dot.snippet?.label }} — {{ dot.snippet?.text.slice(0, 80) }}</title>
      </circle>
      <g v-if="mapped.query">
        <circle :cx="mapped.query.x" :cy="mapped.query.y" r="9" fill="#14241f" />
        <text :x="mapped.query.x + 12" :y="mapped.query.y + 4" class="q-label">query</text>
      </g>
    </svg>
    <ul class="legend">
      <li v-for="(color, label) in COLORS" :key="label">
        <span :style="{ background: color }" />{{ label }}
      </li>
      <li><span class="query" />query</li>
    </ul>
  </div>
</template>

<style scoped>
.plot {
  display: grid;
  gap: 0.75rem;
}

svg {
  width: 100%;
  height: auto;
  background: #f4faf6aa;
  border-top: 1px solid var(--line);
}

.q-label {
  font-size: 12px;
  font-family: var(--font-display);
  fill: var(--ink);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem 1.2rem;
  list-style: none;
  margin: 0;
  padding: 0 0.25rem 0.5rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.legend span {
  display: inline-block;
  width: 0.7rem;
  height: 0.7rem;
  margin-right: 0.4rem;
  border-radius: 50%;
  vertical-align: -1px;
}

.legend .query {
  background: #14241f;
}
</style>
