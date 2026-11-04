import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { useCoach } from './context/coachContext'
import Activity from './pages/Activity'
import ActivityNew from './pages/ActivityNew'
import Checkin from './pages/Checkin'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Plan from './pages/Plan'
import Profile, { Onboarding } from './pages/Profile'
import Signup from './pages/Signup'

/** Old /coach links: go to the dashboard and open the AI coach panel. */
function CoachRedirect() {
  const { openCoach } = useCoach()
  useEffect(() => {
    openCoach()
  }, [openCoach])
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route element={<ProtectedRoute requireProfile={false} />}>
            <Route path="/onboarding" element={<Onboarding />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/coach" element={<CoachRedirect />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/activity/new" element={<ActivityNew />} />
              <Route path="/training" element={<Navigate to="/activity?tab=training" replace />} />
              <Route path="/matches" element={<Navigate to="/activity?tab=matches" replace />} />
              <Route path="/checkin" element={<Checkin />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
