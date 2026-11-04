import { NavLink } from 'react-router-dom'
import {
  CalendarDays, CircleCheck, HeartPulse, LayoutDashboard, List, PanelLeftClose, PanelLeftOpen, Sparkles, X,
} from 'lucide-react'
import { useCoach } from '../context/coachContext'
import { SHORTCUT } from '../utils/format'
import { LABEL_COLOR } from '../utils/wellness'
import Logo from './Logo'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/plan', label: 'Plan', icon: CalendarDays },
  { to: '/activity', label: 'Activity', icon: List },
]

function Promo({ status }) {
  if (!status.loaded) return <div className="sb-promo sb-promo--skel" aria-hidden="true" />
  if (status.due) {
    return (
      <div className="sb-promo">
        <span className="ibadge ibadge-primary sb-promo-icon"><HeartPulse size={18} /></span>
        <p className="sb-promo-title">Daily check-in due <span className="sb-dot" aria-hidden="true" /></p>
        <p className="sb-promo-sub">30 seconds</p>
        <NavLink to="/checkin" className="btn btn-primary btn-sm btn-full">Check in now</NavLink>
      </div>
    )
  }
  const e = status.entry
  return (
    <div className="sb-promo">
      <p className="sb-promo-sub">Today&apos;s wellness</p>
      <p className="sb-promo-score num">{e.score}<span> / 100</span></p>
      <div className="kpi-progress" role="progressbar" aria-valuenow={e.score} aria-valuemin={0} aria-valuemax={100}
        aria-label="Today's wellness">
        <span style={{ width: `${e.score}%`, background: LABEL_COLOR[e.label] }} />
      </div>
      <p className="sb-promo-title sb-promo-label">{e.label}</p>
      <NavLink to="/checkin" className="link-action">Update check-in</NavLink>
    </div>
  )
}

export default function Sidebar({ collapsed, onToggle, drawerOpen, onCloseDrawer, status }) {
  const { toggleCoach, open: coachOpen } = useCoach()
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose
  return (
    <>
      <div className={`sb-scrim${drawerOpen ? ' is-open' : ''}`} onClick={onCloseDrawer} aria-hidden="true" />
      <aside className={`sb${drawerOpen ? ' is-drawer-open' : ''}`} aria-label="Sidebar">
        <div className="sb-head">
          <Logo compact={collapsed} to="/dashboard" />
          <button type="button" className="icon-btn sb-toggle" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            data-tip={collapsed ? 'Expand sidebar' : undefined}>
            <ToggleIcon size={18} />
          </button>
          <button type="button" className="icon-btn sb-close" onClick={onCloseDrawer} aria-label="Close menu"><X size={18} /></button>
        </div>

        <nav className="sb-nav" aria-label="Main">
          <p className="sb-section">Overview</p>
          {LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} data-tip={collapsed ? label : undefined} onClick={onCloseDrawer}
              className={({ isActive }) => `sb-item${isActive ? ' is-active' : ''}`}>
              <Icon size={18} strokeWidth={1.9} />
              <span className="sb-label">{label}</span>
            </NavLink>
          ))}
          <p className="sb-section">Coach</p>
          <button type="button" className={`sb-item${coachOpen ? ' is-active' : ''}`} onClick={toggleCoach}
            aria-pressed={coachOpen} data-tip={collapsed ? 'AI Coach' : undefined}>
            <Sparkles size={18} strokeWidth={1.9} />
            <span className="sb-label">AI Coach</span>
            <kbd className="sb-kbd">{SHORTCUT}</kbd>
          </button>
        </nav>

        <div className="sb-foot">
          <Promo status={status} />
          <NavLink to="/checkin" className="sb-mini" aria-label={status.due ? 'Daily check-in (due)' : 'Daily check-in (done)'}
            data-tip={status.due ? 'Check-in due' : `Wellness ${status.entry?.score ?? ''}`}>
            <CircleCheck size={20} strokeWidth={1.9} />
            {status.due && <span className="sb-dot" aria-hidden="true" />}
          </NavLink>
        </div>
      </aside>
    </>
  )
}
