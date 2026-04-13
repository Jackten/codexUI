export type TimedCacheEntry<T> = {
  value: T
  fetchedAt: number
}

export function readTimedCacheValue<T>(
  cache: Map<string, TimedCacheEntry<T>>,
  key: string,
  nowMs: number,
  ttlMs: number,
): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (nowMs - entry.fetchedAt > ttlMs) return null
  return entry.value
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
