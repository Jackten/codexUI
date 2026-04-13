import test from 'node:test'
import assert from 'node:assert/strict'

import {
  readTimedCacheValue,
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
