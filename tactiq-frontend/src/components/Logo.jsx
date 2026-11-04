import { Link } from 'react-router-dom'

/** White shuttlecock glyph used inside the gradient mark. */
function Glyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6.5" cy="17.5" r="2.8" fill="currentColor" stroke="none" />
      <path d="M9 15 18 6" />
      <path d="M11.5 19.5 20 11l-3-3" />
      <path d="M14.5 4.5l5 5" />
    </svg>
  )
}

/** TactiQ wordmark: gradient rounded-square mark + text. `compact` shows only the mark. */
export default function Logo({ light = false, compact = false, to = '/', className = '' }) {
  return (
    <Link to={to} className={`logo${light ? ' logo--light' : ''} ${className}`.trim()} aria-label="TactiQ">
      <span className="logo-mark" aria-hidden="true"><Glyph /></span>
      {!compact && <span className="logo-text">TactiQ</span>}
    </Link>
  )
}
