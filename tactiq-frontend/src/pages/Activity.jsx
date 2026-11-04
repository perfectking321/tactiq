import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, Calendar, Dumbbell, Gauge, Pencil, Plus, Search, Timer, Trash2, Trophy } from 'lucide-react'
import { api } from '../api/client'
import { addDays, fromIso, localToday } from '../utils/date'
import { editLink } from '../utils/format'
import { SESSION_ICON } from '../utils/sessionStyle'
import { makeDelta, periodRange, previousRange } from '../components/dashboard/model'
import { Badge, IconBadge } from '../components/ui/Badge'
import { Card, CardHeader } from '../components/ui/Card'
import { Skeleton } from '../components/ui/controls'
import KpiCard from '../components/ui/KpiCard'
import Menu from '../components/ui/Menu'
import Segmented from '../components/ui/Segmented'
import ShuttleIcon from '../components/ui/ShuttleIcon'
import { usePageSubtitle } from '../context/metaContext'
import { useToast } from '../context/toastContext'
import '../activity.css'

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'training', label: 'Training' },
  { value: 'matches', label: 'Matches' },
]
const PERIODS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 'all', label: 'All time' },
]

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const r1 = (n) => (n === null ? null : Math.round(n * 10) / 10)
const sum = (xs) => xs.reduce((a, b) => a + b, 0)

function dateLabel(iso, today) {
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  return fromIso(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function metrics(sessions, matches) {
  const wins = matches.filter((m) => m.result === 'Win').length
  const mins = sum(sessions.map((s) => s.duration_min))
  return {
    n: sessions.length,
    mins,
    hours: r1(mins / 60),
    effort: r1(avg(sessions.map((s) => s.rpe))),
    load: sum(sessions.map((s) => s.load)),
    mCount: matches.length,
    wins,
    losses: matches.filter((m) => m.result === 'Loss').length,
    winRate: matches.length ? Math.round((wins / matches.length) * 100) : null,
    rating: r1(avg(matches.map((m) => m.self_rating))),
  }
}

/** One number per day of the range (last 60 days) for the sparklines. */
function daily(range, items, f) {
  const by = new Map()
  for (const it of items) by.set(it.date, [...(by.get(it.date) ?? []), it])
  const out = []
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) out.push(f(by.get(d) ?? []))
  return out.slice(-60)
}

function buildKpis(tab, cur, prev, sessions, matches, range) {
  const p = prev
  const dPct = (a, b) => (p ? makeDelta(a, b, { mode: 'pct', digits: 0 }) : null)
  const spSessions = daily(range, sessions, (xs) => xs.length)
  const spMinutes = daily(range, sessions, (xs) => sum(xs.map((s) => s.duration_min)) / 60)
  const spEffort = daily(range, sessions, (xs) => (xs.length ? avg(xs.map((s) => s.rpe)) : null))
  const spLoad = daily(range, sessions, (xs) => sum(xs.map((s) => s.load)))
  let net = 0
  const spMatch = [...matches].sort((a, b) => (a.date < b.date ? -1 : 1)).map((m) => (net += m.result === 'Win' ? 1 : -1))
  const spRating = [...matches].sort((a, b) => (a.date < b.date ? -1 : 1)).map((m) => m.self_rating)

  const kSessions = { label: 'Sessions', icon: Timer, tone: 'primary', value: cur.n, delta: dPct(cur.n, p?.n), context: 'training sessions', spark: spSessions }
  const kHours = { label: 'Training hours', icon: Dumbbell, tone: 'info', value: cur.hours, decimals: 1, unit: 'h', delta: dPct(cur.mins, p?.mins), context: 'total time trained', spark: spMinutes }
  const kEffort = {
    label: 'Avg effort', icon: Gauge, tone: 'warning', value: cur.effort, decimals: 1, unit: '/ 10',
    delta: p ? makeDelta(cur.effort, p.effort, { mode: 'abs' }) : null, context: 'how hard sessions felt', spark: spEffort,
  }
  const kLoad = { label: 'Total load', icon: Gauge, tone: 'warning', value: cur.load, delta: dPct(cur.load, p?.load), context: 'minutes × effort', spark: spLoad }
  const kRecord = {
    label: 'Matches', icon: Trophy, tone: 'success', value: undefined,
    valueNode: <span className="num">{cur.wins} – {cur.losses}</span>,
    delta: p ? makeDelta(cur.winRate, p.winRate, { mode: 'pp', digits: 0 }) : null,
    context: cur.mCount ? `${cur.mCount} played · ${cur.winRate}% win rate` : 'no matches', spark: spMatch,
  }
  const kCount = { label: 'Matches played', icon: ShuttleIcon, tone: 'primary', value: cur.mCount, delta: dPct(cur.mCount, p?.mCount), context: 'in this period', spark: spMatch }
  const kRate = {
    label: 'Win rate', icon: Trophy, tone: 'success', value: cur.winRate, unit: '%',
    delta: p ? makeDelta(cur.winRate, p.winRate, { mode: 'pp', digits: 0 }) : null, context: `${cur.wins} wins – ${cur.losses} losses`, spark: spMatch,
  }
  const kRating = {
    label: 'Avg rating', icon: Gauge, tone: 'warning', value: cur.rating, decimals: 1, unit: '/ 10',
    delta: p ? makeDelta(cur.rating, p.rating, { mode: 'abs' }) : null, context: 'self-rated performance', spark: spRating,
  }
  if (tab === 'training') return [kSessions, kHours, kEffort, kLoad]
  if (tab === 'matches') return [kCount, { ...kRecord, label: 'Record', icon: ShuttleIcon, tone: 'primary' }, kRate, kRating]
  return [kSessions, kHours, kRecord, kEffort]
}

function SortHead({ id, sort, onSort, children, className }) {
  const on = sort.key === id
  const Icon = !on ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={className} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`sort-btn${on ? ' is-on' : ''}`} onClick={() => onSort(id)}>
        {children}<Icon size={13} />
      </button>
    </th>
  )
}

function EffortBar({ value }) {
  return (
    <span className="effort" title={`Effort ${value} of 10`}>
      <span className="effort-bar"><span style={{ width: `${value * 10}%` }} /></span>
      <b className="num">{value}</b>
    </span>
  )
}

function Row({ e, today, confirming, busy, onAskDelete, onCancel, onDelete }) {
  const isMatch = e.kind === 'match'
  const Icon = isMatch ? ShuttleIcon : (SESSION_ICON[e.type] ?? Timer)
  const editTo = editLink(e)
  return (
    <tr>
      <td className="muted-cell col-date">{dateLabel(e.date, today)}</td>
      <td>
        <span className="act-cell">
          <IconBadge icon={Icon} tone={isMatch ? (e.result === 'Win' ? 'success' : 'danger') : 'primary'} size={16} />
          <span className="act-two">
            <Link to={editTo} className="act-name">{isMatch ? `vs ${e.opponent}` : e.type}</Link>
            <span className="act-sub">{isMatch ? 'Match' : 'Training session'}</span>
          </span>
        </span>
      </td>
      <td className="col-details">
        {isMatch ? <span className="num">{e.format} · {e.game_scores.split(',').join('  ')}</span> : <span className="num">{e.duration_min} min</span>}
      </td>
      <td>
        {isMatch
          ? <Badge tone={e.result === 'Win' ? 'success' : 'danger'} dot>{e.result === 'Win' ? 'WIN' : 'LOSS'}</Badge>
          : <EffortBar value={e.rpe} />}
      </td>
      <td className="col-notes act-notes-hide"><span className="note-cell" title={e.notes || undefined}>{e.notes || '–'}</span></td>
      <td className="col-menu">
        {confirming ? (
          <span className="row-confirm">
            <span>Delete?</span>
            <button type="button" className="link-action cp-danger" disabled={busy} onClick={onDelete}>Yes</button>
            <button type="button" className="link-action" onClick={onCancel}>No</button>
          </span>
        ) : (
          <Menu variant="icon" align="right" ariaLabel={`Actions for ${isMatch ? `match vs ${e.opponent}` : e.type}`}
            options={[
              { value: 'edit', label: 'Edit', icon: Pencil, to: editTo },
              { value: 'delete', label: 'Delete', icon: Trash2, danger: true, onSelect: onAskDelete },
            ]} />
        )}
      </td>
    </tr>
  )
}

export default function Activity() {
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab = TABS.some((t) => t.value === tabParam) ? tabParam : 'all'
  const [period, setPeriod] = useState(30)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const today = localToday()
  usePageSubtitle('Training sessions and matches')

  useEffect(() => {
    Promise.all([api('/training'), api('/matches')])
      .then(([sessions, matches]) => setData({ sessions, matches }))
      .catch((e) => setError(e.message))
  }, [])

  const range = useMemo(
    () => periodRange(period, today, { sessions: data?.sessions ?? [], matches: data?.matches ?? [], checkins: [] }),
    [period, today, data],
  )
  const prevR = useMemo(() => previousRange(range, period), [range, period])
  const inR = (r) => (x) => x.date >= r.start && x.date <= r.end
  const sessions = useMemo(() => (data?.sessions ?? []).filter(inR(range)), [data, range]) // eslint-disable-line react-hooks/exhaustive-deps
  const matches = useMemo(() => (data?.matches ?? []).filter(inR(range)), [data, range]) // eslint-disable-line react-hooks/exhaustive-deps
  const prevSessions = useMemo(() => (prevR ? (data?.sessions ?? []).filter(inR(prevR)) : []), [data, prevR]) // eslint-disable-line react-hooks/exhaustive-deps
  const prevMatches = useMemo(() => (prevR ? (data?.matches ?? []).filter(inR(prevR)) : []), [data, prevR]) // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = useMemo(() => {
    const cur = metrics(sessions, matches)
    const prevM = prevR && (prevSessions.length || prevMatches.length) ? metrics(prevSessions, prevMatches) : null
    return buildKpis(tab, cur, prevM, sessions, matches, range)
  }, [tab, sessions, matches, prevSessions, prevMatches, prevR, range])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = [
      ...(tab !== 'matches' ? sessions.map((s) => ({ ...s, kind: 'session' })) : []),
      ...(tab !== 'training' ? matches.map((m) => ({ ...m, kind: 'match' })) : []),
    ].filter((e) => !q || [e.type, e.opponent, e.format, e.notes, e.result].some((t) => (t || '').toLowerCase().includes(q)))
    const val = { date: (e) => e.date, duration: (e) => (e.kind === 'session' ? e.duration_min : null), effort: (e) => (e.kind === 'session' ? e.rpe : e.self_rating) }[sort.key]
    const dir = sort.dir === 'asc' ? 1 : -1
    return items.sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (va === null && vb === null) return b.id - a.id
      if (va === null) return 1
      if (vb === null) return -1
      if (va === vb) return b.date === a.date ? b.id - a.id : a.date < b.date ? 1 : -1
      return (va < vb ? -1 : 1) * dir
    })
  }, [tab, sessions, matches, query, sort])

  const setTab = (value) => setParams(value === 'all' ? {} : { tab: value }, { replace: true })
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date' ? 'desc' : 'desc' }))

  const remove = async (e) => {
    setBusy(true)
    try {
      await api(`${e.kind === 'match' ? '/matches' : '/training'}/${e.id}`, { method: 'DELETE' })
      setData((d) => ({
        sessions: e.kind === 'session' ? d.sessions.filter((s) => s.id !== e.id) : d.sessions,
        matches: e.kind === 'match' ? d.matches.filter((m) => m.id !== e.id) : d.matches,
      }))
      toast(e.kind === 'match' ? 'Match deleted' : 'Session deleted')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  if (error && !data) return <p className="error-note" role="alert">{error}</p>

  const logTo = tab === 'matches' ? '/activity/new?type=match' : '/activity/new?type=session'
  const total = tab === 'matches' ? data?.matches.length : tab === 'training' ? data?.sessions.length : (data?.sessions.length ?? 0) + (data?.matches.length ?? 0)
  const periodLabel = PERIODS.find((p) => p.value === period).label

  const action = (
    <>
      <Segmented label="Activity type" options={TABS} value={tab} onChange={setTab} />
      <label className="search">
        <Search size={15} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search activity" />
      </label>
      <Menu icon={Calendar} label={periodLabel} value={period} onChange={setPeriod} options={PERIODS} ariaLabel="Period" />
    </>
  )

  return (
    <div className="pg act">
      <div className="act-kpis">
        {data
          ? kpis.map((k) => <KpiCard key={k.label} {...k} />)
          : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="act-kpi-skel" />)}
      </div>

      <Card className="act-card" aria-label="Activity table">
        <CardHeader title="All activity" subtitle={data ? `${rows.length} of ${total} entries · ${periodLabel.toLowerCase()}` : 'Loading'} action={action} />
        {error && <p className="error-note" role="alert">{error}</p>}
        {!data ? (
          <div className="act-skels">{[0, 1, 2, 3].map((i) => <Skeleton key={i} style={{ height: '3.2em' }} />)}</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <p>
              {query ? 'No entries match your search.'
                : total ? 'Nothing in this period.'
                  : tab === 'matches' ? 'No matches logged yet.' : tab === 'training' ? 'No sessions logged yet.' : 'No activity logged yet.'}
            </p>
            <Link to={logTo} className="btn btn-primary btn-sm"><Plus size={14} /> {tab === 'matches' ? 'Log match' : 'Log session'}</Link>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl act-tbl">
              <thead>
                <tr>
                  <SortHead id="date" sort={sort} onSort={onSort} className="col-date">Date</SortHead>
                  <th>Activity</th>
                  <SortHead id="duration" sort={sort} onSort={onSort} className="col-details">Details</SortHead>
                  <SortHead id="effort" sort={sort} onSort={onSort}>Effort / result</SortHead>
                  <th className="col-notes act-notes-hide">Notes</th>
                  <th className="col-menu"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const key = `${e.kind}-${e.id}`
                  return (
                    <Row key={key} e={e} today={today} busy={busy} confirming={confirm === key}
                      onAskDelete={() => setConfirm(key)} onCancel={() => setConfirm(null)} onDelete={() => remove(e)} />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
