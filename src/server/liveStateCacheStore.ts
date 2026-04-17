export const DEFAULT_MAX_LIVE_STATE_CACHE_ENTRIES = 12
export const DEFAULT_MAX_LIVE_STATE_CACHE_BYTES = 128 * 1024 * 1024
export const DEFAULT_MAX_LIVE_STATE_CACHE_ENTRY_BYTES = 16 * 1024 * 1024

type LiveStateCacheEntry = {
  data: unknown
  expiresAt: number
  estimatedBytes: number
}

function estimateLiveStateBytes(data: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(data), 'utf8')
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

export class LiveStateCacheStore {
  private readonly entries = new Map<string, LiveStateCacheEntry>()
  private totalEstimatedBytes = 0
  private readonly now: () => number
  private readonly maxEntries: number
  private readonly maxBytes: number
  private readonly maxEntryBytes: number

  constructor(options: {
    now?: () => number
    maxEntries?: number
    maxBytes?: number
    maxEntryBytes?: number
  } = {}) {
    this.now = options.now ?? (() => Date.now())
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_LIVE_STATE_CACHE_ENTRIES
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_LIVE_STATE_CACHE_BYTES
    this.maxEntryBytes = options.maxEntryBytes ?? DEFAULT_MAX_LIVE_STATE_CACHE_ENTRY_BYTES
  }

  set(threadId: string, data: unknown, ttlMs: number): void {
    if (ttlMs <= 0) {
      this.delete(threadId)
      return
    }

    const estimatedBytes = estimateLiveStateBytes(data)
    if (!Number.isFinite(estimatedBytes) || estimatedBytes <= 0 || estimatedBytes > this.maxEntryBytes) {
      this.delete(threadId)
      return
    }

    const now = this.now()
    this.pruneExpired(now)
    this.delete(threadId)

    this.entries.set(threadId, {
      data,
      expiresAt: now + ttlMs,
      estimatedBytes,
    })
    this.totalEstimatedBytes += estimatedBytes
    this.evictToBudget()
  }

  get(threadId: string): unknown | null {
    const entry = this.entries.get(threadId)
    if (!entry) return null

    const now = this.now()
    if (entry.expiresAt <= now) {
      this.delete(threadId)
      return null
    }

    this.entries.delete(threadId)
    this.entries.set(threadId, entry)
    return entry.data
  }

  delete(threadId: string): void {
    const existing = this.entries.get(threadId)
    if (!existing) return
    this.entries.delete(threadId)
    this.totalEstimatedBytes = Math.max(0, this.totalEstimatedBytes - existing.estimatedBytes)
  }

  private pruneExpired(now: number): void {
    for (const [threadId, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.delete(threadId)
      }
    }
  }

  private evictToBudget(): void {
    while (
      this.entries.size > this.maxEntries ||
      this.totalEstimatedBytes > this.maxBytes
    ) {
      const oldestKey = this.entries.keys().next().value
      if (!oldestKey) break
      this.delete(oldestKey)
    }
  }
}
