export const MAX_COMMAND_EXECUTION_AGGREGATED_OUTPUT_CHARS = 32_000

const OUTPUT_BUDGET_MARKER_OVERHEAD = 256

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function truncateAggregatedOutput(value: string): string {
  if (value.length <= MAX_COMMAND_EXECUTION_AGGREGATED_OUTPUT_CHARS) {
    return value
  }

  const budget = Math.max(MAX_COMMAND_EXECUTION_AGGREGATED_OUTPUT_CHARS - OUTPUT_BUDGET_MARKER_OVERHEAD, 1_024)
  const headLength = Math.floor(budget / 2)
  const tailLength = Math.max(budget - headLength, 256)
  const omittedChars = Math.max(value.length - headLength - tailLength, 0)
  const head = value.slice(0, headLength)
  const tail = value.slice(-tailLength)
  return `${head}\n\n[truncated ${omittedChars} chars of command output]\n\n${tail}`
}

export function sanitizeCommandExecutionOutputs(value: unknown): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((entry) => {
      const nested = sanitizeCommandExecutionOutputs(entry)
      if (nested.changed) changed = true
      return nested.value
    })
    return changed ? { value: next, changed: true } : { value, changed: false }
  }

  const record = asRecord(value)
  if (!record) {
    return { value, changed: false }
  }

  let changed = false
  const nextRecord: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(record)) {
    const nested = sanitizeCommandExecutionOutputs(nestedValue)
    if (nested.changed) changed = true
    nextRecord[key] = nested.value
  }

  if (record.type === 'commandExecution' && typeof nextRecord.aggregatedOutput === 'string') {
    const truncated = truncateAggregatedOutput(nextRecord.aggregatedOutput)
    if (truncated !== nextRecord.aggregatedOutput) {
      nextRecord.aggregatedOutput = truncated
      changed = true
    }
  }

  return changed ? { value: nextRecord, changed: true } : { value, changed: false }
}
