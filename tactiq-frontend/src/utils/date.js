/** Today's date as YYYY-MM-DD in the user's local timezone (not UTC). */
export function localToday() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "2026-10-07" -> "7 Oct" */
export function shortDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const pad2 = (n) => String(n).padStart(2, '0')

/** Date -> "YYYY-MM-DD" (local time). */
export const toIso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** "YYYY-MM-DD" -> local Date at midnight. */
export const fromIso = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Add n days to an ISO date. */
export const addDays = (iso, n) => {
  const d = fromIso(iso)
  d.setDate(d.getDate() + n)
  return toIso(d)
}

/** "2026-10-07" -> "Wednesday" */
export const weekdayName = (iso) => fromIso(iso).toLocaleDateString('en-GB', { weekday: 'long' })
