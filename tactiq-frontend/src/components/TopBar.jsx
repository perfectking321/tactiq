import { useContext } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check, ChevronDown, LogOut, Menu as MenuIcon, Plus, RotateCcw, Sparkles, User } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useCoach } from '../context/coachContext'
import { MetaContext } from '../context/metaContext'
import Menu from './ui/Menu'
import { SHORTCUT } from '../utils/format'

const TITLES = [
  ['/dashboard', 'Dashboard'],
  ['/plan', 'Training plan'],
  ['/activity', 'Activity'],
  ['/checkin', 'Daily check-in'],
  ['/profile', 'Profile'],
]

function AvatarMenu({ user, initial }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const name = user?.name || 'Athlete'
  // Demo profile only: rebuild the sample data so it ends today (same endpoint the old sidebar button used).
  const resetDemo = async () => {
    if (!window.confirm('Replace all demo data with a fresh sample set?')) return
    try {
      await api('/auth/demo/reset', { method: 'POST' })
      window.location.reload()
    } catch {
      window.alert('Could not reset the demo data. Please try again.')
    }
  }
  return (
    <Menu align="right" ariaLabel="Account" variant="custom"
      header={<div className="menu-head"><strong>{name}</strong><span>{user?.email}</span></div>}
      options={[
        { value: 'profile', label: 'Profile', icon: User, to: '/profile' },
        ...(user?.is_demo ? [{ value: 'reset', label: 'Reset demo data', icon: RotateCcw, onSelect: resetDemo }] : []),
        { value: 'logout', label: 'Log out', icon: LogOut, onSelect: () => { logout(); navigate('/', { replace: true }) } },
      ]}
      renderTrigger={({ triggerRef, open: _open, ...p }) => (
        <button ref={triggerRef} type="button" className="tb-user" {...p} aria-label={`Account menu for ${user?.name || user?.email || 'you'}`}>
          <span className="tb-avatar" aria-hidden="true">{initial}</span>
          <span className="tb-user-name">{name}</span>
          <ChevronDown size={15} className="tb-user-caret" />
        </button>
      )} />
  )
}

/** Shared page header rendered by AppLayout above every page. */
export default function TopBar({ status, onMenu }) {
  const { user } = useAuth()
  const { toggleCoach, open: coachOpen } = useCoach()
  const { pathname } = useLocation()
  const { title: customTitle, subtitle, actions } = useContext(MetaContext)
  const { due } = status

  const isDash = pathname === '/dashboard'
  const base = TITLES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))?.[1] ?? ''
  const first = (user?.name || '').trim().split(/\s+/)[0] || 'Athlete'
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase()
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const sub = isDash ? `Welcome back, ${first} · ${today}` : subtitle

  return (
    <header className="topbar">
      <button type="button" className="icon-btn tb-burger" onClick={onMenu} aria-label="Open menu"><MenuIcon size={20} /></button>
      <div className="tb-left">
        <h1 className="tb-title">{customTitle || base}</h1>
        {sub && <p className="tb-sub">{sub}</p>}
      </div>
      <div className="tb-right">
        {actions && <div className="tb-actions">{actions}</div>}
        <button type="button" className={`tb-ask${coachOpen ? ' is-open' : ''}`} onClick={toggleCoach} aria-pressed={coachOpen}
          title={`Ask your AI coach (${SHORTCUT} or /)`}>
          <Sparkles size={16} />
          <span className="tb-ask-text">Ask your AI coach…</span>
          <kbd className="tb-kbd">{SHORTCUT}</kbd>
        </button>
        <Link to="/activity/new" className="btn btn-primary tb-log"><Plus size={16} /><span>Log</span></Link>
        <Link to="/checkin" className="tb-round"
          aria-label={due ? 'Daily check-in (not done today)' : 'Daily check-in (done today)'}
          title={due ? 'Daily check-in - due today' : 'Daily check-in - done today'}>
          <Check size={18} />
          {due && <span className="tb-dot" aria-hidden="true" />}
        </Link>
        <AvatarMenu user={user} initial={initial} />
      </div>
    </header>
  )
}
