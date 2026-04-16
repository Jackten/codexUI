import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'

const CLI_PATH = new URL('../dist-cli/index.js', import.meta.url)
const PASSWORD = 'test-pass-123'
const HOST_HEADER = 'example.tailnet.ts.net:3443'

function httpCall(port, path = '/') {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: '127.0.0.1',
        port,
        path,
        headers: { Host: HOST_HEADER },
      },
      (res) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: data }))
      },
    )
    req.on('error', reject)
    req.end()
  })
}

async function waitForServer(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await httpCall(port)
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
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })

  await waitForServer(port)
  await delay(250)
  return { child, getOutput: () => output }
}

async function stopServer(child) {
  if (!child || child.killed) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(5000).then(() => child.kill('SIGKILL')),
  ])
}

test('server binds to loopback and does not advertise public network URLs', async () => {
  const port = 19612
  const server = await startServer(port)
  try {
    const output = server.getOutput()
    assert.match(output, new RegExp(`Bind:\\s+http://127\\.0\\.0\\.1:${port}`), 'expected loopback bind banner')
    assert.doesNotMatch(output, /Network:\s+http:\/\//, 'should not advertise network URLs')
  } finally {
    await stopServer(server.child)
  }
})
