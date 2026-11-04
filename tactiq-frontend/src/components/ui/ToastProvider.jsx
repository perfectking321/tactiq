import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToastContext } from '../../context/toastContext'

export default function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const timer = useRef(0)
  const toast = useCallback((text) => {
    window.clearTimeout(timer.current)
    setMsg({ text, id: Date.now() })
    timer.current = window.setTimeout(() => setMsg(null), 2500)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const value = useMemo(() => ({ toast }), [toast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toast-host" aria-live="polite" role="status">
        {msg && <div key={msg.id} className="ui-toast">{msg.text}</div>}
      </div>
    </ToastContext.Provider>
  )
}
