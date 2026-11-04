import { useState } from 'react'
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card, CardHeader } from '../ui/Card'
import Segmented from '../ui/Segmented'

// Hex only: recharts writes these into SVG presentation attributes, where CSS variables do not resolve.
const C = { line: '#6d5dfc', bar: '#cfc8ff', barStrong: '#6d5dfc', barFade: '#ebe8ff', grid: '#e4e6ee', tick: '#98a2b3' }

/** Off-by-default extra lines (0-10 scales), toggled by the legend chips in the card header. */
const EXTRAS = [
  { key: 'energy', label: 'Energy', color: '#12b76a' },
  { key: 'soreness', label: 'Soreness', color: '#f79009' },
  { key: 'stress', label: 'Stress', color: '#f472b6' },
  { key: 'sleep_hours', label: 'Sleep', color: '#2e90fa' },
]

const MODES = [
  { value: 'wellness', label: 'Wellness' },
  { value: 'load', label: 'Load' },
]

function TipBox({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const lines = payload.filter((p) => p.value !== null && p.value !== undefined && p.dataKey !== 'minutes')
  return (
    <div className="chart-tip">
      <strong>{row.label}</strong>
      {lines.map((p) => (
        <span key={p.dataKey}><i style={{ background: p.color || p.stroke }} />{p.name} <b>{p.value}</b></span>
      ))}
      <span><i style={{ background: C.bar }} />Training <b>{row.minutes} min</b></span>
      <em>Click to filter this day</em>
    </div>
  )
}

/** Evenly spaced x ticks (first and last included), max ~7. */
function ticksFor(rows) {
  if (rows.length <= 7) return rows.map((r) => r.label)
  const n = 6
  return Array.from({ length: n }, (_, i) => rows[Math.round((i * (rows.length - 1)) / (n - 1))].label)
}

/**
 * Main chart: daily wellness (indigo gradient area, left axis 0-100) + daily training minutes (violet bars, right axis).
 * Clicking a day sets the date chip (Ctrl/Cmd+click adds days).
 */
export default function WellnessLoadChart({ rows, selectedDates, onSelect, subtitle, empty: noDays, onReset }) {
  const [mode, setMode] = useState('wellness')
  const [shown, setShown] = useState(() => new Set())
  const toggle = (key) =>
    setShown((h) => {
      const next = new Set(h)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const handleClick = (state, event) => {
    const i = state?.activeTooltipIndex
    if (i == null || !rows[Number(i)]) return
    onSelect(rows[Number(i)].date, Boolean(event?.ctrlKey || event?.metaKey))
  }

  const sel = new Set(selectedDates)
  const hasSel = sel.size > 0
  const scores = rows.filter((r) => r.score !== null).length
  const totalMin = rows.reduce((a, r) => a + r.minutes, 0)
  const empty = scores < 2 && totalMin === 0
  const maxMin = Math.max(60, ...rows.map((r) => r.minutes))
  const wellness = mode === 'wellness'

  const dot = (props) => {
    const { payload, index, cx, cy } = props
    if (payload.score !== null && sel.has(payload.date)) {
      return <circle key={index} cx={cx} cy={cy} r={4.5} fill="#fff" stroke={C.line} strokeWidth={2.5} />
    }
    return <g key={index} />
  }

  const action = (
    <>
      {wellness && (
        <ul className="chart-legend" aria-label="Extra lines">
          {EXTRAS.map((s) => (
            <li key={s.key}>
              <button type="button" className={`pill-btn legend-chip${shown.has(s.key) ? ' is-active' : ''}`}
                aria-pressed={shown.has(s.key)} onClick={() => toggle(s.key)} style={{ '--c': s.color }}>
                <i aria-hidden="true" />{s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Segmented label="Chart view" options={MODES} value={mode} onChange={setMode} />
    </>
  )

  return (
    <Card className="db-chart-card">
      <CardHeader title="Wellness & training load" subtitle={subtitle} action={action} />
      {noDays ? (
        <div className="empty-state">
          <p>No days match these filters</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>Clear filters</button>
        </div>
      ) : empty ? (
        <p className="empty-state">Log at least two daily check-ins in this period to see your wellness trend.</p>
      ) : (
        <div className="db-chart is-clickable">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ComposedChart data={rows} margin={{ top: 6, right: 0, bottom: 0, left: -12 }} onClick={handleClick}>
              <defs>
                <linearGradient id="wl-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.line} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={C.line} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="4 4" />
              <XAxis dataKey="label" stroke={C.tick} tickLine={false} axisLine={false} ticks={ticksFor(rows)} interval={0}
                tickMargin={8} fontSize={11} padding={{ left: 10, right: 10 }} />
              <YAxis yAxisId="w" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} stroke={C.tick} tickLine={false} axisLine={false}
                fontSize={11} width={44} hide={!wellness} />
              <YAxis yAxisId="m" orientation="right" domain={[0, wellness ? Math.ceil(maxMin * 2.4) : Math.ceil(maxMin / 30) * 30]} stroke={C.tick} tickLine={false}
                axisLine={false} fontSize={11} width={44} tickCount={5} tickFormatter={(v) => (v ? `${v}m` : '0')}
                hide={wellness} />
              <YAxis yAxisId="x" hide domain={[0, 10]} />
              <Tooltip content={<TipBox />} cursor={{ stroke: C.line, strokeOpacity: 0.2, strokeWidth: 1 }} />
              <Bar yAxisId="m" dataKey="minutes" name="Training" radius={[4, 4, 0, 0]} maxBarSize={wellness ? 14 : 26}
                isAnimationActive={false}>
                {rows.map((r) => (
                  <Cell key={r.date} fill={wellness
                    ? (hasSel && sel.has(r.date) ? C.barStrong : hasSel ? C.barFade : C.bar)
                    : (hasSel && !sel.has(r.date) ? C.barFade : C.barStrong)} />
                ))}
              </Bar>
              {wellness && EXTRAS.filter((s) => shown.has(s.key)).map((s) => (
                <Line key={s.key} yAxisId="x" type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2}
                  dot={false} activeDot={false} connectNulls isAnimationActive={false} />
              ))}
              {wellness && (
                <Area yAxisId="w" type="monotone" dataKey="score" name="Wellness" stroke={C.line} strokeWidth={2.5}
                  fill="url(#wl-fill)" fillOpacity={hasSel ? 0.6 : 1} connectNulls dot={dot}
                  activeDot={{ r: 5, fill: C.line, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
