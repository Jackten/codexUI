import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { rm } from 'node:fs/promises'

type ChildProcessLike = Pick<ChildProcessWithoutNullStreams, 'kill' | 'once' | 'removeListener' | 'stdin' | 'exitCode' | 'signalCode'>

type WaitForChildProcessExitOptions = {
  timeoutMs?: number
  setTimeoutImpl?: typeof setTimeout
  clearTimeoutImpl?: typeof clearTimeout
}

type RemoveDirectoryWithRetriesOptions = {
  maxAttempts?: number
  delayMs?: number
  rmImpl?: typeof rm
  sleepImpl?: (delayMs: number) => Promise<void>
}

type CleanupTemporaryCodexHomeOptions = {
  exitTimeoutMs?: number
  rmImpl?: typeof rm
  sleepImpl?: (delayMs: number) => Promise<void>
}

const DEFAULT_EXIT_TIMEOUT_MS = 1_500
const DEFAULT_REMOVE_RETRY_DELAY_MS = 75
const DEFAULT_REMOVE_MAX_ATTEMPTS = 4

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

function isRetryableDirectoryRemovalError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : null
  return code === 'ENOTEMPTY' || code === 'EBUSY' || code === 'EPERM'
}

export async function waitForChildProcessExit(
  proc: ChildProcessLike,
  options: WaitForChildProcessExitOptions = {},
): Promise<boolean> {
  if (proc.exitCode !== null || proc.signalCode !== null) {
    return true
  }

  const {
    timeoutMs = DEFAULT_EXIT_TIMEOUT_MS,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = options

  return await new Promise<boolean>((resolve) => {
    let settled = false
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null

    const finish = (didExit: boolean) => {
      if (settled) return
      settled = true
      proc.removeListener('exit', handleExit)
      proc.removeListener('close', handleClose)
      if (timeoutHandle !== null) {
        clearTimeoutImpl(timeoutHandle)
      }
      resolve(didExit)
    }

    const handleExit = () => finish(true)
    const handleClose = () => finish(true)

    proc.once('exit', handleExit)
    proc.once('close', handleClose)
    timeoutHandle = setTimeoutImpl(() => finish(false), timeoutMs)
  })
}

export async function removeDirectoryWithRetries(
  path: string,
  options: RemoveDirectoryWithRetriesOptions = {},
): Promise<void> {
  const {
    maxAttempts = DEFAULT_REMOVE_MAX_ATTEMPTS,
    delayMs = DEFAULT_REMOVE_RETRY_DELAY_MS,
    rmImpl = rm,
    sleepImpl = sleep,
  } = options

  let lastError: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await rmImpl(path, { recursive: true, force: true })
      return
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts || !isRetryableDirectoryRemovalError(error)) {
        throw error
      }
      await sleepImpl(delayMs)
    }
  }

  if (lastError) {
    throw lastError
  }
}

export async function cleanupTemporaryCodexHome(
  proc: ChildProcessLike,
  tempCodexHome: string,
  options: CleanupTemporaryCodexHomeOptions = {},
): Promise<void> {
  const {
    exitTimeoutMs = DEFAULT_EXIT_TIMEOUT_MS,
    rmImpl = rm,
    sleepImpl = sleep,
  } = options

  try {
    proc.stdin.end()
  } catch {
    // ignore
  }

  try {
    proc.kill('SIGTERM')
  } catch {
    // ignore
  }

  const exitedGracefully = await waitForChildProcessExit(proc, { timeoutMs: exitTimeoutMs })
  if (!exitedGracefully) {
    try {
      proc.kill('SIGKILL')
    } catch {
      // ignore
    }
    await waitForChildProcessExit(proc, { timeoutMs: exitTimeoutMs })
  }

  await removeDirectoryWithRetries(tempCodexHome, {
    rmImpl,
    sleepImpl,
  })
}
