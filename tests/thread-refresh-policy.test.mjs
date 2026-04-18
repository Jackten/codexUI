import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeActiveThreadReloadFromSync,
  noteActiveThreadReloadOutcome,
  shouldRefreshThreadListForNotificationMethod,
  shouldRefreshThreadMessagesForNotificationMethod,
  shouldReloadActiveThreadFromSync,
} from '../src/composables/threadPerformanceUtils.ts'

test('skips sidebar thread-list refresh for item-level notifications that only affect the open thread body', () => {
  assert.equal(shouldRefreshThreadListForNotificationMethod('item/completed'), false)
  assert.equal(shouldRefreshThreadListForNotificationMethod('item/updated'), false)
  assert.equal(shouldRefreshThreadListForNotificationMethod('item/streamed'), false)
})

test('keeps sidebar thread-list refresh for structural thread updates', () => {
  assert.equal(shouldRefreshThreadListForNotificationMethod('thread/name/updated'), true)
  assert.equal(shouldRefreshThreadListForNotificationMethod('turn/completed'), true)
})

test('skips full active-thread reloads for item streaming notifications that are already handled incrementally', () => {
  assert.equal(shouldRefreshThreadMessagesForNotificationMethod('item/started'), false)
  assert.equal(shouldRefreshThreadMessagesForNotificationMethod('item/completed'), false)
  assert.equal(shouldRefreshThreadMessagesForNotificationMethod('item/agentMessage/delta'), false)
  assert.equal(shouldRefreshThreadMessagesForNotificationMethod('item/commandExecution/delta'), false)
})

test('keeps active-thread reloads for turn lifecycle boundaries', () => {
  assert.equal(shouldRefreshThreadMessagesForNotificationMethod('turn/completed'), true)
  assert.equal(shouldRefreshThreadMessagesForNotificationMethod('turn/failed'), true)
  assert.equal(shouldRefreshThreadMessagesForNotificationMethod('turn/interrupted'), true)
  assert.equal(shouldRefreshThreadMessagesForNotificationMethod('turn/cancelled'), true)
})

test('does not mark the active thread body dirty for thread metadata updates', () => {
  assert.equal(shouldRefreshThreadMessagesForNotificationMethod('thread/name/updated'), false)
  assert.equal(shouldRefreshThreadMessagesForNotificationMethod('thread/archived'), false)
})

test('does not reload the active thread just because the sidebar thread list refreshed', () => {
  assert.equal(shouldReloadActiveThreadFromSync({
    isActiveDirty: false,
    hasVersionChange: false,
    shouldRefreshThreads: true,
  }), false)
})

test('reloads the active thread when it is dirty or version-changed', () => {
  assert.equal(shouldReloadActiveThreadFromSync({
    isActiveDirty: true,
    hasVersionChange: false,
    shouldRefreshThreads: false,
  }), true)
  assert.equal(shouldReloadActiveThreadFromSync({
    isActiveDirty: false,
    hasVersionChange: true,
    shouldRefreshThreads: false,
  }), true)
})

test('reports why the active thread is being reloaded from sync', () => {
  assert.deepEqual(describeActiveThreadReloadFromSync({
    hasMessageBodyChange: true,
    hasVersionChange: true,
    shouldRefreshThreads: true,
  }), {
    shouldReload: true,
    reasons: ['message-body-change', 'version-change'],
  })

  assert.deepEqual(describeActiveThreadReloadFromSync({
    hasMessageBodyChange: false,
    hasVersionChange: false,
    shouldRefreshThreads: true,
  }), {
    shouldReload: false,
    reasons: [],
  })
})

test('warns after repeated active-thread reloads without a version advance', () => {
  const first = noteActiveThreadReloadOutcome(undefined, {
    threadId: 'thread-1',
    reasons: ['message-body-change'],
    loadedVersionBeforeReload: 'v1',
    loadedVersionAfterReload: 'v1',
  })
  assert.equal(first.shouldWarn, false)
  assert.equal(first.state.sameVersionReloadStreak, 1)

  const second = noteActiveThreadReloadOutcome(first.state, {
    threadId: 'thread-1',
    reasons: ['message-body-change'],
    loadedVersionBeforeReload: 'v1',
    loadedVersionAfterReload: 'v1',
  })
  assert.equal(second.shouldWarn, false)
  assert.equal(second.state.sameVersionReloadStreak, 2)

  const third = noteActiveThreadReloadOutcome(second.state, {
    threadId: 'thread-1',
    reasons: ['message-body-change'],
    loadedVersionBeforeReload: 'v1',
    loadedVersionAfterReload: 'v1',
  })
  assert.equal(third.shouldWarn, true)
  assert.equal(third.state.sameVersionReloadStreak, 3)

  const reset = noteActiveThreadReloadOutcome(third.state, {
    threadId: 'thread-1',
    reasons: ['version-change'],
    loadedVersionBeforeReload: 'v1',
    loadedVersionAfterReload: 'v2',
  })
  assert.equal(reset.shouldWarn, false)
  assert.equal(reset.state.sameVersionReloadStreak, 0)
})
