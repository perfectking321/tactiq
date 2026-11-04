import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'
import AuthShell from '../components/AuthShell'

const EMPTY = {
  name: '',
  age: '',
  gender: '',
  height_cm: '',
  weight_kg: '',
  playing_level: '',
  main_goal: '',
  injury_status: 'None',
  injury_body_part: '',
  pain_level: 0,
  diet_type: '',
}

const OPTIONS = {
  gender: ['Male', 'Female', 'Other', 'Prefer not to say'],
  playing_level: ['Beginner', 'Intermediate', 'Advanced'],
  main_goal: ['Stamina', 'Footwork', 'Strength', 'Technique', 'Match performance', 'General fitness'],
  injury_status: ['None', 'Recovering', 'Current'],
  diet_type: ['Vegetarian', 'Non-vegetarian', 'Vegan', 'Eggetarian'],
}

function Select({ id, label, value, onChange, options, placeholder = 'Select' }) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

function ProfileForm({ onSaved, submitLabel }) {
  const [form, setForm] = useState(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/profile')
      .then((p) => setForm({ ...EMPTY, ...p, injury_body_part: p.injury_body_part ?? '' }))
      .catch(() => {}) // 404 = no profile yet; keep the empty form
      .finally(() => setLoaded(true))
  }, [])

  const set = (field) => (value) => {
    setSaved(false)
    setForm((f) => ({ ...f, [field]: value }))
  }
  const injured = form.injury_status !== 'None'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/profile', {
        method: 'PUT',
        body: {
          ...form,
          age: Number(form.age),
          height_cm: Number(form.height_cm),
          weight_kg: Number(form.weight_kg),
          pain_level: injured ? Number(form.pain_level) : 0,
          injury_body_part: injured ? form.injury_body_part.trim() : null,
        },
      })
      setSaved(true)
      await onSaved?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return <p className="dash-muted">Loading profile…</p>

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      <fieldset className="form-section">
        <legend>About you</legend>
        <div className="form-field">
          <label htmlFor="p-name">Name</label>
          <input id="p-name" value={form.name} onChange={(e) => set('name')(e.target.value)} required maxLength={100} />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="p-age">Age</label>
            <input id="p-age" type="number" min="10" max="90" value={form.age}
              onChange={(e) => set('age')(e.target.value)} required />
          </div>
          <Select id="p-gender" label="Gender" value={form.gender} onChange={set('gender')} options={OPTIONS.gender} />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="p-height">Height (cm)</label>
            <input id="p-height" type="number" min="100" max="250" step="0.5" value={form.height_cm}
              onChange={(e) => set('height_cm')(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="p-weight">Weight (kg)</label>
            <input id="p-weight" type="number" min="25" max="200" step="0.1" value={form.weight_kg}
              onChange={(e) => set('weight_kg')(e.target.value)} required />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Badminton & diet</legend>
        <div className="form-row">
          <Select id="p-level" label="Playing level" value={form.playing_level} onChange={set('playing_level')}
            options={OPTIONS.playing_level} />
          <Select id="p-goal" label="Main goal" value={form.main_goal} onChange={set('main_goal')}
            options={OPTIONS.main_goal} />
        </div>
        <Select id="p-diet" label="Diet type" value={form.diet_type} onChange={set('diet_type')}
          options={OPTIONS.diet_type} />
      </fieldset>

      <fieldset className="form-section">
        <legend>Injury</legend>
        <Select id="p-injury" label="Do you have an injury right now?" value={form.injury_status}
          onChange={set('injury_status')} options={OPTIONS.injury_status} placeholder={null} />
        {injured && (
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="p-bodypart">Which body part?</label>
              <input id="p-bodypart" placeholder="e.g. Right knee" value={form.injury_body_part}
                onChange={(e) => set('injury_body_part')(e.target.value)} required maxLength={60} />
            </div>
            <div className="form-field">
              <label htmlFor="p-pain">Pain level: {form.pain_level}/10</label>
              <input id="p-pain" type="range" min="0" max="10" value={form.pain_level}
                onChange={(e) => set('pain_level')(e.target.value)} />
            </div>
          </div>
        )}
        <p className="field-hint">
          TactiQ uses this only to keep advice safe. It is not a medical diagnosis tool.
        </p>
      </fieldset>

      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && !onSaved && <p className="form-success">Profile saved.</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

/** First-time setup, shown right after sign-up (no sidebar). */
export function Onboarding() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  return (
    <AuthShell wide title="Set up your player profile"
      subtitle="Takes one minute. Your AI coach uses this to personalise every answer and plan.">
      <ProfileForm
        submitLabel="Save and continue →"
        onSaved={async () => {
          await refresh()
          navigate('/dashboard', { replace: true })
        }}
      />
    </AuthShell>
  )
}
