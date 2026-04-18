import test from 'node:test'
import assert from 'node:assert/strict'

import { mergeCapturedItemsIntoTurns } from '../src/server/capturedItemsCompaction.ts'

function capturedItem(id, turnId, type = 'commandExecution', completed = true) {
  return {
    id,
    type,
    turnId,
    data: { id, type },
    completed,
  }
}

test('prunes captured items once they become canonical in later thread reads', () => {
  const initialTurns = [
    {
      id: 'turn-1',
      items: [{ id: 'item-1', type: 'commandExecution' }],
    },
  ]
  const capturedItemsById = new Map([
    ['item-1', capturedItem('item-1', 'turn-1')],
    ['item-2', capturedItem('item-2', 'turn-1', 'fileChange')],
  ])

  const firstPass = mergeCapturedItemsIntoTurns({
    turns: initialTurns,
    capturedItemsById,
  })

  assert.deepEqual(firstPass.turns, [
    {
      id: 'turn-1',
      items: [
        { id: 'item-1', type: 'commandExecution' },
        { id: 'item-2', type: 'fileChange' },
      ],
    },
  ])
  assert.deepEqual(firstPass.stats, {
    capturedItemCount: 2,
    prunedCount: 1,
    remainingCount: 1,
    mapDeleted: false,
  })
  assert.deepEqual([...firstPass.nextCapturedItemsById.keys()], ['item-2'])

  const canonicalTurns = [
    {
      id: 'turn-1',
      items: [
        { id: 'item-1', type: 'commandExecution' },
        { id: 'item-2', type: 'fileChange' },
      ],
    },
  ]

  const secondPass = mergeCapturedItemsIntoTurns({
    turns: canonicalTurns,
    capturedItemsById: firstPass.nextCapturedItemsById,
  })

  assert.deepEqual(secondPass.turns, canonicalTurns)
  assert.deepEqual(secondPass.stats, {
    capturedItemCount: 1,
    prunedCount: 1,
    remainingCount: 0,
    mapDeleted: true,
  })
  assert.equal(secondPass.nextCapturedItemsById.size, 0)
})

test('keeps captured items for turns that are still absent from the canonical snapshot', () => {
  const turns = [
    {
      id: 'turn-1',
      items: [],
    },
  ]
  const capturedItemsById = new Map([
    ['item-2', capturedItem('item-2', 'turn-2', 'fileChange', false)],
  ])

  const result = mergeCapturedItemsIntoTurns({
    turns,
    capturedItemsById,
  })

  assert.deepEqual(result.turns, turns)
  assert.deepEqual(result.stats, {
    capturedItemCount: 1,
    prunedCount: 0,
    remainingCount: 1,
    mapDeleted: false,
  })
  assert.deepEqual([...result.nextCapturedItemsById.keys()], ['item-2'])
})

test('drops absent-turn captured items once that turn arrives in the canonical snapshot', () => {
  const firstPass = mergeCapturedItemsIntoTurns({
    turns: [
      {
        id: 'turn-1',
        items: [],
      },
    ],
    capturedItemsById: new Map([
      ['item-2', capturedItem('item-2', 'turn-2', 'fileChange', false)],
    ]),
  })

  assert.deepEqual([...firstPass.nextCapturedItemsById.keys()], ['item-2'])

  const secondPass = mergeCapturedItemsIntoTurns({
    turns: [
      {
        id: 'turn-1',
        items: [],
      },
      {
        id: 'turn-2',
        items: [{ id: 'item-2', type: 'fileChange' }],
      },
    ],
    capturedItemsById: firstPass.nextCapturedItemsById,
  })

  assert.deepEqual(secondPass.stats, {
    capturedItemCount: 1,
    prunedCount: 1,
    remainingCount: 0,
    mapDeleted: true,
  })
  assert.equal(secondPass.nextCapturedItemsById.size, 0)
})
