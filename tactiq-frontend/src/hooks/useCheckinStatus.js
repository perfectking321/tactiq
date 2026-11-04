import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { localToday } from '../utils/date'

/** Today's daily check-in: { due, entry } (entry = today's check-in or null). Refreshes on navigation and after saves. */
export function useCheckinStatus() {
  const { pathname } = useLocation()
  const [state, setState] = useState({ loaded: false, entry: null })

  const refresh = useCallback(() => {
    api('/checkins')
      .then((list) => setState({ loaded: true, entry: list.find((c) => c.date === localToday()) ?? null }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    window.addEventListener('tactiq:checkins', refresh)
    return () => window.removeEventListener('tactiq:checkins', refresh)
  }, [refresh, pathname])

  return { due: state.loaded && !state.entry, entry: state.entry, loaded: state.loaded }
}
