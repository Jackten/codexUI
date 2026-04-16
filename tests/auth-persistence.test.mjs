import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'

const CLI_PATH = new URL('../dist-cli/index.js', import.meta.url)
const PASSWORD = 'test-pass-123'
const HOST_HEADER = 'example.tailnet.ts.net:3443'

function httpCall(port, path, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          Host: HOST_HEADER,
          ...headers,
        },
      },
      (res) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: data,
          })
        })
      },
    )
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function waitForServer(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await httpCall(port, '/')
      if (res.statusCode > 0) return
    } catch {
      await delay(150)
    }
  }
  throw new Error(`Server on port ${port} did not become ready in time`)
}

async function startServer(port) {
  const child = spawn(
    'node',
    [CLI_PATH.pathname, '--port', String(port), '--password', PASSWORD, '--no-open', '--no-tunnel', '--no-login'],
    {
      cwd: new URL('..', import.meta.url).pathname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    },
  )

  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    output += chunk.toString()
  })

  await waitForServer(port)
  return {
    child,
    getOutput: () => output,
  }
}

async function stopServer(child) {
  if (!child || child.killed) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(5000).then(() => {
      child.kill('SIGKILL')
    }),
  ])
}

async function login(port) {
  const response = await httpCall(port, '/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: PASSWORD }),
  })
  assert.equal(response.statusCode, 200, response.body)
  const cookie = response.headers['set-cookie']?.[0]
  assert.ok(cookie, 'expected Set-Cookie header from login response')
  return cookie
}

async function fetchAuthedRoot(port, cookie) {
  const response = await httpCall(port, '/', {
    headers: {
      Cookie: cookie.split(';', 1)[0],
    },
  })
  return response.body
}

test('auth cookie is persistent and survives server restart', async () => {
  const port = 19611
  const first = await startServer(port)
  try {
    const cookie = await login(port)
    assert.match(cookie, /Max-Age=/, 'expected persistent auth cookie with Max-Age')

    const beforeRestart = await fetchAuthedRoot(port, cookie)
    assert.match(beforeRestart, /<!doctype html>/i, 'expected authenticated app shell before restart')

    await stopServer(first.child)
    const second = await startServer(port)
    try {
      const afterRestart = await fetchAuthedRoot(port, cookie)
      assert.match(afterRestart, /<!doctype html>/i, 'expected authenticated app shell after restart')
      assert.doesNotMatch(afterRestart, /<form id="f">/, 'should not fall back to login form after restart')
    } finally {
      await stopServer(second.child)
    }
  } finally {
    await stopServer(first.child)
  }
})
