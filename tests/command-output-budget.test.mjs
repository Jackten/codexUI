import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_COMMAND_EXECUTION_AGGREGATED_OUTPUT_CHARS,
  sanitizeCommandExecutionOutputs,
} from '../src/server/commandOutputBudget.ts'

test('leaves short command execution aggregated output untouched', () => {
  const item = {
    id: 'cmd-1',
    type: 'commandExecution',
    aggregatedOutput: 'hello world',
  }

  const result = sanitizeCommandExecutionOutputs(item)
  assert.equal(result.changed, false)
  assert.equal(result.value, item)
})

test('truncates oversized command execution aggregated output with a marker', () => {
  const longOutput = 'a'.repeat(MAX_COMMAND_EXECUTION_AGGREGATED_OUTPUT_CHARS * 2)
  const item = {
    id: 'cmd-2',
    type: 'commandExecution',
    aggregatedOutput: longOutput,
  }

  const result = sanitizeCommandExecutionOutputs(item)
  assert.equal(result.changed, true)
  assert.notEqual(result.value, item)
  assert.match(result.value.aggregatedOutput, /truncated/i)
  assert.ok(result.value.aggregatedOutput.length < longOutput.length)
  assert.ok(result.value.aggregatedOutput.length <= MAX_COMMAND_EXECUTION_AGGREGATED_OUTPUT_CHARS + 512)
})

test('recursively truncates command execution aggregated output nested inside turns', () => {
  const longOutput = 'b'.repeat(MAX_COMMAND_EXECUTION_AGGREGATED_OUTPUT_CHARS * 3)
  const payload = {
    thread: {
      turns: [
        {
          id: 'turn-1',
          items: [
            {
              id: 'cmd-3',
              type: 'commandExecution',
              aggregatedOutput: longOutput,
            },
          ],
        },
      ],
    },
  }

  const result = sanitizeCommandExecutionOutputs(payload)
  assert.equal(result.changed, true)
  const nestedOutput = result.value.thread.turns[0].items[0].aggregatedOutput
  assert.match(nestedOutput, /truncated/i)
  assert.ok(nestedOutput.length < longOutput.length)
})
