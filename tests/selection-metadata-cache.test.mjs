import test from 'node:test'
import assert from 'node:assert/strict'

import { getOrRefreshTimedCacheValue } from '../src/composables/threadPerformanceUtils.ts'

test('reuses a fresh cached value without calling the fetcher again', async () => {
  const cache = new Map([
    ['workspace-roots-state', { value: { order: ['/root'], labels: {}, active: ['/root'] }, fetchedAt: Date.now() }],
  ])
  const inFlightRequests = new Map()
  let fetchCount = 0

  const result = await getOrRefreshTimedCacheValue({
    cache,
    inFlightRequests,
    key: 'workspace-roots-state',
    ttlMs: 15_000,
    createRequest: async () => {
      fetchCount += 1
      return { order: ['/tmp'], labels: {}, active: ['/tmp'] }
    },
  })

  assert.deepEqual(result, { order: ['/root'], labels: {}, active: ['/root'] })
  assert.equal(fetchCount, 0)
})

test('collapses concurrent cache misses into one in-flight request and stores the result', async () => {
  const cache = new Map()
  const inFlightRequests = new Map()
  let fetchCount = 0
  let resolveFetch
  const fetchPromise = new Promise((resolve) => {
    resolveFetch = resolve
  })

  const run = () => getOrRefreshTimedCacheValue({
    cache,
    inFlightRequests,
    key: 'workspace-roots-state',
    ttlMs: 15_000,
    createRequest: async () => {
      fetchCount += 1
      await fetchPromise
      return { order: ['/srv'], labels: { '/srv': 'srv' }, active: ['/srv'] }
    },
  })

  const [firstPromise, secondPromise] = [run(), run()]
  resolveFetch()
  const [first, second] = await Promise.all([firstPromise, secondPromise])

  assert.equal(fetchCount, 1)
  assert.deepEqual(first, second)
  assert.deepEqual(cache.get('workspace-roots-state')?.value, { order: ['/srv'], labels: { '/srv': 'srv' }, active: ['/srv'] })
})

test('force refresh bypasses a fresh cached value and replaces it', async () => {
  const cache = new Map([
    ['project-root', { value: { name: 'Old Project', path: '/root/old' }, fetchedAt: Date.now() }],
  ])
  const inFlightRequests = new Map()
  let fetchCount = 0

  const result = await getOrRefreshTimedCacheValue({
    cache,
    inFlightRequests,
    key: 'project-root',
    ttlMs: 15_000,
    force: true,
    createRequest: async () => {
      fetchCount += 1
      return { name: 'New Project', path: '/root/new' }
    },
  })

  assert.equal(fetchCount, 1)
  assert.deepEqual(result, { name: 'New Project', path: '/root/new' })
  assert.deepEqual(cache.get('project-root')?.value, { name: 'New Project', path: '/root/new' })
})
