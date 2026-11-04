import { useLayoutEffect, useRef, useState } from 'react'
import Model from 'react-body-highlighter'
import { useCoach } from '../../context/coachContext'
import { describeRegions, displayPart, musclesInView, tipFor } from './bodyRegions'
import { injuryInfo } from './injuryInfo'
import './bodymap.css'

const BODY = '#c9d3e6'
// Injury colour ramps, indexed by pain band (1-3, 4-6, 7-10).
const RAMP = {
  Current: ['#ef8a8d', '#e5484d', '#c9262c'],
  Recovering: ['#f39a72', '#f08a5d', '#d9693a'],
}
const band = (pain) => (pain >= 7 ? 2 : pain >= 4 ? 1 : 0)
const VIEW_LABEL = { anterior: 'Front', posterior: 'Back' }
const HIDE_DELAY = 220 // ms: time to move the pointer from the injury onto the card (to reach "Ask coach")

/** The library writes fills as inline styles; the browser serialises them as rgb(), so compare in that form. */
function cssFill(color) {
  const probe = document.createElement('i')
  probe.style.fill = color
  return probe.style.fill
}

/**
 * ONE anatomical figure (front or back, whichever shows the injury), injured muscles coloured by status + pain.
 * Hover / focus / tap on the injured area shows a small card with the details. Read-only.
 * `profile` only needs injury_status / injury_body_part / pain_level, so it can be a live form state.
 */
export default function BodyFigure({ profile, aside }) {
  const { status, text, pain, injured, parsed, views } = injuryInfo(profile)
  const { openCoach } = useCoach()
  const [picked, setPicked] = useState(null)
  const view = views.includes(picked) ? picked : views[0] ?? 'anterior'
  const color = (RAMP[status] ?? RAMP.Current)[band(pain)]
  const hurtKey = musclesInView(parsed, view).join(',')
  // Only the injured muscles are highlighted; everything else stays body-coloured.
  const data = hurtKey ? [{ name: 'Injury', muscles: hurtKey.split(','), frequency: 1 }] : []

  const rootRef = useRef(null)
  const figRef = useRef(null)
  const tipRef = useRef(null)
  const hideTimer = useRef(0)
  const [tip, setTip] = useState(null) // pointer anchor { x, y } in container coordinates
  const [pos, setPos] = useState(null) // clamped { left, top } after measuring the tip

  // Tag the injured polygons so hover detection is a cheap attribute check (after every render:
  // the library re-draws the polygons whenever the view or data change).
  useLayoutEffect(() => {
    const body = cssFill(BODY)
    figRef.current?.querySelectorAll('polygon').forEach((p) => {
      p.toggleAttribute('data-injured', p.style.fill !== body)
    })
  })

  // Keep the tip inside the container: flip to the left of the pointer near the right edge, clamp vertically.
  useLayoutEffect(() => {
    if (!tip || !tipRef.current || !rootRef.current) {
      setPos(null)
      return
    }
    const box = rootRef.current.getBoundingClientRect()
    const { width: w, height: h } = tipRef.current.getBoundingClientRect()
    const gap = 14
    let left = tip.x + gap
    if (left + w > box.width - 8) left = Math.max(8, tip.x - gap - w)
    let top = Math.min(Math.max(8, tip.y - h / 2), Math.max(8, box.height - h - 8))
    // a short card (dashboard) may be smaller than the tip: keep the tip inside the viewport instead
    const over = box.top + top + h - (window.innerHeight - 8)
    if (over > 0) top -= over
    if (box.top + top < 8) top = 8 - box.top
    setPos({ left, top })
  }, [tip])

  const show = (clientX, clientY) => {
    window.clearTimeout(hideTimer.current)
    const box = rootRef.current.getBoundingClientRect()
    setTip({ x: clientX - box.left, y: clientY - box.top })
  }
  const hideSoon = () => {
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setTip(null), HIDE_DELAY)
  }
  const keep = () => window.clearTimeout(hideTimer.current)

  const onFigMove = (e) => {
    if (e.target.hasAttribute?.('data-injured')) show(e.clientX, e.clientY)
    else if (tip) hideSoon()
  }
  const onFigClick = (e) => {
    if (e.target.hasAttribute?.('data-injured')) show(e.clientX, e.clientY)
    else setTip(null)
  }
  // Keyboard focus: anchor the card at the right edge of the injured area.
  const onFigFocus = () => {
    const boxes = [...(figRef.current?.querySelectorAll('polygon[data-injured]') ?? [])].map((p) => p.getBoundingClientRect())
    if (!boxes.length) return
    const right = Math.max(...boxes.map((b) => b.right))
    const midY = (Math.min(...boxes.map((b) => b.top)) + Math.max(...boxes.map((b) => b.bottom))) / 2
    show(right, midY)
  }

  const partLabel = displayPart(text)
  const statusKey = status.toLowerCase()
  const canHover = injured && parsed.matched && hurtKey !== ''
  const figLabel = !injured
    ? 'Body figure: no injuries logged'
    : parsed.matched
      ? `${VIEW_LABEL[view]} view: ${statusKey} injury, ${describeRegions(parsed)}, pain ${pain} of 10`
      : `Body figure: couldn't place '${text}'`

  return (
    <div className={`bmf${aside ? ' bmf--row' : ''}`} ref={rootRef} onMouseLeave={() => setTip(null)}>
      {views.length > 1 && (
        <div className="bm-views" role="radiogroup" aria-label="Body view">
          {views.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={view === v}
              className={`bm-view${view === v ? ' is-active' : ''}`} onClick={() => { setPicked(v); setTip(null) }}>
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
      )}

      <div className="bm-stage">
        <div ref={figRef} className={`bm-fig${canHover ? ' is-hoverable' : ''}`}
          role={canHover ? 'button' : 'img'} tabIndex={canHover ? 0 : undefined} aria-label={figLabel}
          aria-describedby={canHover ? 'bm-desc' : undefined}
          onMouseMove={canHover ? onFigMove : undefined} onMouseLeave={canHover ? hideSoon : undefined}
          onClick={canHover ? onFigClick : undefined} onFocus={canHover ? onFigFocus : undefined}
          onBlur={canHover ? hideSoon : undefined}
          onKeyDown={canHover ? (e) => e.key === 'Escape' && setTip(null) : undefined}>
          <Model type={view} data={data} bodyColor={BODY} highlightedColors={[color]}
            style={{ width: '100%', height: '100%' }} />
        </div>
      </div>

      {canHover && (
        <p id="bm-desc" className="visually-hidden">
          {partLabel}, {status}, pain {pain} of 10. {tipFor(parsed, view)}
        </p>
      )}

      {aside && <div className="bmf-side">{aside}</div>}

      {tip && canHover && (
        <div ref={tipRef} className="bm-tip" role="tooltip" onMouseEnter={keep} onMouseLeave={hideSoon}
          style={pos ? { left: pos.left, top: pos.top } : { left: tip.x, top: tip.y, visibility: 'hidden' }}>
          <p className="bm-tip-title">{partLabel}</p>
          <div className="bm-tip-row">
            <span className={`bm-chip bm-chip--${statusKey}`}>{status}</span>
            <span className="bm-painbar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.max(0, pain * 10))}%`, background: color }} />
            </span>
            <span className="bm-tip-pain">{pain}/10</span>
          </div>
          <p className="bm-tip-text">{tipFor(parsed, view)}</p>
          <button type="button" className="bm-tip-link"
            onClick={() => openCoach(`My ${text.toLowerCase()} is ${statusKey} (pain ${pain}/10). What should I change in training?`)}>
            Ask coach →
          </button>
        </div>
      )}
    </div>
  )
}
