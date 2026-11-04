import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

/**
 * Guards app pages. Not logged in -> login page.
 * Logged in without a profile -> onboarding (unless this route is the onboarding page itself).
 */
export default function ProtectedRoute({ requireProfile = true }) {
  const { user, loading } = useAuth()

  if (loading) return <p className="page-loading">Loading…</p>
  if (!user) return <Navigate to="/" replace />
  if (requireProfile && !user.profile_complete) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
