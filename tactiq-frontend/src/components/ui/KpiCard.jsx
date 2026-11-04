import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card } from './Card'
import { Delta, IconBadge } from './Badge'
import CountUp from './CountUp'
import Sparkline from './Sparkline'

const TONE_COLOR = {
  primary: '#6d5dfc', success: '#12b76a', danger: '#f04438', warning: '#f79009', info: '#2e90fa', neutral: '#98a2b3',
}

/**
 * The one KPI card used across the app.
 *  label, icon, tone       header (13px muted label + 36px tinted icon badge)
 *  value (number | null), decimals, unit | valueNode   the big number (counts up) or a custom node
 *  delta {value, unit, positiveIsGood}                  badge next to the value (omit/null to hide)
 *  context, vs                                          12px muted line (the optional `vs` tail hides when the card is narrow)
 *  spark number[]  | progress {value, max}              footer: sparkline or progress bar
 *  onClick + active                                     card acts as a filter toggle (cross-filter)
 *  to                                                   drill link shown as "View ->" on hover/focus
 *  children                                             interactive extras placed above the hit area
 */
export default function KpiCard({
  label, icon, tone = 'primary', value, decimals = 0, unit, valueNode, delta, context, vs, spark, progress,
  onClick, active = false, hint, to, children, className = '', footer = true,
}) {
  const color = TONE_COLOR[tone] ?? TONE_COLOR.primary
  const showSpark = spark && spark.filter((v) => typeof v === 'number').length >= 2
  return (
    <Card className={`kpi${onClick ? ' is-click' : ''}${active ? ' is-active' : ''} ${className}`.trim()}>
      {onClick && (
        <button type="button" className="kpi-hit" onClick={onClick} aria-pressed={active} title={hint}>
          <span className="visually-hidden">{hint ?? label}</span>
        </button>
      )}
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-top-r">
          {to && (
            <Link to={to} className="kpi-view" aria-label={`Open ${label}`}>
              View <ArrowRight size={12} />
            </Link>
          )}
          {icon && <IconBadge icon={icon} tone={tone} />}
        </span>
      </div>
      <div className="kpi-row">
        <span className="kpi-value">
          {valueNode ?? (value === null || value === undefined ? '–' : <CountUp value={value} decimals={decimals} />)}
          {unit && value !== null && value !== undefined && <span className="kpi-unit">{unit}</span>}
        </span>
        <Delta delta={delta} />
      </div>
      {context && <p className="kpi-ctx">{context}{vs && <span className="kpi-vs"> · {vs}</span>}</p>}
      {children}
      {footer && progress && (
        <div className="kpi-foot kpi-foot--bar">
          <div className="kpi-progress" role="progressbar" aria-valuenow={Math.round(progress.value)} aria-valuemin={0}
            aria-valuemax={progress.max} aria-label={`${label} progress`}>
            <span style={{ width: `${Math.max(0, Math.min(100, (progress.value / progress.max) * 100))}%` }} />
          </div>
        </div>
      )}
      {footer && !progress && showSpark && (
        <div className="kpi-foot" aria-hidden="true"><Sparkline data={spark} color={color} /></div>
      )}
    </Card>
  )
}
