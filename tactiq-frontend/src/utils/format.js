import { addDays, fromIso } from './date'

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '')
export const SHORTCUT = isMac ? '⌘K' : 'Ctrl K'

/** "Today" / "Yesterday" / "2 Nov" */
export function relDate(iso, today) {
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  return fromIso(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Link to the edit form of a session / match row ({ kind, id }). */
export const editLink = (e) => `/activity/new?type=${e.kind === 'match' ? 'match' : 'session'}&id=${e.id}`

/** Delta number as shown in the badge: 8.4 -> "8.4%", 12.3 -> "12%". */
export function formatDelta(d) {
  const abs = Math.abs(d.value)
  const n = abs >= 10 ? Math.round(abs) : Math.round(abs * 10) / 10
  return `${n}${d.unit ?? ''}`
}
