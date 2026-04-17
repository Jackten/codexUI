import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldProbeResolvedLocalPath } from '../src/components/content/localPathProbeHeuristics.ts'

test('allows ordinary absolute local paths including moderate spaces in path segments', () => {
  assert.equal(shouldProbeResolvedLocalPath('/root/.codex/skills/oracle/SKILL.md'), true)
  assert.equal(shouldProbeResolvedLocalPath('/root/Legend School/Legend Daily Reflections'), true)
  assert.equal(shouldProbeResolvedLocalPath('/root/My File.txt'), true)
})

test('rejects sentence-like false positives that start with /root but are really streaming prose', () => {
  assert.equal(shouldProbeResolvedLocalPath('/root/This is the current live Puerto Rico family-court filing package in a contested divorce/custody matter'), false)
  assert.equal(shouldProbeResolvedLocalPath('/root/Yes. We should do exact before/after'), false)
})
