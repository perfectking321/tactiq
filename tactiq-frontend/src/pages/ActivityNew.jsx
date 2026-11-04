import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Equal, Plus, Timer, X } from 'lucide-react'
import { api } from '../api/client'
import { Badge, IconBadge } from '../components/ui/Badge'
import { Card, CardHeader } from '../components/ui/Card'
import { Chips, DatePill, PageSkeleton, Slider, Stepper, TextArea, TextField } from '../components/ui/controls'
import Segmented from '../components/ui/Segmented'
import { usePageSubtitle, usePageTitle } from '../context/metaContext'
import { useToast } from '../context/toastContext'
import { addDays, fromIso, localToday } from '../utils/date'
import { evaluateGames, fromGameScores, toGameScores } from '../utils/matchUtil'
import { SESSION_ICON } from '../utils/sessionStyle'
import '../forms.css'

const TYPES = ['Footwork', 'Strength', 'Endurance', 'Technique', 'Match practice', 'Recovery']
const FORMATS = ['Singles', 'Doubles']
const KINDS = [
  { value: 'session', label: 'Session' },
  { value: 'match', label: 'Match' },
]

const effortLabel = (n) => (n <= 2 ? 'Very easy' : n <= 4 ? 'Easy' : n <= 6 ? 'Moderate' : n <= 8 ? 'Hard' : 'Max')
const ratingLabel = (n) => (n <= 3 ? 'Poor' : n <= 5 ? 'Okay' : n <= 7 ? 'Good' : n <= 9 ? 'Great' : 'Perfect')

const weekStart = (iso) => addDays(iso, -((fromIso(iso).getDay() + 6) % 7))
const fmt1 = (n) => (Math.round(n * 10) / 10).toString()

const emptySession = () => ({ date: localToday(), type: '', duration_min: 60, rpe: 6, notes: '' })
const emptyMatch = () => ({
  date: localToday(), opponent: '', format: 'Singles', rows: [{ a: '', b: '' }, { a: '', b: '' }], self_rating: 6, notes: '',
})

function SumRow({ label, children }) {
  return (
    <div className="sum-row">
      <span>{label}</span>
      <b className="num">{children}</b>
    </div>
  )
}

function SessionSummary({ form, sessions, editingId }) {
  const others = sessions.filter((s) => s.id !== editingId)
  const load = (Number(form.duration_min) || 0) * form.rpe
  const avgLoad = others.length ? others.reduce((a, s) => a + s.load, 0) / others.length : null
  let cmp = null
  if (avgLoad !== null && load > 0) {
    cmp = load > avgLoad * 1.1 ? ['up', 'above your avg'] : load < avgLoad * 0.9 ? ['down', 'below your avg'] : ['even', 'close to your avg']
  }
  const ws = weekStart(form.date)
  const inWeek = others.filter((s) => weekStart(s.date) === ws)
  const mins = inWeek.reduce((a, s) => a + s.duration_min, 0) + (Number(form.duration_min) || 0)
  const thisWeek = weekStart(localToday()) === ws
  const Icon = SESSION_ICON[form.type] ?? Timer
  const CmpIcon = cmp?.[0] === 'up' ? ArrowUp : cmp?.[0] === 'down' ? ArrowDown : Equal
  return (
    <>
      <CardHeader title="Summary" subtitle="Updates as you type" />
      <div className="sum-hero">
        <IconBadge icon={Icon} tone="primary" size={20} />
        <div>
          <p className="sum-big">{form.type || 'Choose a type'}</p>
          <p className="card-muted">{Number(form.duration_min) || 0} min × effort {form.rpe}</p>
        </div>
      </div>
      <SumRow label="Training load">
        {load}
        {cmp && (
          <Badge tone={cmp[0] === 'up' ? 'warning' : cmp[0] === 'down' ? 'info' : 'neutral'} className="sum-badge">
            <CmpIcon size={11} /> {cmp[1]}
          </Badge>
        )}
      </SumRow>
      <SumRow label={thisWeek ? 'This week' : `Week of ${fromIso(ws).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}>
        {inWeek.length + 1} {inWeek.length + 1 === 1 ? 'session' : 'sessions'} · {fmt1(mins / 60)} h
      </SumRow>
      <SumRow label="Your average load">{avgLoad === null ? '–' : Math.round(avgLoad)}</SumRow>
      <p className="fm-note">Load = minutes × effort, a simple way to track training without devices.</p>
    </>
  )
}

function MatchSummary({ result, matches, editingId }) {
  const others = matches.filter((m) => m.id !== editingId)
  const w = others.filter((m) => m.result === 'Win').length
  const l = others.filter((m) => m.result === 'Loss').length
  const tone = !result.decided ? 'none' : result.won > result.lost ? 'win' : 'loss'
  return (
    <>
      <CardHeader title="Result" subtitle="Calculated from the game scores" />
      <div className={`fm-result fm-result--${tone}`}>
        {result.decided ? (
          <>
            <Badge tone={tone === 'win' ? 'success' : 'danger'} dot>{tone === 'win' ? 'WIN' : 'LOSS'}</Badge>
            <span className="fm-result-score num">{result.won} – {result.lost}</span>
          </>
        ) : (
          <span className="fm-result-wait">Enter the game scores</span>
        )}
      </div>
      <SumRow label="Points">{result.games.length ? `${result.pointsWon} – ${result.pointsLost}` : '–'}</SumRow>
      <SumRow label="Season so far">{w}W – {l}L</SumRow>
      {!result.decided && result.games.length > 0 && result.error && <p className="fm-note">{result.error}</p>}
    </>
  )
}

export default function ActivityNew() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const id = params.get('id') ? Number(params.get('id')) : null
  const editing = id !== null
  const [kind, setKind] = useState(params.get('type') === 'match' ? 'match' : 'session')
  const [session, setSession] = useState(emptySession)
  const [match, setMatch] = useState(emptyMatch)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)

  usePageTitle(editing ? `Edit ${kind}` : 'New entry')
  usePageSubtitle(editing ? 'Change the details and save' : 'Log a training session or a match')

  useEffect(() => {
    Promise.all([api('/training'), api('/matches')])
      .then(([sessions, matches]) => {
        setData({ sessions, matches })
        if (!editing) return
        if (kind === 'session') {
          const s = sessions.find((x) => x.id === id)
          if (!s) return setError('That session no longer exists.')
          setSession({ date: s.date, type: s.type, duration_min: s.duration_min, rpe: s.rpe, notes: s.notes })
        } else {
          const m = matches.find((x) => x.id === id)
          if (!m) return setError('That match no longer exists.')
          setMatch({
            date: m.date, opponent: m.opponent, format: m.format, rows: fromGameScores(m.game_scores),
            self_rating: m.self_rating, notes: m.notes,
          })
        }
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const result = useMemo(() => evaluateGames(match.rows), [match.rows])
  const setS = (patch) => setSession((f) => ({ ...f, ...patch }))
  const setM = (patch) => setMatch((f) => ({ ...f, ...patch }))
  const setRow = (i, patch) => setM({ rows: match.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) })

  const validate = () => {
    if (kind === 'session') {
      if (!session.type) return 'Choose a session type.'
      const d = Number(session.duration_min)
      if (!Number.isFinite(d) || d < 5 || d > 480) return 'Duration must be between 5 and 480 minutes.'
      return ''
    }
    if (!match.opponent.trim()) return 'Enter your opponent.'
    return result.error
  }

  const cancel = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/activity'))

  const save = async (e) => {
    e.preventDefault()
    setAttempted(true)
    setError('')
    const problem = validate()
    if (problem) return
    setBusy(true)
    try {
      if (kind === 'session') {
        await api(editing ? `/training/${id}` : '/training', {
          method: editing ? 'PUT' : 'POST',
          body: { date: session.date, type: session.type, duration_min: Number(session.duration_min), rpe: session.rpe, notes: session.notes },
        })
        toast(editing ? 'Session updated ✓' : 'Session saved ✓')
        navigate('/activity?tab=training')
      } else {
        await api(editing ? `/matches/${id}` : '/matches', {
          method: editing ? 'PUT' : 'POST',
          body: {
            date: match.date, opponent: match.opponent.trim(), format: match.format, game_scores: toGameScores(result.games),
            self_rating: match.self_rating, notes: match.notes,
          },
        })
        toast(editing ? 'Match updated ✓' : 'Match saved ✓')
        navigate('/activity?tab=matches')
      }
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (!data && !error) return <PageSkeleton rows={2} />

  const problem = attempted ? validate() : ''
  const shownError = error || problem
  const isSession = kind === 'session'

  return (
    <div className="pg fm">
      <div className="fm-grid">
        <Card as="form" className="fm-card" onSubmit={save} noValidate>
          <CardHeader title={editing ? `Edit ${kind}` : isSession ? 'Training session' : 'Match'}
            subtitle={isSession ? 'What did you work on?' : 'Who did you play?'}
            action={!editing && (
              <Segmented label="Entry type" options={KINDS} value={kind}
                onChange={(k) => { setKind(k); setAttempted(false); setError('') }} />
            )} />
          <div className="fm-body">
            {isSession ? (
              <>
                <div className="fm-two">
                  <DatePill value={session.date} max={localToday()} onChange={(date) => setS({ date })} />
                  <Stepper label="Duration" value={session.duration_min} onChange={(v) => setS({ duration_min: v })}
                    step={5} min={5} max={480} unit="min" />
                </div>
                <div className="ui-field">
                  <span className="ui-label">Type</span>
                  <Chips label="Session type" options={TYPES} value={session.type} onChange={(type) => setS({ type })} />
                </div>
                <Slider label="Effort (how hard did the whole session feel?)" value={session.rpe} onChange={(rpe) => setS({ rpe })}
                  valueText={<>{session.rpe} <em>{effortLabel(session.rpe)}</em></>} />
                <TextArea label="Notes (optional)" value={session.notes} onChange={(notes) => setS({ notes })}
                  placeholder="What did you work on? Anything that felt off?" />
              </>
            ) : (
              <>
                <div className="fm-three">
                  <DatePill value={match.date} max={localToday()} onChange={(date) => setM({ date })} />
                  <TextField label="Opponent" value={match.opponent} maxLength={100} placeholder="e.g. Rohan"
                    onChange={(opponent) => setM({ opponent })} />
                  <div className="ui-field">
                    <span className="ui-label">Format</span>
                    <Chips label="Match format" options={FORMATS} value={match.format} onChange={(format) => setM({ format })} />
                  </div>
                </div>
                <div className="ui-field">
                  <span className="ui-label">Game scores (your points first)</span>
                  <div className="fm-games">
                    <span />
                    <span className="fm-games-h">You</span>
                    <span className="fm-games-h">Opp</span>
                    <span />
                    {match.rows.map((r, i) => (
                      <GameRow key={i} i={i} row={r} canRemove={match.rows.length > 1}
                        onChange={(patch) => setRow(i, patch)}
                        onRemove={() => setM({ rows: match.rows.filter((_, j) => j !== i) })} />
                    ))}
                  </div>
                  {match.rows.length < 3 && (
                    <button type="button" className="link-action fm-add" onClick={() => setM({ rows: [...match.rows, { a: '', b: '' }] })}>
                      <Plus size={14} /> Add game
                    </button>
                  )}
                </div>
                <Slider label="How well did you play?" value={match.self_rating} onChange={(self_rating) => setM({ self_rating })}
                  valueText={<>{match.self_rating} <em>{ratingLabel(match.self_rating)}</em></>} />
                <TextArea label="Notes (optional)" value={match.notes} onChange={(notes) => setM({ notes })}
                  placeholder="What worked? How did you lose points?" />
              </>
            )}
          </div>
          {shownError && <p className="error-note fm-err" role="alert">{shownError}</p>}
          <div className="fm-actions">
            <button type="button" className="btn btn-secondary" onClick={cancel}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editing ? `Update ${kind}` : `Save ${kind === 'session' ? 'session' : 'match'}`}
            </button>
          </div>
        </Card>

        <Card as="aside" className="fm-side" aria-label={isSession ? 'Summary' : 'Result'}>
          {isSession
            ? <SessionSummary form={session} sessions={data?.sessions ?? []} editingId={editing ? id : null} />
            : <MatchSummary result={result} matches={data?.matches ?? []} editingId={editing ? id : null} />}
        </Card>
      </div>
    </div>
  )
}

function GameRow({ i, row, onChange, onRemove, canRemove }) {
  const clean = (v) => v.replace(/[^\d]/g, '').slice(0, 2)
  return (
    <>
      <span className="fm-games-n">Game {i + 1}</span>
      <input className="ui-input fm-score" inputMode="numeric" aria-label={`Game ${i + 1} your points`} value={row.a}
        onChange={(e) => onChange({ a: clean(e.target.value) })} placeholder="–" />
      <input className="ui-input fm-score" inputMode="numeric" aria-label={`Game ${i + 1} opponent points`} value={row.b}
        onChange={(e) => onChange({ b: clean(e.target.value) })} placeholder="–" />
      {canRemove ? (
        <button type="button" className="icon-btn" aria-label={`Remove game ${i + 1}`} onClick={onRemove}><X size={14} /></button>
      ) : <span />}
    </>
  )
}
