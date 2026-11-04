import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { CoachContext, CoachStateContext } from '../../context/coachContext'
import { useToast } from '../../context/toastContext'
import { buildInsights } from '../../utils/coachInsights'
import { localToday } from '../../utils/date'

const GENERIC = [
  'How can I improve my footwork to the rear court?',
  'What should I eat on a tournament day?',
  'I get tired in the third game. What should I train?',
  'How do I warm up properly before a match?',
]

const BY_ROUTE = {
  '/dashboard': ['Why is my wellness dropping?', 'Plan my match day'],
  '/plan': ["Explain today's session"],
  '/activity': ['How was my training load this week?'],
  '/checkin': ['How can I sleep better?'],
  '/profile': ['Exercises safe for my injury?'],
}

function suggestionsFor(pathname) {
  const key = Object.keys(BY_ROUTE).find((k) => pathname === k || pathname.startsWith(`${k}/`))
  return { ctx: key ? BY_ROUTE[key] : [], generic: GENERIC.slice(0, 2) }
}

const FB_KEY = 'tactiq_chat_feedback'
const readFeedback = () => {
  try {
    return JSON.parse(localStorage.getItem(FB_KEY) || '{}')
  } catch {
    return {}
  }
}

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

/**
 * Owns the AI coach conversation for the whole app shell (so it survives navigation): the docked copilot
 * panel reads everything from useCoachState(). Pages open it with useCoach().openCoach(prefill?).
 */
export default function CoachProvider({ children }) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState([])
  const [loadedHistory, setLoadedHistory] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [insightData, setInsightData] = useState(null)
  const [feedback, setFeedback] = useState(readFeedback)
  const trigger = useRef(null)
  const asked = useRef(false)
  const sendingRef = useRef(false)

  const openCoach = useCallback((prefill) => {
    if (!trigger.current) trigger.current = document.activeElement
    if (typeof prefill === 'string' && prefill) setDraft(prefill)
    setOpen(true)
  }, [])

  const closeCoach = useCallback(() => {
    setOpen(false)
    const el = trigger.current
    trigger.current = null
    if (el && typeof el.focus === 'function' && document.contains(el) && el !== document.body) window.setTimeout(() => el.focus(), 0)
  }, [])

  const toggleCoach = useCallback(() => {
    if (open) closeCoach()
    else openCoach()
  }, [open, openCoach, closeCoach])

  // First open: load the history and the data behind the insight cards.
  useEffect(() => {
    if (!open || asked.current) return
    asked.current = true
    api('/chat/history')
      .then(setMessages)
      .catch((e) => setError(e.message))
      .finally(() => setLoadedHistory(true))
    Promise.all([
      api('/checkins').catch(() => []),
      api('/profile').catch(() => null),
      api('/training').catch(() => []),
      api('/matches').catch(() => []),
      api('/plans/latest').catch(() => null),
    ]).then(([checkins, profile, sessions, matches, plan]) => setInsightData({ checkins, profile, sessions, matches, plan }))
  }, [open])

  // Keyboard: Ctrl/Cmd+K and "/" toggle, Esc closes.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggleCoach()
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(document.activeElement)) {
        e.preventDefault()
        toggleCoach()
      } else if (e.key === 'Escape' && open && !e.defaultPrevented) {
        closeCoach()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, toggleCoach, closeCoach])

  /** opts.replaceId: regenerate - the old answer is dropped and the question is not added again. */
  const send = useCallback(async (text, opts = {}) => {
    const message = text.trim()
    if (!message || sendingRef.current) return
    sendingRef.current = true
    setError('')
    setDraft('')
    setMessages((m) => {
      if (opts.replaceId) return m.filter((x) => x.id !== opts.replaceId)
      return [...m, { id: `local-${Date.now()}`, role: 'user', content: message, sources: [] }]
    })
    setSending(true)
    try {
      const reply = await api('/chat', { method: 'POST', body: { message } })
      setMessages((m) => [
        ...m,
        {
          id: `reply-${Date.now()}`, role: 'assistant', content: reply.answer, sources: reply.sources,
          safety_flag: reply.safety_flag, question: message, fresh: true,
        },
      ])
    } catch (e) {
      setError(e.message)
      if (!opts.replaceId) {
        setMessages((m) => m.slice(0, -1)) // the question was not answered or saved; let the user retry
        setDraft(message)
      }
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [])

  const regenerate = useCallback((m) => {
    const idx = messages.findIndex((x) => x.id === m.id)
    const q = m.question ?? [...messages.slice(0, idx)].reverse().find((x) => x.role === 'user')?.content
    if (q) send(q, { replaceId: m.id })
  }, [messages, send])

  const rate = useCallback((id, value) => {
    setFeedback((f) => {
      const next = { ...f }
      if (next[id] === value) delete next[id]
      else next[id] = value
      try {
        localStorage.setItem(FB_KEY, JSON.stringify(next))
      } catch {
        // feedback is a convenience only
      }
      return next
    })
  }, [])

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text.replace(/\s*\[\d+\]/g, ''))
      toast('Copied to clipboard')
    } catch {
      toast('Could not copy')
    }
  }, [toast])

  const clear = useCallback(async () => {
    await api('/chat/history', { method: 'DELETE' })
    setMessages([])
  }, [])

  const insights = useMemo(() => (insightData ? buildInsights(insightData, localToday()) : null), [insightData])
  const context = useMemo(() => {
    if (!insightData) return null
    const since = new Date()
    since.setDate(since.getDate() - 29)
    const pad = (n) => String(n).padStart(2, '0')
    const start = `${since.getFullYear()}-${pad(since.getMonth() + 1)}-${pad(since.getDate())}`
    const n30 = insightData.sessions.filter((s) => s.date >= start).length
    const p = insightData.profile
    const injured = p && p.injury_status && p.injury_status !== 'None' && (p.injury_body_part || '').trim()
    return {
      sessions: n30,
      injury: injured ? `${p.injury_body_part.trim().replace(/^./, (c) => c.toUpperCase())} · ${p.pain_level}/10` : null,
    }
  }, [insightData])

  const actions = useMemo(() => ({ openCoach, closeCoach, toggleCoach, open }), [openCoach, closeCoach, toggleCoach, open])
  const state = {
    open, expanded, onToggleExpand: () => setExpanded((e) => !e), onClose: closeCoach, messages, loading: open && !loadedHistory,
    sending, error, draft, onDraft: setDraft, onSend: send, onClear: clear, onRegenerate: regenerate, onRate: rate, onCopy: copy,
    feedback, suggestions: suggestionsFor(pathname), insights, context, name: (user?.name || '').trim().split(/\s+/)[0] || 'there',
  }

  return (
    <CoachContext.Provider value={actions}>
      <CoachStateContext.Provider value={state}>{children}</CoachStateContext.Provider>
    </CoachContext.Provider>
  )
}
