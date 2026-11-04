import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { MetaContext } from '../context/metaContext'
import { useCheckinStatus } from '../hooks/useCheckinStatus'
import CoachPanel from './coach/CoachPanel'
import CoachProvider from './coach/CoachProvider'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import ToastProvider from './ui/ToastProvider'
import '../shell.css'
import '../coach.css'

const COLLAPSE_KEY = 'tactiq_sidebar_collapsed'
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

function Shell() {
  const { pathname } = useLocation()
  const status = useCheckinStatus()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawer, setDrawer] = useState(false)

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        // preference only
      }
      return !c
    })
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawer(false)
  }, [pathname])

  return (
    <div className={`shell${collapsed ? ' is-collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={toggle} drawerOpen={drawer} onCloseDrawer={() => setDrawer(false)} status={status} />
      <div className="shell-stage">
        <div className="shell-main">
          <TopBar status={status} onMenu={() => setDrawer(true)} />
          <main className="app-body">
            <Outlet />
          </main>
        </div>
        <CoachPanel />
      </div>
    </div>
  )
}

export default function AppLayout() {
  const [subtitle, setSubtitle] = useState('')
  const [title, setTitle] = useState('')
  const [actions, setActions] = useState(null)
  const meta = useMemo(() => ({ subtitle, setSubtitle, title, setTitle, actions, setActions }), [subtitle, title, actions])

  return (
    <MetaContext.Provider value={meta}>
      <ToastProvider>
        <CoachProvider>
          <Shell />
        </CoachProvider>
      </ToastProvider>
    </MetaContext.Provider>
  )
}
