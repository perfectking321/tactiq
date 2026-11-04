import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Timer } from 'lucide-react'
import { editLink, relDate } from '../../utils/format'
import { SESSION_ICON } from '../../utils/sessionStyle'
import { Badge, IconBadge } from '../ui/Badge'
import { Card, CardHeader } from '../ui/Card'
import ShuttleIcon from '../ui/ShuttleIcon'

/** Result / effort badge shared with the Activity table. */
export function ResultBadge({ e }) {
  if (e.kind === 'match') return <Badge tone={e.result === 'Win' ? 'success' : 'danger'} dot>{e.result === 'Win' ? 'WIN' : 'LOSS'}</Badge>
  return <Badge tone="info">Effort {e.rpe}/10</Badge>
}

/** The 5 most recent sessions + matches that pass the dashboard filters. */
export default function RecentActivity({ items, today }) {
  const navigate = useNavigate()
  return (
    <Card className="db-recent">
      <CardHeader title="Recent activity" subtitle="Latest sessions and matches in this view"
        action={<Link to="/activity" className="link-action">View all <ArrowRight size={13} /></Link>} />
      {items.length === 0 ? (
        <div className="empty-state"><p>Nothing logged in this view.</p>
          <Link to="/activity/new" className="btn btn-primary btn-sm">Log activity</Link></div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl tbl--compact">
            <thead>
              <tr><th>Activity</th><th className="col-details">Details</th><th>Result</th><th className="t-num">Date</th></tr>
            </thead>
            <tbody>
              {items.map((e) => {
                const match = e.kind === 'match'
                const Icon = match ? ShuttleIcon : (SESSION_ICON[e.type] ?? Timer)
                return (
                  <tr key={`${e.kind}-${e.id}`} className="row-link" onClick={() => navigate(editLink(e))}>
                    <td>
                      <span className="act-cell">
                        <IconBadge icon={Icon} tone={match ? (e.result === 'Win' ? 'success' : 'danger') : 'primary'} size={16} />
                        <Link to={editLink(e)} className="act-name" onClick={(ev) => ev.stopPropagation()}>
                          {match ? `vs ${e.opponent}` : e.type}
                        </Link>
                      </span>
                    </td>
                    <td className="col-details muted-cell">
                      {match ? `${e.format} · ${e.game_scores.split(',').join('  ')}` : `${e.duration_min} min`}
                    </td>
                    <td><ResultBadge e={e} /></td>
                    <td className="t-num muted-cell">{relDate(e.date, today)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
