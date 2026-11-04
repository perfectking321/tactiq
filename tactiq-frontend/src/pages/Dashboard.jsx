import { useCallback, useEffect, useMemo, useState } from 'react'
import { HeartPulse, Moon, Timer, Trophy } from 'lucide-react'
import { api } from '../api/client'
import FilterBar from '../components/dashboard/FilterBar'
import {
  DEFAULT_PERIOD, NO_FILTERS, derive, selectDate, toggleActivity, toggleLowWellness, toggleResult,
} from '../components/dashboard/model'
import PainCard from '../components/dashboard/PainCard'
import RecentActivity from '../components/dashboard/RecentActivity'
import WellnessLoadChart from '../components/dashboard/WellnessLoadChart'
import CountUp from '../components/ui/CountUp'
import { PageSkeleton } from '../components/ui/controls'
import KpiCard from '../components/ui/KpiCard'
import { localToday } from '../utils/date'
import '../dashboard.css'

const PERIOD_SHORT = { 7: '7d', 30: '30d', 90: '90d' }

/** The W and L numbers of the Matches card: each toggles the Match result filter. */
function ResultNum({ result, n, active, onResult }) {
  const word = result === 'Win' ? 'wins' : 'losses'
  return (
    <button type="button" className={`db-wl${active && active !== result ? ' is-faded' : ''}${active === result ? ' is-on' : ''}`}
      aria-pressed={active === result} onClick={() => onResult(result)}
      title={active === result ? 'Click to clear' : `Show only ${word}`}>
      <CountUp value={n} />
      <span className="visually-hidden"> {word}</span>
    </button>
  )
}

export default function Dashboard() {
  const [raw, setRaw] = useState(null)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState(DEFAULT_PERIOD)
  const [filters, setFilters] = useState(NO_FILTERS)
  const [selection, setSelection] = useState(null)
  const today = localToday()

  useEffect(() => {
    Promise.all([api('/training'), api('/matches'), api('/checkins'), api('/profile')])
      .then(([sessions, matches, checkins, profile]) => setRaw({ sessions, matches, checkins, profile }))
      .catch((e) => setError(e.message))
  }, [])

  // Esc clears the date chip (the filter chips stay - they are persistent slicers).
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !e.defaultPrevented && setSelection(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const level = raw?.profile?.playing_level ?? 'Beginner'
  const view = useMemo(
    () => (raw ? derive(raw, period, selection, level, today, filters) : null),
    [raw, period, selection, level, today, filters],
  )

  const onDate = useCallback((iso, additive) => setSelection((s) => selectDate(s, iso, additive)), [])
  const onResult = useCallback((r) => setFilters((f) => toggleResult(f, r)), [])
  const onPeriod = useCallback((p) => {
    setPeriod(p)
    setSelection(null) // a date chip from another period would silently empty the page
  }, [])
  const onReset = useCallback(() => {
    setPeriod(DEFAULT_PERIOD)
    setFilters(NO_FILTERS)
    setSelection(null)
  }, [])

  if (error) return <p className="error-note" role="alert">{error}</p>
  if (!view) return <div className="pg"><PageSkeleton rows={4} /></div>

  const k = view.kpis
  const d = view.deltas
  const vs = PERIOD_SHORT[period] ? `vs prev ${PERIOD_SHORT[period]}` : ''
  const vsFor = (delta) => (delta ? vs : undefined)
  const periodSub = period === 'all' ? 'All time' : `Last ${period} days`

  return (
    <div className="db">
      <div className="db-filters">
        <FilterBar period={period} onPeriod={onPeriod} filters={filters} onFilters={setFilters} selection={selection}
          onClearSelection={() => setSelection(null)} onReset={onReset} />
      </div>

      <div className="db-kpis">
        <KpiCard label="Wellness" icon={HeartPulse} tone="primary" value={k.wellness} unit={k.wellness !== null ? '/ 100' : undefined}
          delta={d.wellness} context={k.checkins ? `avg of ${k.checkins} check-ins` : 'no check-ins'} vs={vsFor(d.wellness)}
          spark={view.spark.wellness} active={filters.lowWellness} onClick={() => setFilters(toggleLowWellness)}
          hint={filters.lowWellness ? 'Showing low-wellness days - click to clear' : 'Show only low-wellness days'} to="/checkin" />
        <KpiCard label="Matches" icon={Trophy} tone="warning" valueNode={(
          <>
            <ResultNum result="Win" n={k.wins} active={filters.result} onResult={onResult} />
            <span className="db-wl-dash" aria-hidden="true">–</span>
            <ResultNum result="Loss" n={k.losses} active={filters.result} onResult={onResult} />
          </>
        )} delta={d.winRate}
        context={k.winRate !== null ? `${k.winRate}% win rate` : 'no matches'} vs={vsFor(d.winRate)}
        spark={view.spark.matches} active={filters.activity === 'match'} onClick={() => setFilters((f) => toggleActivity(f, 'match'))}
        hint={filters.activity === 'match' ? 'Click to clear this filter' : 'Show only match days'} to="/activity?tab=matches" />
        <KpiCard label="Training" icon={Timer} tone="success" value={view.goal.hours} decimals={1} unit="h" delta={d.training}
          context={view.goal.target ? `${view.goal.pct}% of ${view.goal.targetHours} h goal` : `${k.sessions} sessions`} vs={vsFor(d.training)}
          progress={{ value: view.goal.minutes, max: view.goal.target || 1 }} active={filters.activity === 'training'}
          onClick={() => setFilters((f) => toggleActivity(f, 'training'))}
          hint={filters.activity === 'training' ? 'Click to clear this filter' : 'Show only training days'} to="/activity?tab=training" />
        <KpiCard label={view.sleep.date ? 'Sleep · 1 night' : 'Sleep'} icon={Moon} tone="info" value={view.sleep.hours} decimals={1} unit="h"
          delta={d.sleep} context={view.sleep.nights ? `avg of ${view.sleep.nights} nights` : 'no check-ins'} vs={vsFor(d.sleep)}
          spark={view.spark.sleep} to="/checkin" />
      </div>

      <WellnessLoadChart rows={view.chart} selectedDates={view.selectedDates} onSelect={onDate} subtitle={periodSub}
        empty={view.empty} onReset={onReset} />
      <RecentActivity items={view.recent} today={today} />
      <PainCard profile={raw.profile} />
    </div>
  )
}
