export const BASE_LIVE_STATE_CACHE_TTL_MS = 30_000
export const LARGE_COMPLETED_SESSION_BYTES = 8 * 1024 * 1024
export const LARGE_COMPLETED_SESSION_CACHE_TTL_MS = 30 * 60_000
export const HUGE_COMPLETED_SESSION_BYTES = 128 * 1024 * 1024
export const HUGE_COMPLETED_SESSION_CACHE_TTL_MS = 6 * 60 * 60_000

export function resolveLiveStateCacheTtlMs(params: {
  sessionSizeBytes: number
  isInProgress: boolean
}): number {
  const { sessionSizeBytes, isInProgress } = params
  if (isInProgress) return 0

  if (sessionSizeBytes >= HUGE_COMPLETED_SESSION_BYTES) {
    return HUGE_COMPLETED_SESSION_CACHE_TTL_MS
  }

  if (sessionSizeBytes >= LARGE_COMPLETED_SESSION_BYTES) {
    return LARGE_COMPLETED_SESSION_CACHE_TTL_MS
  }

  return BASE_LIVE_STATE_CACHE_TTL_MS
}
