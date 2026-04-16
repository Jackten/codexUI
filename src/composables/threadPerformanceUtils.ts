export type TimedCacheEntry<T> = {
  value: T
  fetchedAt: number
}

export function isTimestampFresh(fetchedAt: number, nowMs: number, ttlMs: number): boolean {
  return fetchedAt > 0 && nowMs - fetchedAt <= ttlMs
}

export function readTimedCacheValue<T>(
  cache: Map<string, TimedCacheEntry<T>>,
  key: string,
  nowMs: number,
  ttlMs: number,
): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (!isTimestampFresh(entry.fetchedAt, nowMs, ttlMs)) return null
  return entry.value
}

export function getOrStartInFlightRequest<T>(
  inFlightRequests: Map<string, Promise<T>>,
  key: string,
  createRequest: () => Promise<T>,
): Promise<T> {
  const existingRequest = inFlightRequests.get(key)
  if (existingRequest) return existingRequest

  const request = createRequest()
    .finally(() => {
      if (inFlightRequests.get(key) === request) {
        inFlightRequests.delete(key)
      }
    })

  inFlightRequests.set(key, request)
  return request
}

export async function getOrRefreshTimedCacheValue<T>(params: {
  cache: Map<string, TimedCacheEntry<T>>
  inFlightRequests: Map<string, Promise<T>>
  key: string
  ttlMs: number
  force?: boolean
  createRequest: () => Promise<T>
}): Promise<T> {
  const { cache, inFlightRequests, key, ttlMs, force, createRequest } = params
  if (!force) {
    const cached = readTimedCacheValue(cache, key, Date.now(), ttlMs)
    if (cached !== null) return cached
  }

  return getOrStartInFlightRequest(inFlightRequests, key, async () => {
    const value = await createRequest()
    cache.set(key, {
      value,
      fetchedAt: Date.now(),
    })
    return value
  })
}

export function shouldRefreshThreadListForNotificationMethod(method: string): boolean {
  if (!method || method === 'thread/tokenUsage/updated') return false
  if (method.startsWith('item/')) return false
  if (method.startsWith('turn/')) {
    return (
      method === 'turn/started' ||
      method === 'turn/completed' ||
      method === 'turn/cancelled' ||
      method === 'turn/interrupted' ||
      method === 'turn/failed'
    )
  }
  return method.startsWith('thread/')
}

export function touchThreadAccessOrder(order: string[], threadId: string): string[] {
  const normalizedThreadId = threadId.trim()
  if (!normalizedThreadId) return order
  const next = order.filter((value) => value !== normalizedThreadId)
  next.push(normalizedThreadId)
  return next
}

export function selectThreadsToEvict(params: {
  loadedThreadIds: string[]
  accessOrder: string[]
  selectedThreadId: string
  retainCount: number
  protectedThreadIds?: Iterable<string>
}): string[] {
  const { loadedThreadIds, accessOrder, selectedThreadId, retainCount, protectedThreadIds } = params
  if (loadedThreadIds.length <= retainCount) return []

  const loadedThreadIdSet = new Set(loadedThreadIds)
  const protectedThreadIdSet = new Set<string>(protectedThreadIds ?? [])
  const survivors = new Set<string>()
  const normalizedSelectedThreadId = selectedThreadId.trim()
  if (normalizedSelectedThreadId) {
    survivors.add(normalizedSelectedThreadId)
  }
  for (const threadId of protectedThreadIdSet) {
    if (loadedThreadIdSet.has(threadId)) {
      survivors.add(threadId)
    }
  }

  const orderedLoadedThreadIds = [
    ...accessOrder.filter((threadId) => loadedThreadIdSet.has(threadId)),
    ...loadedThreadIds.filter((threadId) => !accessOrder.includes(threadId)),
  ]

  for (let index = orderedLoadedThreadIds.length - 1; index >= 0 && survivors.size < retainCount; index -= 1) {
    survivors.add(orderedLoadedThreadIds[index])
  }

  return orderedLoadedThreadIds.filter((threadId) => loadedThreadIdSet.has(threadId) && !survivors.has(threadId))
}
