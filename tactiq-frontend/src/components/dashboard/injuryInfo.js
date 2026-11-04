import { injuryViews, parseInjury } from './bodyRegions'

/** Normalised view of the injury fields of a profile (or of the profile form while it is being edited). */
export function injuryInfo(profile) {
  const status = profile?.injury_status ?? 'None'
  const text = (profile?.injury_body_part ?? '').trim()
  const pain = Number(profile?.pain_level ?? 0)
  const injured = status !== 'None' && Boolean(text)
  const parsed = parseInjury(injured ? text : '')
  return { status, text, pain, injured, parsed, views: injuryViews(parsed) }
}

/** Dev-only preview without touching the DB: /dashboard?bodymap=Right%20ankle|Current|7 */
export function devOverride(profile) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return profile
  const q = new URLSearchParams(window.location.search).get('bodymap')
  if (q == null) return profile
  const [part = '', status = 'Current', pain = '5'] = q.split('|')
  return { ...profile, injury_body_part: part, injury_status: part ? status : 'None', pain_level: Number(pain) }
}
