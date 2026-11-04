import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { forgetProfile, getSavedProfiles, initials } from '../auth/savedProfiles'
import { useAuth } from '../auth/useAuth'
import Logo from '../components/Logo'

/** Email + password form, used for a saved profile (email fixed) or "another account". */
function PasswordForm({ fixedEmail, onCancel, onDone }) {
  const { login } = useAuth()
  const [email, setEmail] = useState(fixedEmail || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setBusy(true)
    try {
      onDone(await login(email.trim(), password))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="pp-form card" onSubmit={submit} noValidate>
      <h2>{fixedEmail ? `Log in as ${fixedEmail}` : 'Log in with another account'}</h2>
      {!fixedEmail && (
        <div className="form-field">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </div>
      )}
      <div className="form-field">
        <label htmlFor="login-password">Password</label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} autoFocus
          onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </div>
    </form>
  )
}

/** First screen: Netflix-style profile picker (demo profile, saved accounts, create / other login). */
export default function Login() {
  const { user, loginDemo } = useAuth()
  const navigate = useNavigate()
  const [demo, setDemo] = useState(null)
  const [saved, setSaved] = useState(getSavedProfiles)
  const [active, setActive] = useState(null) // email of the saved profile being logged into, or 'other'
  const [demoBusy, setDemoBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/auth/demo').then(setDemo).catch(() => setDemo({ enabled: false }))
  }, [])

  if (user) return <Navigate to={user.profile_complete ? '/dashboard' : '/onboarding'} replace />

  const go = (me) => navigate(me?.profile_complete ? '/dashboard' : '/onboarding', { replace: true })

  const openDemo = async () => {
    setError('')
    setDemoBusy(true)
    try {
      go(await loginDemo())
    } catch (err) {
      setError(err.message)
      setDemoBusy(false)
    }
  }

  const remove = (email) => {
    forgetProfile(email)
    setSaved(getSavedProfiles())
    if (active === email) setActive(null)
  }

  return (
    <div className="page page-auth pp-page">
      <header className="auth-header">
        <Logo />
      </header>
      <main className="pp-main">
        <h1>Who&apos;s training today?</h1>
        <p className="auth-sub">Pick a profile to continue, or create a new one.</p>

        <div className="pp-grid">
          {demo?.enabled && (
            <button type="button" className="pp-card pp-card--demo" onClick={openDemo} disabled={demoBusy}>
              <span className="pp-avatar pp-avatar--demo">{initials(demo.name)}</span>
              <span className="pp-name">{demo.name}</span>
              <span className="pp-tag">Demo player · sample data</span>
              <span className="pp-meta">{demoBusy ? 'Opening…' : 'One click, no password'}</span>
            </button>
          )}

          {saved.map((p) => (
            <div key={p.email} className={`pp-card-wrap${active === p.email ? ' is-active' : ''}`}>
              <button type="button" className="pp-card" onClick={() => setActive(p.email)}>
                <span className="pp-avatar">{initials(p.name || p.email)}</span>
                <span className="pp-name">{p.name || p.email.split('@')[0]}</span>
                <span className="pp-meta">{p.email}</span>
              </button>
              <button type="button" className="pp-remove" onClick={() => remove(p.email)}
                aria-label={`Remove ${p.email} from this device`} title="Remove from this device">×</button>
            </div>
          ))}

          <Link to="/signup" className="pp-card pp-card--new">
            <span className="pp-avatar pp-avatar--new">+</span>
            <span className="pp-name">New account</span>
            <span className="pp-meta">Track your own training</span>
          </Link>
        </div>

        {error && <p className="form-error pp-error" role="alert">{error}</p>}

        {active ? (
          <PasswordForm key={active} fixedEmail={active === 'other' ? null : active}
            onCancel={() => setActive(null)} onDone={go} />
        ) : (
          <button type="button" className="link-btn pp-other" onClick={() => setActive('other')}>
            Log in with another account
          </button>
        )}
      </main>
    </div>
  )
}
