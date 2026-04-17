import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LiveStateCacheStore,
} from '../src/server/liveStateCacheStore.ts'

test('returns cached live state while entry is fresh', () => {
  let now = 1_000
  const cache = new LiveStateCacheStore({ now: () => now })
  const payload = { threadId: 'thread-1', conversationState: { turns: [{ id: 'turn-1' }] } }

  cache.set('thread-1', payload, 5_000)

  assert.deepEqual(cache.get('thread-1'), payload)

  now += 4_999
  assert.deepEqual(cache.get('thread-1'), payload)
})

test('drops expired live state entries on read', () => {
  let now = 2_000
  const cache = new LiveStateCacheStore({ now: () => now })
  const payload = { threadId: 'thread-2', conversationState: { turns: [{ id: 'turn-2' }] } }

  cache.set('thread-2', payload, 1_000)
  now += 1_001

  assert.equal(cache.get('thread-2'), null)
})

test('evicts the least recently used entry when byte budget is exceeded', () => {
  let now = 3_000
  const cache = new LiveStateCacheStore({
    now: () => now,
    maxBytes: 320,
    maxEntries: 10,
    maxEntryBytes: 320,
  })

  const makePayload = (label) => ({
    threadId: label,
    conversationState: { turns: [{ id: label, text: 'x'.repeat(40) }] },
  })

  cache.set('thread-a', makePayload('thread-a'), 60_000)
  now += 1
  cache.set('thread-b', makePayload('thread-b'), 60_000)
  now += 1
  assert.ok(cache.get('thread-a'))
  now += 1
  cache.set('thread-c', makePayload('thread-c'), 60_000)

  assert.ok(cache.get('thread-a'))
  assert.equal(cache.get('thread-b'), null)
  assert.ok(cache.get('thread-c'))
})

test('skips caching oversized live state payloads', () => {
  const cache = new LiveStateCacheStore({
    maxBytes: 1_024,
    maxEntries: 10,
    maxEntryBytes: 120,
  })

  cache.set('thread-huge', {
    threadId: 'thread-huge',
    conversationState: { turns: [{ id: 'turn-huge', text: 'x'.repeat(1_000) }] },
  }, 60_000)

  assert.equal(cache.get('thread-huge'), null)
})
