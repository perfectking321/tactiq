// Accounts used on this device, shown as profile cards on the login screen.
// Only name + email are stored - never passwords or tokens.
const KEY = 'tactiq_saved_profiles'
const MAX = 6

export function getSavedProfiles() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function rememberProfile({ email, name }) {
  try {
    const rest = getSavedProfiles().filter((p) => p.email !== email)
    const next = [{ email, name: name || '', lastUsed: Date.now() }, ...rest].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage unavailable - saved profiles are a convenience only
  }
}

export function forgetProfile(email) {
  try {
    localStorage.setItem(KEY, JSON.stringify(getSavedProfiles().filter((p) => p.email !== email)))
  } catch {
    // ignore
  }
}

export function initials(nameOrEmail) {
  const parts = (nameOrEmail || '?').split('@')[0].split(/[\s._-]+/).filter(Boolean)
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase()
}
