/// <reference lib="webworker" />

import { env, pipeline } from '@huggingface/transformers'

env.allowLocalModels = false

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'

type InMessage =
  | { type: 'init' }
  | { type: 'embed'; requestId: string; texts: string[] }

type OutMessage =
  | { type: 'progress'; status: string; progress?: number }
  | { type: 'ready' }
  | { type: 'embeddings'; requestId: string; vectors: number[][] }
  | { type: 'error'; message: string }

type Extractor = {
  (texts: string | string[], opts: { pooling: 'mean'; normalize: boolean }): Promise<{
    tolist: () => number[] | number[][]
  }>
}

let extractor: Extractor | null = null

function post(msg: OutMessage) {
  self.postMessage(msg)
}

self.onmessage = async (event: MessageEvent<InMessage>) => {
  const msg = event.data
  try {
    if (msg.type === 'init') {
      extractor = (await pipeline('feature-extraction', MODEL_ID, {
        progress_callback: (info: { status?: string; progress?: number }) => {
          post({
            type: 'progress',
            status: info.status ?? 'loading',
            progress: info.progress,
          })
        },
      })) as unknown as Extractor
      post({ type: 'ready' })
      return
    }

    if (msg.type === 'embed') {
      if (!extractor) throw new Error('Model is not ready')
      const output = await extractor(msg.texts, { pooling: 'mean', normalize: true })
      const listed = output.tolist()
      const vectors = Array.isArray(listed[0]) ? (listed as number[][]) : [listed as number[]]
      post({ type: 'embeddings', requestId: msg.requestId, vectors })
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
