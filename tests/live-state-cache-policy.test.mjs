import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BASE_LIVE_STATE_CACHE_TTL_MS,
  LARGE_COMPLETED_SESSION_CACHE_TTL_MS,
  HUGE_COMPLETED_SESSION_CACHE_TTL_MS,
  HUGE_COMPLETED_SESSION_BYTES,
  LARGE_COMPLETED_SESSION_BYTES,
  resolveLiveStateCacheTtlMs,
} from '../src/server/liveStateCachePolicy.ts'

test('keeps the short base cache only for normal completed sessions', () => {
  assert.equal(
    resolveLiveStateCacheTtlMs({ sessionSizeBytes: LARGE_COMPLETED_SESSION_BYTES - 1, isInProgress: false }),
    BASE_LIVE_STATE_CACHE_TTL_MS,
  )
})

test('extends completed-thread cache TTL for large historical sessions', () => {
  assert.equal(
    resolveLiveStateCacheTtlMs({ sessionSizeBytes: LARGE_COMPLETED_SESSION_BYTES, isInProgress: false }),
    LARGE_COMPLETED_SESSION_CACHE_TTL_MS,
  )
})

test('extends giant completed-thread cache TTL even more for very large session files', () => {
  assert.equal(
    resolveLiveStateCacheTtlMs({ sessionSizeBytes: HUGE_COMPLETED_SESSION_BYTES, isInProgress: false }),
    HUGE_COMPLETED_SESSION_CACHE_TTL_MS,
  )
  assert.equal(
    resolveLiveStateCacheTtlMs({ sessionSizeBytes: 704_253_891, isInProgress: false }),
    HUGE_COMPLETED_SESSION_CACHE_TTL_MS,
  )
})

test('does not cache in-progress live state snapshots', () => {
  assert.equal(
    resolveLiveStateCacheTtlMs({ sessionSizeBytes: 704_253_891, isInProgress: true }),
    0,
  )
})
