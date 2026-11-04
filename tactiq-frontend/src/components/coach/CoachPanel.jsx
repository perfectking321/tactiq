import { useEffect, useRef, useState } from 'react'
import {
  Activity, ArrowRight, ArrowUp, Copy, Maximize2, Minimize2, Moon, RefreshCw, Sparkles, ThumbsDown, ThumbsUp,
  Trash2, TrendingDown, TrendingUp, TriangleAlert, X, Bone,
} from 'lucide-react'
import { useCoachState } from '../../context/coachContext'
import { greeting } from '../../utils/coachInsights'
import RichText from '../RichText'
import Menu from '../ui/Menu'
import ShuttleIcon from '../ui/ShuttleIcon'

const INSIGHT_ICON = { down: TrendingDown, up: TrendingUp, injury: Bone, match: ShuttleIcon, sleep: Moon, load: Activity }

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const revealed = new Set() // ids of answers whose typewriter already ran (survives remounts)

/** Fast client-side typewriter (the API returns the whole answer). Click the bubble to finish instantly. */
function BotText({ m, onDone }) {
  const animate = Boolean(m.fresh) && !revealed.has(m.id) && !reduced()
  const tokens = m.content.split(/(\s+)/)
  const words = tokens.filter((t) => t && !/^\s+$/.test(t)).length
  const [shown, setShown] = useState(animate ? 0 : words)

  useEffect(() => {
    if (!animate || shown >= words) {
      revealed.add(m.id)
      return undefined
    }
    const t = window.setTimeout(() => setShown((s) => Math.min(words, s + 3)), 15)
    return () => window.clearTimeout(t)
  }, [animate, shown, words, m.id])

  useEffect(() => {
    if (shown > 0) onDone?.()
  }, [shown, onDone])

  let text = m.content
  if (shown < words) {
    let count = 0
    let end = 0
    for (const t of tokens) {
      if (t && !/^\s+$/.test(t)) count += 1
      if (count > shown) break
      end += t.length
    }
    text = m.content.slice(0, end)
  }
  return (
    <div onClick={() => shown < words && setShown(words)}>
      <RichText text={text} sources={m.sources} />
    </div>
  )
}

function Actions({ m, rating, onRate, onCopy, onRegenerate, disabled }) {
  return (
    <div className="cp-actions" role="group" aria-label="Answer actions">
      <button type="button" className="icon-btn" aria-label="Copy answer" title="Copy" onClick={() => onCopy(m.content)}><Copy size={15} /></button>
      <button type="button" className={`icon-btn${rating === 'up' ? ' is-on' : ''}`} aria-label="Good answer" aria-pressed={rating === 'up'}
        title="Good answer" onClick={() => onRate(m.id, 'up')}><ThumbsUp size={15} /></button>
      <button type="button" className={`icon-btn${rating === 'down' ? ' is-on' : ''}`} aria-label="Bad answer" aria-pressed={rating === 'down'}
        title="Bad answer" onClick={() => onRate(m.id, 'down')}><ThumbsDown size={15} /></button>
      <button type="button" className="icon-btn" aria-label="Regenerate answer" title="Regenerate" disabled={disabled}
        onClick={() => onRegenerate(m)}><RefreshCw size={15} /></button>
    </div>
  )
}

function Thinking() {
  return (
    <div className="cp-msg cp-msg--bot" role="status" aria-label="Coach is thinking">
      <span className="cp-avatar" aria-hidden="true"><Sparkles size={14} /></span>
      <div className="cp-think">
        <p className="cp-think-label">Coach is thinking<span className="cp-dots" aria-hidden="true"><i /><i /><i /></span></p>
        <span className="ui-skel cp-line" style={{ width: '92%' }} />
        <span className="ui-skel cp-line" style={{ width: '78%' }} />
        <span className="ui-skel cp-line" style={{ width: '56%' }} />
      </div>
    </div>
  )
}

export default function CoachPanel() {
  const s = useCoachState()
  const { open, expanded, messages, sending, draft, suggestions } = s
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    const t = window.setTimeout(() => inputRef.current?.focus(), 280)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, open])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    if (draft && open) el.focus()
  }, [draft, open])

  const scrollDown = () => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  const clear = async () => {
    try {
      await s.onClear()
    } finally {
      setConfirmClear(false)
    }
  }

  const empty = messages.length === 0 && !sending && !s.loading
  const chips = (messages.length === 0 ? [...suggestions.ctx, ...suggestions.generic] : suggestions.ctx).slice(0, 3)
  const hour = new Date().getHours()

  return (
    <aside className={`copilot${open ? ' is-open' : ''}${expanded ? ' is-expanded' : ''}`} aria-label="AI Coach" inert={!open}>
      <div className="cp-inner">
        <header className="cp-head">
          <span className="cp-logo" aria-hidden="true"><Sparkles size={16} /></span>
          <h2>AI Coach</h2>
          <div className="cp-head-actions">
            <button type="button" className="icon-btn cp-expand" onClick={s.onToggleExpand}
              aria-label={expanded ? 'Narrow panel' : 'Widen panel'} title={expanded ? 'Narrow' : 'Widen'}>
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <Menu variant="icon" align="right" ariaLabel="Coach options"
              options={[{ value: 'clear', label: 'Clear conversation', icon: Trash2, danger: true, onSelect: () => setConfirmClear(true) }]} />
            <button type="button" className="icon-btn" onClick={s.onClose} aria-label="Close AI coach" title="Close (Esc)"><X size={18} /></button>
          </div>
        </header>

        <div className="cp-context" aria-label="What the coach can see">
          <span className="cp-ctx">Context</span>
          <span className="badge badge-primary">Profile</span>
          {s.context && <span className="badge badge-neutral">{s.context.sessions} sessions</span>}
          {s.context?.injury && <span className="badge badge-warning">{s.context.injury}</span>}
        </div>

        {confirmClear && (
          <div className="cp-confirm" role="alert">
            <span>Clear the conversation and the coach&apos;s memory?</span>
            <button type="button" className="link-action cp-danger" onClick={clear}>Yes, clear</button>
            <button type="button" className="link-action" onClick={() => setConfirmClear(false)}>No</button>
          </div>
        )}

        <div className="cp-messages" ref={listRef} tabIndex={-1}>
          {s.loading && (
            <>
              <span className="ui-skel cp-line" style={{ width: '70%' }} />
              <span className="ui-skel cp-line" style={{ width: '45%', alignSelf: 'flex-end' }} />
            </>
          )}
          {empty && (
            <div className="cp-empty">
              <h3>{greeting(hour)}, {s.name} 👋</h3>
              {s.insights === null ? (
                <p>Looking at your last 30 days…</p>
              ) : s.insights.length > 0 ? (
                <>
                  <p>I looked at your last 30 days:</p>
                  <ul className="cp-insights">
                    {s.insights.map((it) => {
                      const Icon = INSIGHT_ICON[it.icon] ?? Sparkles
                      return (
                        <li key={it.id}>
                          <button type="button" className="cp-insight" disabled={sending} onClick={() => s.onSend(it.question)}>
                            <span className={`ibadge ibadge-${it.tone}`}><Icon size={16} /></span>
                            <span className="cp-insight-text">{it.title}</span>
                            <ArrowRight size={15} className="cp-insight-go" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : (
                <p>Ask about technique, footwork, tactics, training, nutrition or recovery. Answers cite the source used.</p>
              )}
            </div>
          )}
          {messages.map((m) => (
            m.role === 'assistant' ? (
              <div key={m.id} className="cp-msg cp-msg--bot">
                <span className="cp-avatar" aria-hidden="true"><Sparkles size={14} /></span>
                <div className="cp-bubble-wrap">
                  <div className={`cp-bubble${m.safety_flag ? ' cp-bubble--safety' : ''}`}>
                    {m.safety_flag && (
                      <p className="cp-safety"><TriangleAlert size={14} /> Safety note: if pain is sharp or getting worse, please see a professional.</p>
                    )}
                    <BotText m={m} onDone={scrollDown} />
                  </div>
                  <Actions m={m} rating={s.feedback[m.id]} onRate={s.onRate} onCopy={s.onCopy} onRegenerate={s.onRegenerate} disabled={sending} />
                </div>
              </div>
            ) : (
              <div key={m.id} className="cp-msg cp-msg--user"><div className="cp-bubble cp-bubble--user">{m.content}</div></div>
            )
          ))}
          {sending && <Thinking />}
        </div>

        {s.error && <p className="error-note cp-error" role="alert">{s.error}</p>}

        <div className="cp-foot">
          {chips.length > 0 && (
            <div className="cp-chips">
              {chips.map((q) => (
                <button key={q} type="button" className="cp-chip" disabled={sending} onClick={() => s.onSend(q)}>{q}</button>
              ))}
            </div>
          )}
          <form className="cp-form" onSubmit={(e) => { e.preventDefault(); s.onSend(draft) }}>
            <label htmlFor="coach-input" className="visually-hidden">Message</label>
            <textarea id="coach-input" ref={inputRef} className="cp-input" rows={1} placeholder="Ask anything…" value={draft}
              maxLength={2000} disabled={sending} onChange={(e) => s.onDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  s.onSend(draft)
                }
              }} />
            <button type="submit" className="cp-send" disabled={sending || !draft.trim()} aria-label="Send">
              <ArrowUp size={17} />
            </button>
          </form>
          <p className="cp-disclaimer">General coaching info, not medical advice</p>
        </div>
      </div>
    </aside>
  )
}
