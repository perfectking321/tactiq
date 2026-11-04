import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import AuthShell from '../components/AuthShell'

export default function Signup() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={user.profile_complete ? '/dashboard' : '/onboarding'} replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password || !confirm) {
      setError('Please fill in all fields.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await register(email.trim(), password)
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Your personal GenAI badminton coach">
      <form onSubmit={handleSubmit} className="form-stack" noValidate>
        <div className="form-field">
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} />
          <span className="field-hint">At least 8 characters.</span>
        </div>
        <div className="form-field">
          <label htmlFor="signup-confirm">Confirm password</label>
          <input id="signup-confirm" type="password" autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link to="/">Log in</Link>
      </p>
    </AuthShell>
  )
}
