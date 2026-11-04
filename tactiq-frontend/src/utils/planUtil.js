import { useCallback, useEffect, useState } from 'react'
import { addDays, fromIso, toIso, weekdayName } from './date'

export const stripCitations = (text) => (text || '').replace(/\s*\[\d+\]/g, '').trim()
export const dayMonth = (iso) => fromIso(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
export const shortDay = (iso) => fromIso(iso).toLocaleDateString('en-GB', { weekday: 'short' })
export const longDayLabel = (iso) =>
  fromIso(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
// Safety notices added by the server's guardrail start with one of these.
export const isWarning = (note) => /^\*\*(Please stop|Recommendation)/.test(note || '')

/** The 7 dates a plan covers (from the day it was generated), each matched to its weekday entry. */
export function planWeek(plan) {
  const start = toIso(new Date(plan.created_at))
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(start, i)
    return { iso, day: plan.plan.days.find((d) => d.day === weekdayName(iso)) }
  })
}

/**
 * Which plan entry the dashboard "Today" card shows: today's if it is in the plan,
 * else the next upcoming day. status: 'none' | 'finished' | 'ok'.
 */
export function pickPlanDay(plan, today) {
  if (!plan) return { status: 'none' }
  const week = planWeek(plan)
  if (today > week[6].iso) return { status: 'finished' }
  const entry = week.find((e) => e.iso === today) || week.find((e) => e.iso > today) || week[0]
  return { status: 'ok', entry, isToday: entry.iso === today }
}

const doneKey = (iso) => `tactiq_day_done_${iso}`
const readDone = (iso) => {
  try {
    return localStorage.getItem(doneKey(iso)) === '1'
  } catch {
    return false
  }
}

/** "Mark done" state per calendar date in localStorage; stays in sync across components and tabs. */
export function useDayDone() {
  const [, bump] = useState(0)
  useEffect(() => {
    const on = () => bump((n) => n + 1)
    window.addEventListener('tactiq:done', on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener('tactiq:done', on)
      window.removeEventListener('storage', on)
    }
  }, [])
  const toggle = useCallback((iso) => {
    try {
      if (readDone(iso)) localStorage.removeItem(doneKey(iso))
      else localStorage.setItem(doneKey(iso), '1')
    } catch {
      // ticks are a convenience only
    }
    window.dispatchEvent(new Event('tactiq:done'))
  }, [])
  return [readDone, toggle]
}
