import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import {
  cleanupTemporaryCodexHome,
  removeDirectoryWithRetries,
  waitForChildProcessExit,
} from '../src/server/temporaryCodexHomeCleanup.ts'

test('waitForChildProcessExit resolves true after the process emits exit', async () => {
  const proc = new EventEmitter()
  const resultPromise = waitForChildProcessExit(proc, {
    timeoutMs: 25,
  })
  proc.emit('exit', 0, null)
  assert.equal(await resultPromise, true)
})

test('removeDirectoryWithRetries retries ENOTEMPTY and eventually succeeds', async () => {
  let attempts = 0
  await removeDirectoryWithRetries('/tmp/codexui-account-test', {
    maxAttempts: 3,
    delayMs: 0,
    rmImpl: async () => {
      attempts += 1
      if (attempts < 2) {
        const error = new Error('directory not empty')
        error.code = 'ENOTEMPTY'
        throw error
      }
    },
  })
  assert.equal(attempts, 2)
})

test('cleanupTemporaryCodexHome waits for process exit before removing the temp directory', async () => {
  const events = []
  class FakeProc extends EventEmitter {
    constructor() {
      super()
      this.stdin = {
        end: () => {
          events.push('stdin.end')
        },
      }
    }

    kill(signal) {
      events.push(`kill:${signal}`)
      if (signal === 'SIGTERM') {
        queueMicrotask(() => {
          this.emit('exit', 0, null)
        })
      }
      return true
    }
  }

  const proc = new FakeProc()
  await cleanupTemporaryCodexHome(proc, '/tmp/codexui-account-test', {
    exitTimeoutMs: 25,
    rmImpl: async () => {
      events.push('rm')
    },
  })

  assert.deepEqual(events, ['stdin.end', 'kill:SIGTERM', 'rm'])
})
