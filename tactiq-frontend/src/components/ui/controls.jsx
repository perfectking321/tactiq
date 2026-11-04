import { useId } from 'react'
import { Minus, Plus } from 'lucide-react'

/** Single-choice chips (radiogroup). options: strings or { value, label }. */
export function Chips({ label, options, value, onChange, className = '', disabled = false }) {
  return (
    <div className={`ui-chips ${className}`.trim()} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const { value: v, label: text } = typeof o === 'string' ? { value: o, label: o } : o
        const on = value === v
        return (
          <button key={String(v)} type="button" role="radio" aria-checked={on} disabled={disabled}
            className={`ui-chip${on ? ' is-on' : ''}`} onClick={() => onChange(v)}>
            {text}
          </button>
        )
      })}
    </div>
  )
}

/** 1-10 style range slider: indigo fill, round thumb, value on the right. */
export function Slider({ label, value, onChange, min = 1, max = 10, valueText, disabled = false }) {
  const id = useId()
  const pct = ((Number(value) - min) / (max - min)) * 100
  return (
    <div className={`ui-field ui-slider${disabled ? ' is-disabled' : ''}`}>
      <label htmlFor={id} className="ui-label">{label}</label>
      <div className="ui-slider-row">
        <span className="ui-slider-end" aria-hidden="true">{min}</span>
        <input id={id} type="range" min={min} max={max} step="1" value={value} disabled={disabled}
          style={{ '--pct': `${pct}%` }} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="ui-slider-end" aria-hidden="true">{max}</span>
        <output className="ui-slider-val" htmlFor={id}>{valueText ?? value}</output>
      </div>
    </div>
  )
}

/** (-) value unit (+) stepper; the number can also be typed. */
export function Stepper({ label, value, onChange, step = 1, min = 0, max = 100, unit, decimals = 0 }) {
  const id = useId()
  const num = value === '' ? NaN : Number(value)
  const clamp = (n) => Math.min(max, Math.max(min, Math.round(n * 1000) / 1000))
  const bump = (dir) => onChange(clamp((Number.isNaN(num) ? min : num) + dir * step))
  const text = value === '' || value === null ? '' : String(value)
  return (
    <div className="ui-field">
      <label htmlFor={id} className="ui-label">{label}</label>
      <div className="ui-stepper">
        <button type="button" className="ui-step-btn" aria-label={`Decrease ${label}`} onClick={() => bump(-1)}
          disabled={!Number.isNaN(num) && num <= min}>
          <Minus size={16} />
        </button>
        <span className="ui-step-mid">
          <input id={id} type="number" inputMode={decimals ? 'decimal' : 'numeric'} min={min} max={max} step={step}
            value={text} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            onBlur={() => { if (!Number.isNaN(num)) onChange(clamp(num)) }} />
          {unit && <span className="ui-step-unit">{unit}</span>}
        </span>
        <button type="button" className="ui-step-btn" aria-label={`Increase ${label}`} onClick={() => bump(1)}
          disabled={!Number.isNaN(num) && num >= max}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

/** Native date input. */
export function DatePill({ label = 'Date', value, onChange, max }) {
  const id = useId()
  return (
    <div className="ui-field">
      <label htmlFor={id} className="ui-label">{label}</label>
      <input id={id} type="date" className="ui-date" value={value} max={max} required
        onChange={(e) => e.target.value && onChange(e.target.value)} />
    </div>
  )
}

/** Labelled wrapper for text inputs. */
export function TextField({ label, value, onChange, placeholder, maxLength, type = 'text', ...rest }) {
  const id = useId()
  return (
    <div className="ui-field">
      <label htmlFor={id} className="ui-label">{label}</label>
      <input id={id} type={type} className="ui-input" value={value} placeholder={placeholder} maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  )
}

export function TextArea({ label, value, onChange, placeholder, rows = 2 }) {
  const id = useId()
  return (
    <div className="ui-field ui-field--grow">
      <label htmlFor={id} className="ui-label">{label}</label>
      <textarea id={id} className="ui-input ui-textarea" rows={rows} maxLength={1000} value={value}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function Skeleton({ className = '', style }) {
  return <div className={`ui-skel ${className}`.trim()} style={style} aria-hidden="true" />
}

/** A few shimmering blocks as a page-level loading state. */
export function PageSkeleton({ rows = 3 }) {
  return (
    <div className="ui-skel-page" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="ui-skel-card" />)}
    </div>
  )
}
