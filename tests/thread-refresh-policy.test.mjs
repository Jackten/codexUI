import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldRefreshThreadListForNotificationMethod } from '../src/composables/threadPerformanceUtils.ts'

test('skips sidebar thread-list refresh for item-level notifications that only affect the open thread body', () => {
  assert.equal(shouldRefreshThreadListForNotificationMethod('item/completed'), false)
  assert.equal(shouldRefreshThreadListForNotificationMethod('item/updated'), false)
  assert.equal(shouldRefreshThreadListForNotificationMethod('item/streamed'), false)
})

test('keeps sidebar thread-list refresh for structural thread updates', () => {
  assert.equal(shouldRefreshThreadListForNotificationMethod('thread/name/updated'), true)
  assert.equal(shouldRefreshThreadListForNotificationMethod('turn/completed'), true)
})
