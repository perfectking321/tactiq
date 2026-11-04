import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, clearToken, getToken, setToken } from '../api/client'
import { rememberProfile } from './savedProfiles'
import { AuthContext } from './useAuth'

/** Current user from the stored token, or null (an invalid/expired token is discarded). */
function fetchMe() {
  if (!getToken()) return Promise.resolve(null)
  return api('/auth/me')
    .then((me) => {
      // Real accounts become saved profile cards on the login screen (the demo has its own card).
      if (!me.is_demo) rememberProfile({ email: me.email, name: me.name })
      return me
    })
    .catch(() => {
      clearToken()
      return null
    })
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getToken()))

  const refresh = useCallback(async () => {
    const me = await fetchMe()
    setUser(me)
    setLoading(false)
    return me
  }, [])

  useEffect(() => {
    // Restore the session from a stored token on first load.
    fetchMe().then((me) => {
      setUser(me)
      setLoading(false)
    })
    const onLogout = () => setUser(null)
    window.addEventListener('tactiq:logout', onLogout)
    return () => window.removeEventListener('tactiq:logout', onLogout)
  }, [])

  const signInWith = useCallback(
    async (request) => {
      const { access_token } = await request
      setToken(access_token)
      return refresh()
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      user,
      loading,
      refresh,
      login: (email, password) => signInWith(api('/auth/login', { method: 'POST', body: { email, password } })),
      register: (email, password) => signInWith(api('/auth/register', { method: 'POST', body: { email, password } })),
      loginDemo: () => signInWith(api('/auth/demo', { method: 'POST' })),
      logout: () => {
        clearToken()
        setUser(null)
      },
    }),
    [user, loading, refresh, signInWith],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
