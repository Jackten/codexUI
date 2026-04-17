export function shouldProbeResolvedLocalPath(pathValue: string): boolean {
  const normalized = pathValue.trim()
  if (!normalized) return false

  const withoutRoot = normalized
    .replace(/^[A-Za-z]:\//u, '')
    .replace(/^\/+/, '')

  const segments = withoutRoot.split(/[\\/]+/u).filter(Boolean)
  if (segments.length === 0) return false

  return segments.every((segment) => {
    if (!segment) return false
    if (/\s{2,}/u.test(segment)) return false

    const words = segment.trim().split(/\s+/u).filter(Boolean)
    if (words.length > 4 && segment.length > 24) return false
    return true
  })
}
