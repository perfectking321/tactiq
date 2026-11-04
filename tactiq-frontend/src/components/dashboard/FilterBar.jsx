import { Calendar, HeartPulse, RotateCcw, Trophy, X } from 'lucide-react'
import Menu from '../ui/Menu'
import ShuttleIcon from '../ui/ShuttleIcon'
import { ACTIVITIES, DEFAULT_PERIOD, PERIODS, RESULTS, activeFilterCount } from './model'

const PERIOD_LABEL = { 7: '7 days', 30: '30 days', 90: '90 days', all: 'All time' }
const ACTIVITY_LABEL = { all: 'All activity', training: 'Training', match: 'Matches' }
const RESULT_LABEL = { null: 'Any result', Win: 'Wins', Loss: 'Losses' }

/**
 * Slim filter row under the page title: Period / Activity / Result dropdowns, Recovery-days switch,
 * optional date chip (from clicking the chart) and Reset. Non-default values are tinted indigo.
 */
export default function FilterBar({ period, onPeriod, filters, onFilters, selection, onClearSelection, onReset }) {
  const set = (patch) => onFilters({ ...filters, ...patch })
  const pristine = activeFilterCount(filters) === 0 && period === DEFAULT_PERIOD && !selection
  return (
    <div className="fb" role="group" aria-label="Filters">
      <Menu icon={Calendar} label={PERIOD_LABEL[period]} active={period !== DEFAULT_PERIOD} value={period} ariaLabel="Period"
        options={PERIODS.map((p) => ({ value: p.value, label: PERIOD_LABEL[p.value] }))} onChange={onPeriod} />
      <Menu icon={ShuttleIcon} label={ACTIVITY_LABEL[filters.activity]} active={filters.activity !== 'all'} value={filters.activity}
        ariaLabel="Activity" options={ACTIVITIES.map((a) => ({ value: a.value, label: ACTIVITY_LABEL[a.value] }))}
        onChange={(activity) => set({ activity })} />
      <Menu icon={Trophy} label={RESULT_LABEL[filters.result]} active={Boolean(filters.result)} value={filters.result}
        ariaLabel="Result" options={RESULTS.map((r) => ({ value: r.value, label: RESULT_LABEL[r.value] }))}
        onChange={(result) => set({ result })} />
      <button type="button" role="switch" aria-checked={filters.lowWellness}
        className={`pill-btn fb-switch${filters.lowWellness ? ' is-active' : ''}`}
        onClick={() => set({ lowWellness: !filters.lowWellness })} title="Only days with a wellness score under 55">
        <HeartPulse size={15} />
        <span>Recovery days</span>
        <span className="fb-track" aria-hidden="true"><span className="fb-knob" /></span>
      </button>
      {selection && (
        <button type="button" className="pill-btn is-active" onClick={onClearSelection} title="Clear date (Esc)">
          <Calendar size={15} />
          <span>{selection.label}</span>
          <X size={13} aria-hidden="true" />
          <span className="visually-hidden">Clear date selection</span>
        </button>
      )}
      <button type="button" className="btn btn-ghost btn-sm fb-reset" onClick={onReset} disabled={pristine}
        aria-label="Reset period, filters and date" title="Reset period, filters and date">
        <RotateCcw size={14} />
        <span>Reset</span>
      </button>
    </div>
  )
}
