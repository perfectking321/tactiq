import { addDays } from './date'
import { planWeek } from './planUtil'
import { displayPart } from '../components/dashboard/bodyRegions'

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const inRange = (iso, a, b) => iso >= a && iso <= b
const weekdayName = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })

/**
 * 2-3 insight cards computed from the user's own data (no backend call).
 * data = { checkins, profile, sessions, matches, plan }, today = 'YYYY-MM-DD'.
 * Returns [{ id, icon: 'down'|'up'|'injury'|'match'|'sleep'|'load', tone, title, question }].
 */
export function buildInsights(data, today) {
  const out = []
  const { checkins = [], profile, sessions = [], plan } = data
  const a0 = addDays(today, -6)
  const b0 = addDays(today, -13)
  const b1 = addDays(today, -7)

  const cur = checkins.filter((c) => inRange(c.date, a0, today))
  const prev = checkins.filter((c) => inRange(c.date, b0, b1))
  const curAvg = avg(cur.map((c) => c.score))
  const prevAvg = avg(prev.map((c) => c.score))
  if (curAvg !== null && prevAvg !== null && prevAvg > 0) {
    const pct = Math.round(((curAvg - prevAvg) / prevAvg) * 100)
    if (Math.abs(pct) >= 3) {
      out.push(pct < 0
        ? { id: 'wellness', icon: 'down', tone: 'danger', title: `Wellness down ${Math.abs(pct)}% this week`, question: 'Why did my wellness drop this week?' }
        : { id: 'wellness', icon: 'up', tone: 'success', title: `Wellness up ${pct}% this week`, question: "What's helping my wellness this week?" })
    }
  }

  if (profile && profile.injury_status && profile.injury_status !== 'None' && (profile.injury_body_part || '').trim()) {
    const part = displayPart(profile.injury_body_part) || profile.injury_body_part.trim()
    const state = profile.injury_status === 'Recovering' ? 'still recovering' : 'is a current issue'
    out.push({
      id: 'injury', icon: 'injury', tone: 'warning', title: `${part} ${state} · ${profile.pain_level}/10`,
      question: `How should I train around my ${profile.injury_body_part.trim().toLowerCase()}?`,
    })
  }

  if (plan?.plan?.days) {
    const next = planWeek(plan).find((e) => e.iso >= today && e.day?.session_type === 'Match practice')
    if (next) {
      const wd = next.iso === today ? 'today' : weekdayName(next.iso)
      out.push({
        id: 'match', icon: 'match', tone: 'primary', title: `Match practice ${next.iso === today ? 'today' : `on ${wd}`} in your plan`,
        question: `How should I prepare for my match practice ${next.iso === today ? 'today' : `on ${wd}`}?`,
      })
    }
  }

  const sleep = avg(cur.map((c) => c.sleep_hours))
  if (sleep !== null && sleep < 7) {
    out.push({
      id: 'sleep', icon: 'sleep', tone: 'info', title: `Sleep averaging ${(Math.round(sleep * 10) / 10).toFixed(1)} h this week`,
      question: 'How can I improve my sleep for better recovery?',
    })
  }

  const minsCur = sessions.filter((s) => inRange(s.date, a0, today)).reduce((a, s) => a + s.duration_min, 0)
  const minsPrev = sessions.filter((s) => inRange(s.date, b0, b1)).reduce((a, s) => a + s.duration_min, 0)
  if (minsPrev > 0 && minsCur > minsPrev * 1.3) {
    const pct = Math.round(((minsCur - minsPrev) / minsPrev) * 100)
    out.push({
      id: 'load', icon: 'load', tone: 'warning', title: `Training load up ${pct}% this week`,
      question: 'My training load jumped this week. How should I manage it?',
    })
  }
  return out.slice(0, 3)
}

/** Greeting by local hour. */
export function greeting(hour) {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}
