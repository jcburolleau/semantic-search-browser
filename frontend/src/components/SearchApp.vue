<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { EmbedClient } from '@/lib/embedClient'
import { loadEmbeddings, saveEmbeddings } from '@/lib/cache'
import { pca2, type Point2 } from '@/lib/pca'
import { keywordSearch, topKSemantic } from '@/lib/similarity'
import { getHealth, searchRemote } from '@/lib/api'
import type { Dataset, EngineMode, SearchHit, SearchMode, Snippet } from '@/lib/types'
import PcaPlot from './PcaPlot.vue'

const query = ref('')
const searchMode = ref<SearchMode>('semantic')
const engine = ref<EngineMode>('client')
const snippets = shallowRef<Snippet[]>([])
const embeddings = shallowRef<number[][] | null>(null)
const results = shallowRef<SearchHit[]>([])
const points = shallowRef<Point2[]>([])
const queryPoint = shallowRef<Point2 | null>(null)
const status = ref('Loading snippets…')
const error = ref('')
const serverStatus = ref('')
const ready = ref(false)
const searching = ref(false)
const datasetVersion = ref('1')
const source = ref('')

const client = new EmbedClient()
client.onProgress = (s, p) => {
  const pct = typeof p === 'number' ? ` ${Math.round(p)}%` : ''
  status.value = `Loading MiniLM${pct} (${s})`
}

const hitIds = computed(() => results.value.map((h) => h.id))

async function loadDataset() {
  const res = await fetch('/data.json')
  if (!res.ok) throw new Error('Could not load data.json')
  const data = (await res.json()) as Dataset
  snippets.value = data.snippets
  datasetVersion.value = data.version
  source.value = data.source
}

async function ensureClientEmbeddings() {
  const cached = loadEmbeddings(datasetVersion.value, snippets.value.length)
  if (cached) {
    embeddings.value = cached
    points.value = pca2(cached)
    status.value = 'Embeddings restored from cache'
    ready.value = true
    return
  }
  status.value = 'Downloading Xenova/all-MiniLM-L6-v2…'
  await client.init()
  status.value = 'Embedding snippets…'
  const vectors = await client.embed(snippets.value.map((s) => s.text))
  embeddings.value = vectors
  saveEmbeddings(datasetVersion.value, vectors)
  points.value = pca2(vectors)
  status.value = 'Ready (client embeddings in memory + localStorage)'
  ready.value = true
}

async function pingServer() {
  try {
    const health = await getHealth()
    serverStatus.value = `${health.model} · ${health.snippet_count} docs`
  } catch {
    serverStatus.value = 'API unreachable'
  }
}

async function runSearch() {
  const q = query.value.trim()
  if (!q) {
    results.value = []
    queryPoint.value = null
    return
  }
  error.value = ''
  searching.value = true
  try {
    if (engine.value === 'server') {
      results.value = await searchRemote(q, searchMode.value, 5)
      queryPoint.value = null
    } else if (searchMode.value === 'keyword') {
      results.value = keywordSearch(q, snippets.value, 5)
      queryPoint.value = null
    } else {
      if (!embeddings.value) await ensureClientEmbeddings()
      const [qVec] = await client.embed([q])
      if (!qVec || !embeddings.value) return
      results.value = topKSemantic(qVec, snippets.value, embeddings.value, 5)
      const all = pca2([...embeddings.value, qVec])
      points.value = all.slice(0, embeddings.value.length)
      queryPoint.value = all[all.length - 1] ?? null
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    searching.value = false
  }
}

onMounted(async () => {
  try {
    await loadDataset()
    await pingServer()
    await ensureClientEmbeddings()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    status.value = 'Failed to initialize'
  }
})

watch([searchMode, engine], () => {
  if (query.value.trim()) void runSearch()
})

onUnmounted(() => client.dispose())
</script>

<template>
  <div class="page">
    <header class="hero">
      <p class="brand">Semantic Search</p>
      <h1>Ask in meaning, not just words.</h1>
      <p class="lede">
        MiniLM embeddings in the browser (Transformers.js) and the same search over FastAPI +
        Pydantic. Corpus: {{ snippets.length }} AG News headlines from {{ source || 'Hugging Face' }}.
      </p>
      <form class="search" @submit.prevent="runSearch">
        <label class="sr-only" for="q">Search query</label>
        <input
          id="q"
          v-model="query"
          type="search"
          placeholder="Try: oil prices, olympic medal, linux kernel"
          autocomplete="off"
        />
        <button type="submit" :disabled="!ready && engine === 'client'">Search</button>
      </form>
      <p class="status" :data-busy="!ready">{{ status }}</p>
    </header>

    <section class="controls" aria-label="Search options">
      <label>
        <input v-model="searchMode" type="radio" value="semantic" />
        Semantic
      </label>
      <label>
        <input v-model="searchMode" type="radio" value="keyword" />
        Words (includes)
      </label>
      <span class="sep" />
      <label>
        <input v-model="engine" type="radio" value="client" />
        Client
      </label>
      <label>
        <input v-model="engine" type="radio" value="server" />
        Server
      </label>
      <p class="api">API: {{ serverStatus || 'checking…' }}</p>
    </section>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="searching" class="hint">Scoring…</p>

    <section class="results" aria-live="polite">
      <h2>Top 5</h2>
      <ol v-if="results.length">
        <li v-for="hit in results" :key="hit.id">
          <span class="score">{{ hit.score.toFixed(3) }}</span>
          <span class="label">{{ hit.label }}</span>
          <p>{{ hit.text }}</p>
        </li>
      </ol>
      <p v-else class="hint">Run a query to rank snippets by cosine (dot product of L2-normalized vectors).</p>
    </section>

    <section class="viz">
      <h2>PCA of snippet vectors</h2>
      <p class="hint">2D projection of the 384-d MiniLM space. Color is AG News topic; large dots are the current top hits.</p>
      <PcaPlot :points="points" :snippets="snippets" :hit-ids="hitIds" :query-point="queryPoint" />
    </section>
  </div>
</template>

<style scoped>
.page {
  max-width: 920px;
  margin: 0 auto;
  padding: 2.5rem 1.25rem 5rem;
}

.hero {
  min-height: 72vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1rem;
  padding-bottom: 1.5rem;
}

.brand {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2.8rem, 8vw, 5.4rem);
  font-weight: 800;
  letter-spacing: -0.06em;
  line-height: 0.9;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 3vw, 2rem);
  font-weight: 600;
  max-width: 18ch;
}

.lede {
  margin: 0;
  max-width: 46ch;
  color: var(--muted);
  font-size: 1.05rem;
  line-height: 1.5;
}

.search {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.5rem;
}

.search input {
  flex: 1;
  border: 0;
  border-bottom: 2px solid var(--ink);
  background: transparent;
  padding: 0.85rem 0.1rem;
  font-size: 1.1rem;
}

.search button {
  border: 0;
  background: var(--ink);
  color: #eef6f1;
  padding: 0.85rem 1.2rem;
  cursor: pointer;
  font-family: var(--font-display);
  letter-spacing: 0.02em;
}

.search button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.status {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
}

.status[data-busy='true'] {
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.45;
  }
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.85rem 1.1rem;
  padding: 1rem 0 1.5rem;
  border-top: 1px solid var(--line);
}

.controls label {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  cursor: pointer;
}

.sep {
  width: 1px;
  height: 1.2rem;
  background: var(--line);
}

.api {
  margin: 0 0 0 auto;
  font-size: 0.85rem;
  color: var(--muted);
}

.results h2,
.viz h2 {
  font-family: var(--font-display);
  font-size: 1.2rem;
  margin: 0 0 0.6rem;
}

ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}

ol li p {
  margin: 0.35rem 0 0;
  line-height: 1.45;
}

.score {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  margin-right: 0.6rem;
}

.label {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.hint {
  color: var(--muted);
  font-size: 0.95rem;
}

.error {
  color: var(--accent-2);
}

.viz {
  margin-top: 2.5rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@media (max-width: 640px) {
  .search {
    flex-direction: column;
  }
  .api {
    margin-left: 0;
    width: 100%;
  }
}
</style>
