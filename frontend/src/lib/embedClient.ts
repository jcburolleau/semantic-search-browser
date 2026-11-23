type WorkerOut =
  | { type: 'progress'; status: string; progress?: number }
  | { type: 'ready' }
  | { type: 'embeddings'; requestId: string; vectors: number[][] }
  | { type: 'error'; message: string }

export class EmbedClient {
  private worker: Worker
  private ready = false
  private pending = new Map<string, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>()
  private initPromise: Promise<void> | null = null
  onProgress: ((status: string, progress?: number) => void) | null = null

  constructor() {
    this.worker = new Worker(new URL('../workers/embedding.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.onmessage = (event: MessageEvent<WorkerOut>) => {
      const msg = event.data
      if (msg.type === 'progress') {
        this.onProgress?.(msg.status, msg.progress)
        return
      }
      if (msg.type === 'error') {
        for (const p of this.pending.values()) p.reject(new Error(msg.message))
        this.pending.clear()
        return
      }
      if (msg.type === 'ready') {
        this.ready = true
        return
      }
      if (msg.type === 'embeddings') {
        const pending = this.pending.get(msg.requestId)
        if (pending) {
          this.pending.delete(msg.requestId)
          pending.resolve(msg.vectors)
        }
      }
    }
  }

  async init(): Promise<void> {
    if (this.ready) return
    if (this.initPromise) return this.initPromise
    this.initPromise = new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerOut>) => {
        if (event.data.type === 'ready') {
          this.worker.removeEventListener('message', onMessage)
          resolve()
        }
        if (event.data.type === 'error') {
          this.worker.removeEventListener('message', onMessage)
          reject(new Error(event.data.message))
        }
      }
      this.worker.addEventListener('message', onMessage)
      this.worker.postMessage({ type: 'init' })
    })
    return this.initPromise
  }

  async embed(texts: string[]): Promise<number[][]> {
    await this.init()
    const requestId = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.worker.postMessage({ type: 'embed', requestId, texts })
    })
  }

  dispose() {
    this.worker.terminate()
  }
}
