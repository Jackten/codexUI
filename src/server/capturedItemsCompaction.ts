export type CapturedItem = {
  id: string
  type: string
  turnId: string
  data: Record<string, unknown>
  completed: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export type CapturedItemCompactionStats = {
  capturedItemCount: number
  prunedCount: number
  remainingCount: number
  mapDeleted: boolean
}

export function mergeCapturedItemsIntoTurns(params: {
  turns: unknown[]
  capturedItemsById: Map<string, CapturedItem>
}): {
  turns: unknown[]
  nextCapturedItemsById: Map<string, CapturedItem>
  stats: CapturedItemCompactionStats
} {
  const { turns, capturedItemsById } = params
  if (capturedItemsById.size === 0) {
    return {
      turns,
      nextCapturedItemsById: new Map(),
      stats: {
        capturedItemCount: 0,
        prunedCount: 0,
        remainingCount: 0,
        mapDeleted: true,
      },
    }
  }

  const capturedItemCount = capturedItemsById.size
  const remainingCapturedItemsById = new Map(capturedItemsById)
  const itemsByTurnId = new Map<string, CapturedItem[]>()
  for (const captured of capturedItemsById.values()) {
    let group = itemsByTurnId.get(captured.turnId)
    if (!group) {
      group = []
      itemsByTurnId.set(captured.turnId, group)
    }
    group.push(captured)
  }

  const mergedTurns = turns.map((turn) => {
    const turnRecord = asRecord(turn)
    if (!turnRecord) return turn
    const turnId = typeof turnRecord.id === 'string' ? turnRecord.id : ''
    if (!turnId) return turn

    const captured = itemsByTurnId.get(turnId)
    if (!captured || captured.length === 0) return turn

    const existingItems = Array.isArray(turnRecord.items) ? (turnRecord.items as Record<string, unknown>[]) : []
    const existingIds = new Set(existingItems.map((item) => (typeof item.id === 'string' ? item.id : '')).filter(Boolean))

    for (const item of captured) {
      if (existingIds.has(item.id)) {
        remainingCapturedItemsById.delete(item.id)
      }
    }

    const newItems = captured
      .filter((item) => !existingIds.has(item.id))
      .map((item) => item.data)

    if (newItems.length === 0) return turn

    return {
      ...turnRecord,
      items: [...existingItems, ...newItems],
    }
  })

  return {
    turns: mergedTurns,
    nextCapturedItemsById: remainingCapturedItemsById,
    stats: {
      capturedItemCount,
      prunedCount: capturedItemCount - remainingCapturedItemsById.size,
      remainingCount: remainingCapturedItemsById.size,
      mapDeleted: remainingCapturedItemsById.size === 0,
    },
  }
}
