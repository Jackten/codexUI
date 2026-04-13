import test from 'node:test'
import assert from 'node:assert/strict'

import {
  readTimedCacheValue,
  isTimestampFresh,
  getOrStartInFlightRequest,
  touchThreadAccessOrder,
  selectThreadsToEvict,
} from '../src/composables/threadPerformanceUtils.ts'

test('readTimedCacheValue returns cached value while entry is still fresh', () => {
  const cache = new Map([
    ['root', { value: { currentBranch: 'main', options: ['main'] }, fetchedAt: 1_000 }],
  ])

  const value = readTimedCacheValue(cache, 'root', 5_000, 10_000)

  assert.deepEqual(value, { currentBranch: 'main', options: ['main'] })
})

test('readTimedCacheValue ignores stale entries', () => {
  const cache = new Map([
    ['root', { value: ['skill-a'], fetchedAt: 1_000 }],
  ])

  const value = readTimedCacheValue(cache, 'root', 25_000, 10_000)

  assert.equal(value, null)
})

test('isTimestampFresh returns true only for non-zero timestamps within ttl', () => {
  assert.equal(isTimestampFresh(1_000, 1_500, 1_000), true)
  assert.equal(isTimestampFresh(0, 1_500, 1_000), false)
  assert.equal(isTimestampFresh(1_000, 2_500, 1_000), false)
})

test('getOrStartInFlightRequest reuses the same promise for duplicate callers and clears it after settle', async () => {
  const inFlight = new Map()
  let starts = 0

  const createRequest = () => {
    starts += 1
    return new Promise((resolve) => {
      setTimeout(() => resolve({ ok: true, starts }), 5)
    })
  }

  const first = getOrStartInFlightRequest(inFlight, 'thread-groups', createRequest)
  const second = getOrStartInFlightRequest(inFlight, 'thread-groups', createRequest)

  assert.equal(first, second)
  assert.equal(starts, 1)
  assert.equal(inFlight.has('thread-groups'), true)

  const result = await first
  assert.deepEqual(result, { ok: true, starts: 1 })
  assert.equal(inFlight.has('thread-groups'), false)
})

test('touchThreadAccessOrder moves the newest thread to the end without duplicates', () => {
  const next = touchThreadAccessOrder(['thread-a', 'thread-b', 'thread-c'], 'thread-b')

  assert.deepEqual(next, ['thread-a', 'thread-c', 'thread-b'])
})

test('selectThreadsToEvict keeps the selected and protected threads while trimming older loaded threads', () => {
  const evicted = selectThreadsToEvict({
    loadedThreadIds: ['thread-a', 'thread-b', 'thread-c', 'thread-d', 'thread-e'],
    accessOrder: ['thread-a', 'thread-b', 'thread-c', 'thread-d', 'thread-e'],
    selectedThreadId: 'thread-e',
    retainCount: 3,
    protectedThreadIds: ['thread-c'],
  })

  assert.deepEqual(evicted, ['thread-a', 'thread-b'])
})

test('selectThreadsToEvict returns nothing when loaded thread count is already within the retention budget', () => {
  const evicted = selectThreadsToEvict({
    loadedThreadIds: ['thread-a', 'thread-b'],
    accessOrder: ['thread-a', 'thread-b'],
    selectedThreadId: 'thread-b',
    retainCount: 3,
  })

  assert.deepEqual(evicted, [])
})
