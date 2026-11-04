/** Same formula as tactiq-api app/services/stats.py (wellness_score / wellness_label). */
export function wellnessScore({ sleep_hours, energy, soreness, stress }) {
  const sleep = Math.min(Number(sleep_hours) / 8, 1) * 10
  const parts = [sleep, Number(energy), 11 - Number(soreness), 11 - Number(stress)]
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10)
}

export function wellnessLabel(score) {
  if (score >= 75) return 'Good to train'
  if (score >= 55) return 'Train with care'
  return 'Prioritise recovery'
}

export const LABEL_COLOR = { 'Good to train': '#12b76a', 'Train with care': '#f79009', 'Prioritise recovery': '#f04438' }
