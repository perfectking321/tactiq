/** Segmented control (radiogroup). options: [{ value, label }] */
export default function Segmented({ label, options, value, onChange, className = '' }) {
  return (
    <div className={`seg ${className}`.trim()} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value}
          className={`seg-btn${value === o.value ? ' is-on' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
