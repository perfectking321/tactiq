import { ArrowDown, ArrowUp } from 'lucide-react'
import { formatDelta } from '../../utils/format'

/** tone: success | danger | warning | info | primary | neutral */
export function Badge({ tone = 'neutral', dot = false, children, className = '' }) {
  return <span className={`badge badge-${tone}${dot ? ' badge-dot' : ''} ${className}`.trim()}>{children}</span>
}

/** Icon in a 36px rounded tinted square. */
export function IconBadge({ icon: Icon, tone = 'primary', size = 18 }) {
  return (
    <span className={`ibadge ibadge-${tone}`} aria-hidden="true">
      <Icon size={size} strokeWidth={1.9} />
    </span>
  )
}

/** "▲ 8.4%" green / "▼ 4%" red. delta = { value, unit?, positiveIsGood? } (value 0 renders neutral). */
export function Delta({ delta, className = '' }) {
  if (!delta) return null
  const up = delta.value > 0
  const flat = delta.value === 0
  const good = flat ? null : (up === (delta.positiveIsGood !== false))
  const Arrow = up ? ArrowUp : ArrowDown
  return (
    <span className={`delta${good === true ? ' is-good' : good === false ? ' is-bad' : ''} ${className}`.trim()}
      title={`${up ? 'Up' : flat ? 'No change' : 'Down'} ${formatDelta(delta)} vs previous period`}>
      {!flat && <Arrow size={11} strokeWidth={2.6} aria-hidden="true" />}
      {formatDelta(delta)}
      <span className="visually-hidden"> {up ? 'increase' : flat ? 'no change' : 'decrease'} vs previous period</span>
    </span>
  )
}
