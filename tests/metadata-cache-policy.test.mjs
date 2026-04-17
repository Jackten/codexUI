import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LOCAL_PATH_PROBE_TTL_MS,
  PROJECT_ROOT_SUGGESTION_CACHE_TTL_MS,
  SKILLS_CACHE_TTL_MS,
  THREAD_BRANCH_CACHE_TTL_MS,
  THREAD_TITLE_CACHE_TTL_MS,
} from '../src/composables/metadataCachePolicy.ts'

test('keeps expensive per-cwd metadata warm across normal operator pause windows', () => {
  assert.ok(SKILLS_CACHE_TTL_MS >= 30 * 60_000)
  assert.ok(PROJECT_ROOT_SUGGESTION_CACHE_TTL_MS >= 30 * 60_000)
  assert.ok(THREAD_TITLE_CACHE_TTL_MS >= 30 * 60_000)
})

test('keeps branch and local-path probes warm long enough to avoid repeated thread-switch lag', () => {
  assert.ok(THREAD_BRANCH_CACHE_TTL_MS >= 5 * 60_000)
  assert.ok(LOCAL_PATH_PROBE_TTL_MS >= 5 * 60_000)
})
