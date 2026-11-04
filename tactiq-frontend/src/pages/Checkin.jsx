import { useEffect, useMemo, useState } from 'react'
import { HeartPulse } from 'lucide-react'
import { api } from '../api/client'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader } from '../components/ui/Card'
import { DatePill, PageSkeleton, Slider, Stepper, TextArea } from '../components/ui/controls'
import KpiCard from '../components/ui/KpiCard'
import { makeDelta } from '../components/dashboard/model'
import { usePageSubtitle } from '../context/metaContext'
import { useToast } from '../context/toastContext'
import { addDays, fromIso, localToday } from '../utils/date'
import { LABEL_COLOR, wellnessLabel, wellnessScore } from '../utils/wellness'
import '../forms.css'

const DEFAULTS = { sleep_hours: 7.5, energy: 6, soreness: 4, stress: 4, water_l: 2, notes: '' }

const word = (kind, n) => {
  if (kind === 'energy') return n <= 3 ? 'Low' : n <= 6 ? 'Okay' : n <= 8 ? 'Good' : 'High'
  if (kind === 'soreness') return n <= 2 ? 'None' : n <= 4 ? 'Mild' : n <= 7 ? 'Moderate' : 'High'
  return n <= 3 ? 'Calm' : n <= 5 ? 'Mild' : n <= 7 ? 'Elevated' : 'High'
}

const TONE = { 'Good to train': 'success', 'Train with care': 'warning', 'Prioritise recovery': 'danger' }
const KPI_TONE = { 'Good to train': 'success', 'Train with care': 'warning', 'Prioritise recovery': 'danger' }

const fromEntry = (c) => ({
  sleep_hours: c.sleep_hours, energy: c.energy, soreness: c.soreness, stress: c.stress, water_l: c.water_l, notes: c.notes,
})
const dayLabel = (iso) => fromIso(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export default function Checkin() {
  const today = localToday()
  const toast = useToast()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [date, setDate] = useState(today)
  const [form, setForm] = useState(DEFAULTS)
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)

  usePageSubtitle(dayLabel(date))

  useEffect(() => {
    api('/checkins').then(setItems).catch((e) => setError(e.message))
  }, [])

  const existing = useMemo(() => items?.find((c) => c.date === date) ?? null, [items, date])

  // Load the entry for the chosen day (or the defaults) whenever the day or the saved data changes.
  useEffect(() => {
    if (!items) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(existing ? fromEntry(existing) : DEFAULTS)
    setError('')
  }, [existing, items])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const score = wellnessScore(form)
  const label = wellnessLabel(score)
  const color = LABEL_COLOR[label]
  const before = items?.find((c) => c.date === addDays(date, -1))
  const delta = before ? makeDelta(score, before.score, { mode: 'abs', digits: 0 }) : null

  const week = useMemo(() => {
    const byDate = new Map((items ?? []).map((c) => [c.date, c]))
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(today, i - 6)
      return { iso, entry: byDate.get(iso) ?? null }
    })
  }, [items, today])

  const sleepOk = form.sleep_hours !== '' && Number(form.sleep_hours) >= 0 && Number(form.sleep_hours) <= 16
  const waterOk = form.water_l !== '' && Number(form.water_l) >= 0 && Number(form.water_l) <= 10

  const save = async (e) => {
    e.preventDefault()
    setAttempted(true)
    if (!sleepOk || !waterOk) return
    setBusy(true)
    setError('')
    try {
      const body = {
        date, sleep_hours: Number(form.sleep_hours), energy: form.energy, soreness: form.soreness, stress: form.stress,
        water_l: Number(form.water_l), notes: form.notes,
      }
      const saved = await api(existing ? `/checkins/${existing.id}` : '/checkins', { method: existing ? 'PUT' : 'POST', body })
      setItems((list) => [saved, ...list.filter((c) => c.id !== saved.id)])
      toast(existing ? 'Check-in updated ✓' : 'Check-in saved ✓')
      window.dispatchEvent(new Event('tactiq:checkins'))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!items && !error) return <PageSkeleton rows={2} />

  const problem = !attempted ? '' : !sleepOk ? 'Sleep must be between 0 and 16 hours.' : !waterOk ? 'Water must be between 0 and 10 litres.' : ''

  return (
    <div className="pg">
      <div className="ck-grid">
        <Card as="form" className="fm-card" onSubmit={save} noValidate>
          <CardHeader title="How are you today?" subtitle={`${dayLabel(date)} · takes about 30 seconds`} />
          <div className="fm-body">
            <div className="fm-two">
              <DatePill value={date} max={today} onChange={(d) => { setDate(d); setAttempted(false) }} />
              <Stepper label="Sleep last night" value={form.sleep_hours} onChange={(v) => set({ sleep_hours: v })}
                step={0.5} min={0} max={16} unit="h" decimals={1} />
            </div>
            <Slider label="Energy" value={form.energy} onChange={(energy) => set({ energy })}
              valueText={<>{form.energy} <em>{word('energy', form.energy)}</em></>} />
            <Slider label="Soreness" value={form.soreness} onChange={(soreness) => set({ soreness })}
              valueText={<>{form.soreness} <em>{word('soreness', form.soreness)}</em></>} />
            <Slider label="Stress" value={form.stress} onChange={(stress) => set({ stress })}
              valueText={<>{form.stress} <em>{word('stress', form.stress)}</em></>} />
            <div className="fm-two">
              <Stepper label="Water" value={form.water_l} onChange={(v) => set({ water_l: v })} step={0.25} min={0} max={10}
                unit="L" decimals={2} />
              <span />
            </div>
            <TextArea label="Notes (optional)" value={form.notes} onChange={(notes) => set({ notes })}
              placeholder="Anything unusual today?" />
          </div>
          {(error || problem) && <p className="error-note fm-err" role="alert">{error || problem}</p>}
          <div className="fm-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : existing ? 'Update check-in' : 'Save check-in'}
            </button>
          </div>
        </Card>

        <div className="ck-side">
          <KpiCard className="ck-score" label="Wellness score" icon={HeartPulse} tone={KPI_TONE[label]} value={score} unit="/ 100" delta={delta}
            context={before ? 'live · vs the day before' : 'live as you adjust the sliders'} progress={{ value: score, max: 100 }}>
            <p className="ck-status"><Badge tone={TONE[label]} dot>{label}</Badge></p>
          </KpiCard>

          <Card className="ck-week-card" aria-label="Last 7 days">
            <CardHeader title="Last 7 days" subtitle="Click a bar to edit that day" />
            <div className="ck-bars">
              {week.map(({ iso, entry }) => (
                <button key={iso} type="button" className={`ck-bar${iso === date ? ' is-sel' : ''}`}
                  aria-label={`${dayLabel(iso)}: ${entry ? `score ${entry.score}` : 'no check-in'}`}
                  aria-pressed={iso === date} onClick={() => { setDate(iso); setAttempted(false) }}>
                  <span className="ck-bar-val num">{entry ? entry.score : ''}</span>
                  <span className="ck-bar-col">
                    {entry ? (
                      <span className="ck-bar-fill" style={{ height: `${Math.max(6, entry.score)}%`, background: LABEL_COLOR[entry.label] ?? color }} />
                    ) : (
                      <span className="ck-bar-empty" />
                    )}
                  </span>
                  <span className="ck-bar-day">{fromIso(iso).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
