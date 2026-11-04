import { Activity, Dumbbell, Footprints, Moon, Target, Timer, Wind } from 'lucide-react'

/** Badge tone + icon per session type (shared by the dashboard, Plan and Activity). Colour lives in badges only. */
export const SESSION_TONE = {
  Footwork: 'info',
  Strength: 'warning',
  Endurance: 'danger',
  Technique: 'primary',
  'Match practice': 'success',
  Recovery: 'neutral',
  Rest: 'neutral',
}

export const SESSION_DOT = {
  Footwork: '#2e90fa',
  Strength: '#f79009',
  Endurance: '#f04438',
  Technique: '#6d5dfc',
  'Match practice': '#12b76a',
  Recovery: '#98a2b3',
  Rest: '#d0d5dd',
}

export const SESSION_ICON = {
  Footwork: Footprints,
  Strength: Dumbbell,
  Endurance: Activity,
  Technique: Target,
  'Match practice': Timer,
  Recovery: Wind,
  Rest: Moon,
}
