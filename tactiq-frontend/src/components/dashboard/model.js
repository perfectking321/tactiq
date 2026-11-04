/**
 * Dashboard data model - pure functions, Power BI style.
 *
 * Every visual is computed from the same raw logs + three pieces of state:
 *   period    - slicer: 7 | 30 | 90 | 'all' days ending today (period dropdown)
 *   filters   - the three pill rows: { activity: 'all'|'training'|'match', result: null|'Win'|'Loss', lowWellness }
 *               The Matches / Training tiles, the W / L numbers and the wellness ring all drive these,
 *               so every click is visible in a filter row.
 *   selection - optional date chip in the filter bar: { kind: 'date', key, dates:Set<iso>, label }
 *               set by clicking a day on the main chart (Ctrl+click adds days). Esc clears it.
 * Filters and selection are ANDed:
 *   effective dates D = period range ∩ selection.dates ∩ filterDates(filters)
 */

import { addDays, fromIso } from '../../utils/date'

export const WEEKLY_TARGET_MIN = { Beginner: 150, Intermediate: 240, Advanced: 360 }
export const PERIODS = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
  { value: 'all', label: 'All' },
]
export const DEFAULT_PERIOD = 30
export const NO_FILTERS = Object.freeze({ activity: 'all', result: null, lowWellness: false })
export const ACTIVITIES = [
  { value: 'all', label: 'All' },
  { value: 'training', label: 'Training' },
  { value: 'match', label: 'Matches' },
]
export const RESULTS = [
  { value: null, label: 'Any' },
  { value: 'Win', label: 'Wins' },
  { value: 'Loss', label: 'Losses' },
]
const LOW_WELLNESS_LABEL = 'Prioritise recovery' // server label for scores under 55
const MAX_DAYS = 120 // main chart: most recent days only

const daysBetween = (a, b) => Math.round((fromIso(b) - fromIso(a)) / 86400000) + 1

export function periodRange(period, today, raw) {
  if (period !== 'all') return { start: addDays(today, -(period - 1)), end: today }
  const all = [...raw.sessions, ...raw.matches, ...raw.checkins].map((r) => r.date)
  const earliest = all.length ? all.reduce((a, b) => (a < b ? a : b)) : today
  return { start: earliest < today ? earliest : today, end: today }
}

export const periodTitle = (period) => (period === 'all' ? 'All time' : `Last ${period} days`)

const inRange = (iso, r) => iso >= r.start && iso <= r.end
const shortLabel = (iso) => fromIso(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// ---------- filters (the pill rows) ----------

export function activeFilterCount(f = NO_FILTERS) {
  return (f.activity !== 'all' ? 1 : 0) + (f.result ? 1 : 0) + (f.lowWellness ? 1 : 0)
}

/** Clicking the active tile / W / L number again clears it. */
export const toggleActivity = (f, activity) => ({ ...f, activity: f.activity === activity ? 'all' : activity })
export const toggleResult = (f, result) => ({ ...f, result: f.result === result ? null : result })
export const toggleLowWellness = (f) => ({ ...f, lowWellness: !f.lowWellness })

/**
 * Dates allowed by the filters (intersection of every active filter), or null when no filter is set.
 * activity 'training' -> days with a session, 'match' -> days with a match;
 * result -> days with a match of that result; lowWellness -> days whose check-in is 'Prioritise recovery'.
 */
export function filterDates(raw, f = NO_FILTERS) {
  const sets = []
  if (f.activity === 'training') sets.push(new Set(raw.sessions.map((s) => s.date)))
  if (f.activity === 'match') sets.push(new Set(raw.matches.map((m) => m.date)))
  if (f.result) sets.push(new Set(raw.matches.filter((m) => m.result === f.result).map((m) => m.date)))
  if (f.lowWellness) sets.push(new Set(raw.checkins.filter((c) => c.label === LOW_WELLNESS_LABEL).map((c) => c.date)))
  if (!sets.length) return null
  const [first, ...rest] = sets
  return new Set([...first].filter((d) => rest.every((s) => s.has(d))))
}

// ---------- date chip (selection) ----------

/** Click a day: select it (again = clear). additive (Ctrl/Cmd) adds/removes days from a day selection. */
export function selectDate(current, iso, additive) {
  if (additive && current) {
    const dates = new Set(current.dates)
    if (dates.has(iso)) dates.delete(iso)
    else dates.add(iso)
    if (!dates.size) return null
    return { kind: 'date', key: [...dates].sort().join(','), dates, label: dateSelectionLabel(dates) }
  }
  if (current?.key === iso) return null
  return { kind: 'date', key: iso, dates: new Set([iso]), label: shortLabel(iso) }
}

function dateSelectionLabel(dates) {
  const sorted = [...dates].sort()
  return sorted.length === 1 ? shortLabel(sorted[0]) : `${sorted.length} days`
}

// ---------- derived values for every visual ----------

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const round1 = (x) => (x === null ? null : Math.round(x * 10) / 10)

// ---------- period-over-period deltas ----------

/** The equal-length period right before `range` (null for "all time": there is nothing before it). */
export function previousRange(range, period) {
  if (period === 'all') return null
  const len = daysBetween(range.start, range.end)
  return { start: addDays(range.start, -len), end: addDays(range.start, -1) }
}

/**
 * Delta of cur vs prev: mode 'abs' (cur - prev), 'pct' (relative change %), 'pp' (percentage points).
 * Returns null when either side has no data (or prev is 0 in 'pct' mode). value 0 = no change.
 * Result: { value, unit, positiveIsGood }.
 */
export function makeDelta(cur, prev, { mode = 'abs', unit = '', positiveIsGood = true, digits = 1 } = {}) {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return null
  if (Number.isNaN(cur) || Number.isNaN(prev)) return null
  let v
  if (mode === 'pct') {
    if (prev === 0) return null
    v = ((cur - prev) / Math.abs(prev)) * 100
    unit = unit || '%'
  } else {
    v = cur - prev
    if (mode === 'pp') unit = unit || '%'
  }
  const f = 10 ** digits
  v = Math.round(v * f) / f
  return { value: v === 0 ? 0 : v, unit, positiveIsGood }
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0)

/** Plain stats of one date range; passes(iso) = filter rows (no date chip). */
export function periodStats(raw, r, passes = () => true) {
  const sessions = raw.sessions.filter((s) => inRange(s.date, r) && passes(s.date))
  const checkins = raw.checkins.filter((c) => inRange(c.date, r) && passes(c.date))
  const matches = raw.matches.filter((m) => inRange(m.date, r) && passes(m.date))
  const wins = matches.filter((m) => m.result === 'Win').length
  return {
    sessions: sessions.length,
    minutes: sum(sessions.map((s) => s.duration_min)),
    checkins: checkins.length,
    wellness: checkins.length ? Math.round(avg(checkins.map((c) => c.score))) : null,
    sleep: checkins.length ? round1(avg(checkins.map((c) => c.sleep_hours))) : null,
    matches: matches.length,
    winRate: matches.length ? Math.round((wins / matches.length) * 100) : null,
  }
}

export function derive(raw, period, selection, level, today, filters = NO_FILTERS) {
  const range = periodRange(period, today, raw)
  const fD = filterDates(raw, filters)
  const passesFilters = (iso) => !fD || fD.has(iso)
  const passes = (iso) => (!selection || selection.dates.has(iso)) && passesFilters(iso)
  const inD = (iso) => inRange(iso, range) && passes(iso)
  const filtered = Boolean(selection || fD)

  const sessions = raw.sessions.filter((s) => inD(s.date))
  const checkins = raw.checkins.filter((c) => inD(c.date))

  // W / L pool = everything passing except the result filter itself, so both numbers stay visible
  // and the non-chosen one is faded (highlight, not hide).
  const fNoResult = filterDates(raw, { ...filters, result: null })
  const pool = raw.matches.filter(
    (m) => inRange(m.date, range) && (!selection || selection.dates.has(m.date)) && (!fNoResult || fNoResult.has(m.date)),
  )
  const wins = pool.filter((m) => m.result === 'Win').length
  const losses = pool.filter((m) => m.result === 'Loss').length

  // Window = the effective days: every in-range day when unfiltered, else the in-range days that pass.
  let windowDays
  if (filtered) {
    const candidates = selection ? selection.dates : fD
    windowDays = [...candidates].filter((d) => inD(d)).length
  } else {
    windowDays = daysBetween(range.start, range.end)
  }
  const minutes = sessions.reduce((a, s) => a + s.duration_min, 0)
  const weekly = WEEKLY_TARGET_MIN[level] ?? 150
  const target = Math.round((weekly * windowDays) / 7)

  const trend = raw.checkins
    .filter((c) => inRange(c.date, range))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((c) => ({ ...c, label: shortLabel(c.date), inSelection: passes(c.date) }))

  const selectedDates = selection ? [...selection.dates].filter((d) => inD(d)).sort() : []
  const singleNight = selectedDates.length === 1 ? raw.checkins.find((c) => c.date === selectedDates[0]) : null

  // ----- main chart: one row per day of the range (most recent MAX_DAYS) -----
  const ckByDate = new Map(raw.checkins.map((c) => [c.date, c]))
  const minByDate = new Map()
  for (const s of raw.sessions) {
    if (passesFilters(s.date)) minByDate.set(s.date, (minByDate.get(s.date) ?? 0) + s.duration_min)
  }
  const days = []
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
    const c = ckByDate.get(d)
    days.push({
      date: d,
      label: shortLabel(d),
      score: c ? c.score : null,
      energy: c ? c.energy : null,
      soreness: c ? c.soreness : null,
      stress: c ? c.stress : null,
      sleep_hours: c ? c.sleep_hours : null,
      minutes: minByDate.get(d) ?? 0,
      inSelection: passes(d),
    })
  }
  const chart = days.slice(-MAX_DAYS)

  // ----- KPIs + deltas vs the previous equal-length period -----
  const kpis = {
    matches: pool.length,
    wins,
    losses,
    winRate: pool.length ? Math.round((wins / pool.length) * 100) : null,
    sessions: sessions.length,
    wellness: checkins.length ? Math.round(avg(checkins.map((c) => c.score))) : null,
    checkins: checkins.length,
  }
  const sleep = singleNight
    ? { hours: singleNight.sleep_hours, nights: 1, date: singleNight.date }
    : { hours: round1(avg(checkins.map((c) => c.sleep_hours))), nights: checkins.length, date: null }

  const prevR = selection ? null : previousRange(range, period)
  const prev = prevR ? periodStats(raw, prevR, passesFilters) : null
  const prevPool = prevR ? periodStats(raw, prevR, (d) => !fNoResult || fNoResult.has(d)) : null
  const deltas = {
    wellness: prev ? makeDelta(kpis.wellness, prev.wellness, { mode: 'abs', digits: 0 }) : null,
    sleep: prev && !singleNight ? makeDelta(sleep.hours, prev.sleep, { mode: 'abs', unit: ' h' }) : null,
    winRate: prevPool ? makeDelta(kpis.winRate, prevPool.winRate, { mode: 'pp', digits: 0 }) : null,
    training: prev ? makeDelta(minutes, prev.minutes, { mode: 'pct', digits: 0 }) : null,
  }

  // ----- sparklines -----
  const sparkRows = trend.filter((r) => r.inSelection)
  let net = 0
  const matchSpark = [...pool].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id)).map((m) => {
    net += m.result === 'Win' ? 1 : -1
    return net
  })
  const spark = {
    wellness: sparkRows.map((r) => r.score),
    sleep: sparkRows.map((r) => r.sleep_hours),
    matches: matchSpark,
  }

  // ----- recent activity (sessions + matches, newest first) that respects every filter -----
  const recent = [
    ...(filters.activity !== 'match' && !filters.result ? sessions.map((s) => ({ ...s, kind: 'session' })) : []),
    ...(filters.activity !== 'training'
      ? raw.matches.filter((m) => inD(m.date) && (!filters.result || m.result === filters.result)).map((m) => ({ ...m, kind: 'match' }))
      : []),
  ]
    .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
    .slice(0, 5)

  return {
    range,
    inD,
    filtered,
    empty: filtered && windowDays === 0,
    kpis,
    deltas,
    spark,
    sleep,
    goal: {
      minutes,
      target,
      hours: round1(minutes / 60),
      targetHours: round1(target / 60),
      pct: target ? Math.round((minutes / target) * 100) : 0,
      windowDays,
    },
    trend,
    chart,
    recent,
    selectedDates,
  }
}
