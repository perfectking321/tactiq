import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'
import BodyFigure from '../components/dashboard/BodyFigure'
import { Bone, Dumbbell, UserRound } from 'lucide-react'
import { IconBadge } from '../components/ui/Badge'
import { Card, CardHeader } from '../components/ui/Card'
import { Chips, PageSkeleton, Slider, Stepper, TextField } from '../components/ui/controls'
import { usePageSubtitle } from '../context/metaContext'
import { useToast } from '../context/toastContext'
import '../profile.css'

export { Onboarding } from './OnboardingForm'

const EMPTY = {
  name: '', age: 21, gender: '', height_cm: 170, weight_kg: 65, playing_level: '', main_goal: '',
  injury_status: 'None', injury_body_part: '', pain_level: 0, diet_type: '',
}

const OPTIONS = {
  gender: ['Male', 'Female', 'Other', 'Prefer not to say'],
  playing_level: ['Beginner', 'Intermediate', 'Advanced'],
  main_goal: ['Stamina', 'Footwork', 'Strength', 'Technique', 'Match performance', 'General fitness'],
  injury_status: ['None', 'Recovering', 'Current'],
  diet_type: ['Vegetarian', 'Non-vegetarian', 'Vegan', 'Eggetarian'],
}

const fromServer = (p) => ({ ...EMPTY, ...p, injury_body_part: p.injury_body_part ?? '' })

function validate(f) {
  if (!f.name.trim()) return 'Please enter your name.'
  if (f.age === '' || f.age < 10 || f.age > 90) return 'Age must be between 10 and 90.'
  if (!f.gender) return 'Please choose a gender.'
  if (f.height_cm === '' || f.height_cm < 100 || f.height_cm > 250) return 'Height must be between 100 and 250 cm.'
  if (f.weight_kg === '' || f.weight_kg < 25 || f.weight_kg > 200) return 'Weight must be between 25 and 200 kg.'
  if (!f.playing_level) return 'Please choose your playing level.'
  if (!f.main_goal) return 'Please choose a main goal.'
  if (!f.diet_type) return 'Please choose a diet type.'
  if (f.injury_status !== 'None' && !f.injury_body_part.trim()) return 'Please tell us which body part is injured.'
  return ''
}

/** Editing later, inside the app layout. */
export default function Profile() {
  const { refresh } = useAuth()
  const toast = useToast()
  usePageSubtitle('Your details, goals and injury')
  const [initial, setInitial] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    api('/profile')
      .then((p) => {
        const f = fromServer(p)
        setInitial(f)
        setForm(f)
      })
      .catch((e) => setError(e.message))
  }, [])

  const dirty = useMemo(() => initial !== null && JSON.stringify(initial) !== JSON.stringify(form), [initial, form])
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const injured = form.injury_status !== 'None'
  const problem = attempted ? validate(form) : ''

  const cancel = () => {
    setForm(initial)
    setError('')
    setAttempted(false)
  }

  const save = async (e) => {
    e.preventDefault()
    setAttempted(true)
    if (validate(form)) return
    setError('')
    setBusy(true)
    try {
      const saved = await api('/profile', {
        method: 'PUT',
        body: {
          ...form,
          name: form.name.trim(),
          age: Number(form.age),
          height_cm: Number(form.height_cm),
          weight_kg: Number(form.weight_kg),
          pain_level: injured ? Number(form.pain_level) : 0,
          injury_body_part: injured ? form.injury_body_part.trim() : null,
        },
      })
      const f = fromServer(saved)
      setInitial(f)
      setForm(f)
      setAttempted(false)
      toast('Profile saved ✓')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!initial && !error) return <PageSkeleton rows={3} />
  if (!initial) return <p className="error-note" role="alert">{error}</p>

  const initialLetter = (form.name || '?').trim().charAt(0).toUpperCase()

  return (
    <form className="pg pf" onSubmit={save} noValidate>
      <div className="pf-grid">
        <Card className="pf-card" aria-label="About you">
          <CardHeader title="About you" subtitle="Used to tailor your plan" action={<IconBadge icon={UserRound} tone="primary" />} />
          <div className="pf-who">
            <span className="pf-avatar" aria-hidden="true">{initialLetter}</span>
            <TextField label="Name" value={form.name} maxLength={100} onChange={(name) => set({ name })} />
          </div>
          <div className="pf-rows">
            <Stepper label="Age" value={form.age} onChange={(age) => set({ age })} min={10} max={90} unit="yrs" />
            <Stepper label="Height" value={form.height_cm} onChange={(height_cm) => set({ height_cm })} min={100} max={250}
              step={1} unit="cm" />
            <Stepper label="Weight" value={form.weight_kg} onChange={(weight_kg) => set({ weight_kg })} min={25} max={200}
              step={0.5} unit="kg" decimals={1} />
          </div>
          <div className="ui-field">
            <span className="ui-label">Gender</span>
            <Chips label="Gender" options={OPTIONS.gender} value={form.gender} onChange={(gender) => set({ gender })} />
          </div>
        </Card>

        <Card className="pf-card" aria-label="Badminton and diet">
          <CardHeader title="Badminton & diet" subtitle="Level, goal and what you eat" action={<IconBadge icon={Dumbbell} tone="info" />} />
          <div className="ui-field">
            <span className="ui-label">Level</span>
            <Chips label="Playing level" options={OPTIONS.playing_level} value={form.playing_level}
              onChange={(playing_level) => set({ playing_level })} />
          </div>
          <div className="ui-field">
            <span className="ui-label">Main goal</span>
            <Chips label="Main goal" options={OPTIONS.main_goal} value={form.main_goal}
              onChange={(main_goal) => set({ main_goal })} />
          </div>
          <div className="ui-field">
            <span className="ui-label">Diet</span>
            <Chips label="Diet type" options={OPTIONS.diet_type} value={form.diet_type}
              onChange={(diet_type) => set({ diet_type })} />
          </div>
        </Card>

        <Card className="pf-card pf-injury" aria-label="Injury">
          <CardHeader title="Injury" subtitle="Used only to keep advice safe" action={<IconBadge icon={Bone} tone="warning" />} />
          <div className="ui-field">
            <span className="ui-label">Status</span>
            <Chips label="Injury status" options={OPTIONS.injury_status} value={form.injury_status}
              onChange={(injury_status) => set({
                injury_status,
                pain_level: injury_status === 'None' ? 0 : form.pain_level,
              })} />
          </div>
          <TextField label="Body part" value={form.injury_body_part} maxLength={60} placeholder="e.g. Right knee"
            disabled={!injured} onChange={(injury_body_part) => set({ injury_body_part })} />
          <Slider label="Pain level" min={0} max={10} value={Number(form.pain_level)} disabled={!injured}
            onChange={(pain_level) => set({ pain_level })} />
          <div className="pf-figure">
            <BodyFigure profile={form} />
          </div>
        </Card>
      </div>

      <div className={`pf-bar${dirty ? ' is-on' : ''}`} inert={!dirty && !busy}>
        {(error || problem) ? <span className="pf-bar-err" role="alert">{error || problem}</span>
          : <span className="pf-bar-msg">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>}
        <button type="button" className="btn btn-secondary" onClick={cancel} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}
