import { useEffect, useState } from 'react'
import { Check, Gauge, Plus, RefreshCw, Sparkles, Timer, Utensils } from 'lucide-react'
import { api } from '../api/client'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader } from '../components/ui/Card'
import { PageSkeleton } from '../components/ui/controls'
import { useCoach } from '../context/coachContext'
import { usePageActions, usePageSubtitle } from '../context/metaContext'
import { fromIso, localToday } from '../utils/date'
import {
  dayMonth, isWarning, longDayLabel, planWeek, shortDay, stripCitations, useDayDone,
} from '../utils/planUtil'
import { SESSION_DOT } from '../utils/sessionStyle'
import '../plan.css'

const weekdayLong = (iso) => fromIso(iso).toLocaleDateString('en-GB', { weekday: 'long' })

function TypeBadge({ type }) {
  return (
    <span className="type-badge">
      <i style={{ background: SESSION_DOT[type] ?? SESSION_DOT.Rest }} aria-hidden="true" />
      {type === 'Match practice' ? 'Match' : type}
    </span>
  )
}

function DayDetail({ entry, today }) {
  const { openCoach } = useCoach()
  const [isDone, toggleDone] = useDayDone()
  const { iso, day } = entry
  const isToday = iso === today
  const rest = !day || day.session_type === 'Rest'
  const done = isDone(iso)
  const heading = `${isToday ? 'Today' : longDayLabel(iso)} · ${rest ? 'Rest day' : day.session_type}`
  const steps = rest ? [] : (day.activities ?? []).map(stripCitations)
  const tip = day?.nutrition_tip ? stripCitations(day.nutrition_tip) : ''
  const focus = rest ? (day?.focus ? stripCitations(day.focus) : 'Full rest and sleep focus') : stripCitations(day.focus)

  return (
    <Card className="pl-detail">
      <CardHeader title={heading} subtitle={focus}
        action={!rest && (
          <span className="pl-meta">
            <Badge tone="info"><Timer size={12} /> {day.duration_min} min</Badge>
            <Badge tone="warning"><Gauge size={12} /> Effort {day.target_rpe}/10</Badge>
          </span>
        )} />
      <div className="pl-scroll">
        {steps.length > 0 && (
          <ol className="pl-steps">
            {steps.map((s, i) => <li key={s}><b>{i + 1}</b><span>{s}</span></li>)}
          </ol>
        )}
        {rest && steps.length === 0 && <p className="card-muted">Take it easy today: light walking, stretching and good sleep.</p>}
        {tip && <p className="pl-tip"><Utensils size={16} /><span>{tip}</span></p>}
      </div>
      <div className="pl-actions">
        <button type="button" className={`btn ${done ? 'btn-secondary' : 'btn-primary'}`} aria-pressed={done}
          onClick={() => toggleDone(iso)}>
          <Check size={15} /> {done ? 'Done' : 'Mark done'}
        </button>
        <button type="button" className="btn btn-secondary"
          onClick={() => openCoach(`Explain ${isToday ? "today's" : `${weekdayLong(iso)}'s`} session: ${rest ? 'rest day' : `${day.session_type} - ${focus}`}`)}>
          <Sparkles size={15} /> Ask coach about it
        </button>
      </div>
    </Card>
  )
}

function Why({ plan }) {
  const p = plan.plan
  const warn = isWarning(p.safety_note)
  return (
    <Card as="aside" className="pl-why" aria-label="Why this plan">
      <CardHeader title="Why this plan?" subtitle="Built from your profile, training and wellness" />
      <div className="pl-scroll">
        {warn && <p className="pl-warn">{p.safety_note.replace(/\*\*/g, '').split('. ')[0]}.</p>}
        <p className="pl-rationale">{stripCitations(p.rationale)}</p>
        {!warn && p.safety_note && <p className="pl-safety">{p.safety_note}</p>}
        {plan.sources.length > 0 && (
          <p className="pl-sources">Based on: {plan.sources.map((s) => `${s.title} (${s.section})`).join('; ')}</p>
        )}
      </div>
    </Card>
  )
}

/** Everything that belongs to one plan; keyed by plan id so the selection resets for a new plan. */
function PlanBody({ plan, today }) {
  const [selected, setSelected] = useState(null)
  const [isDone] = useDayDone()
  const week = planWeek(plan)
  const stale = today > week[6].iso
  const current = week.find((e) => e.iso === selected) || week.find((e) => e.iso === today) || week[0]

  return (
    <>
      {stale && <p className="pl-stale">This plan has finished. Create a new plan for this week.</p>}
      <nav className="pl-week" aria-label="Plan days">
        {week.map((e) => {
          const type = e.day?.session_type || 'Rest'
          const sel = e.iso === current.iso
          const done = isDone(e.iso)
          return (
            <button key={e.iso} type="button" className={`pl-tile${sel ? ' is-selected' : ''}${e.iso === today ? ' is-today' : ''}`}
              onClick={() => setSelected(e.iso)} aria-pressed={sel}
              aria-label={`${weekdayLong(e.iso)} ${dayMonth(e.iso)}: ${type}${done ? ', done' : ''}`}>
              <span className="pl-tile-top">
                <span className="pl-tile-day">{e.iso === today ? 'Today' : shortDay(e.iso)}</span>
                {done && <span className="pl-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>}
              </span>
              <span className="pl-tile-date">{dayMonth(e.iso)}</span>
              <TypeBadge type={type} />
              <span className="pl-tile-min">{type === 'Rest' ? 'Full rest' : `${e.day.duration_min} min`}</span>
            </button>
          )
        })}
      </nav>
      <div className="pl-grid">
        <DayDetail entry={current} today={today} />
        <Why plan={plan} />
      </div>
    </>
  )
}

export default function Plan() {
  const [plan, setPlan] = useState(undefined) // undefined = loading, null = none
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const today = localToday()

  useEffect(() => {
    api('/plans/latest').then(setPlan).catch(() => setPlan(null))
  }, [])

  const week = plan ? planWeek(plan) : null
  usePageSubtitle(plan ? `${dayMonth(week[0].iso)} – ${dayMonth(week[6].iso)} · ${plan.plan.title}` : 'Your 7-day training plan')

  const generate = async () => {
    setError('')
    setGenerating(true)
    try {
      setPlan(await api('/plans/generate', { method: 'POST' }))
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const button = (
    <button type="button" className={`btn btn-sm ${plan ? 'btn-secondary' : 'btn-primary'}`} onClick={generate} disabled={generating}>
      {plan ? <RefreshCw size={14} /> : <Plus size={14} />}
      {generating ? 'Creating your plan… (about 20 s)' : plan ? 'New plan' : 'Create my plan'}
    </button>
  )
  usePageActions(plan ? button : null, [plan, generating])

  return (
    <div className="pg pl">
      {error && <p className="error-note" role="alert">{error}</p>}
      {(plan === undefined || (generating && !plan)) && <PageSkeleton rows={3} />}

      {plan === null && !generating && (
        <Card className="pl-none">
          <div className="empty-state">
            <p>No plan yet. Get a 7-day plan built from your profile, training and wellness.</p>
            {button}
          </div>
        </Card>
      )}

      {plan && <PlanBody key={plan.id} plan={plan} today={today} />}
    </div>
  )
}
