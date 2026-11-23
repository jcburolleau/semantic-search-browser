<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { EmbedClient } from '@/lib/embedClient'
import { loadEmbeddings, saveEmbeddings } from '@/lib/cache'
import { pca2, type Point2 } from '@/lib/pca'
import { keywordSearch, topKSemantic } from '@/lib/similarity'
import { getHealth, searchRemote } from '@/lib/api'
import type { Dataset, EngineMode, SearchHit, SearchMode, Snippet } from '@/lib/types'
import PcaPlot from './PcaPlot.vue'

const SEMANTIC_EXAMPLES = ['soaring crude costs', 'winning gold in athens', 'open source operating system']
const KEYWORD_EXAMPLES = ['oil', 'Olympic', 'Linux']

const examples = computed(() => (searchMode.value === 'keyword' ? KEYWORD_EXAMPLES : SEMANTIC_EXAMPLES))

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
const canSearch = computed(() => engine.value === 'server' || ready.value)
const plotReady = computed(() => points.value.length > 0)
const resultsBusy = computed(() => {
  if (searching.value) return true
  const needsClientModel = engine.value === 'client' && searchMode.value === 'semantic'
  return needsClientModel && !ready.value
})

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

function applyExample(text: string) {
  query.value = text
  void runSearch()
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
    <header class="mast">
      <p class="brand">Semantic Search</p>
      <p class="lede">
        {{ snippets.length || '…' }} AG News headlines · {{ source || 'Hugging Face' }}
        <template v-if="engine === 'server'"> · {{ serverStatus || 'API checking…' }}</template>
      </p>
    </header>

    <form class="search" @submit.prevent="runSearch">
      <label class="sr-only" for="q">Search query</label>
      <input
        id="q"
        v-model="query"
        type="search"
        placeholder="Search query"
        autocomplete="off"
      />
      <button class="go" type="submit" :disabled="!canSearch" aria-label="Run search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 12h12M13 6l6 6-6 6"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </form>

    <div class="toolbar">
      <div class="toggles" role="group" aria-label="Search options">
        <div class="switch" role="radiogroup" aria-label="Ranking">
          <button
            type="button"
            :class="{ on: searchMode === 'semantic' }"
            :aria-pressed="searchMode === 'semantic'"
            @click="searchMode = 'semantic'"
          >
            Semantic
          </button>
          <button
            type="button"
            :class="{ on: searchMode === 'keyword' }"
            :aria-pressed="searchMode === 'keyword'"
            @click="searchMode = 'keyword'"
          >
            Words
          </button>
        </div>
        <div class="switch" role="radiogroup" aria-label="Engine">
          <button
            type="button"
            :class="{ on: engine === 'client' }"
            :aria-pressed="engine === 'client'"
            @click="engine = 'client'"
          >
            Client
          </button>
          <button
            type="button"
            :class="{ on: engine === 'server' }"
            :aria-pressed="engine === 'server'"
            @click="engine = 'server'"
          >
            Server
          </button>
        </div>
      </div>
      <div class="examples">
        <button v-for="ex in examples" :key="ex" type="button" class="chip" @click="applyExample(ex)">
          {{ ex }}
        </button>
      </div>
    </div>

    <div class="split">
      <section class="panel results" aria-live="polite">
        <h2>Results</h2>
        <div v-if="error" class="panel-state error" role="alert">{{ error }}</div>
        <div v-else-if="resultsBusy" class="panel-state" :data-busy="true">
          {{ searching ? 'Scoring…' : status }}
        </div>
        <ol v-else-if="results.length">
          <li v-for="hit in results" :key="hit.id">
            <span class="score">{{ hit.score.toFixed(3) }}</span>
            <span class="label">{{ hit.label }}</span>
            <p>{{ hit.text }}</p>
          </li>
        </ol>
        <p v-else class="panel-state hint">Run a query to rank the top 5 snippets.</p>
      </section>

      <section class="panel viz">
        <h2>Plot</h2>
        <div v-if="!plotReady" class="panel-state" :data-busy="!error">
          {{ error || status }}
        </div>
        <PcaPlot
          v-else
          :points="points"
          :snippets="snippets"
          :hit-ids="hitIds"
          :query-point="queryPoint"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 1120px;
  margin: 0 auto;
  padding: 1.75rem 1.25rem 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mast {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.brand {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  font-weight: 800;
  letter-spacing: -0.05em;
}

.lede {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.search {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  padding: 0.35rem 0.4rem 0.35rem 1.1rem;
  background: #f7fbf8ee;
}

.search input {
  flex: 1;
  border: 0;
  background: transparent;
  padding: 0.55rem 0;
  font-size: 1.05rem;
  min-width: 0;
}

.search input:focus {
  outline: none;
}

.go {
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 2.5rem;
  border: 0;
  border-radius: 50%;
  background: var(--ink);
  color: #eef6f1;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.go svg {
  width: 1.15rem;
  height: 1.15rem;
}

.go:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar {
  width: 100%;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.85rem;
}

.toggles {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.5rem;
  flex-shrink: 0;
}

.switch {
  display: flex;
  padding: 0.18rem;
  border-radius: 999px;
  background: #14241f12;
}

.switch button {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 0.4rem 0.95rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.9rem;
}

.switch button.on {
  background: var(--ink);
  color: #eef6f1;
}

.examples {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 0.45rem;
  min-width: 0;
}

.chip {
  border: 1.5px solid var(--ink);
  background: transparent;
  border-radius: 999px;
  padding: 0.38rem 0.8rem;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}

.chip:hover {
  background: #14241f0d;
}

.panel-state {
  flex: 1;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 1.5rem;
  text-align: center;
  color: var(--muted);
  font-size: 0.95rem;
}

.panel-state[data-busy='true'] {
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.45;
  }
}

.panel-state.error {
  color: var(--accent-2);
}

.hint {
  color: var(--muted);
}

.split {
  width: 100%;
  margin-top: 1.25rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  align-items: start;
}

.panel {
  border: 1.5px solid var(--ink);
  border-radius: 1.4rem;
  padding: 1rem 1.1rem 1.15rem;
  background: #f7fbf8cc;
  display: flex;
  flex-direction: column;
}

.viz {
  height: 28rem;
  overflow: hidden;
}

.viz :deep(.plot) {
  flex: 1;
  min-height: 0;
}

.panel h2 {
  font-family: var(--font-display);
  font-size: 1.05rem;
  margin: 0 0 0.75rem;
}

.results ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.85rem;
  overflow: auto;
}

.results ol li p {
  margin: 0.3rem 0 0;
  line-height: 1.4;
  font-size: 0.92rem;
}

.score {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  margin-right: 0.5rem;
}

.label {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@media (max-width: 800px) {
  .split {
    grid-template-columns: 1fr;
  }
  .mast {
    flex-direction: column;
    gap: 0.25rem;
  }
  .toolbar {
    flex-wrap: wrap;
  }
  .examples {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
