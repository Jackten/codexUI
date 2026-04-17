import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldRefreshThreadListForNotificationMethod, shouldRefreshThreadMessagesForNotificationMethod } from '../src/composables/threadPerformanceUtils.ts'

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
