import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useCoach } from '../../context/coachContext'
import { Badge } from '../ui/Badge'
import { Card, CardHeader } from '../ui/Card'
import BodyFigure from './BodyFigure'
import { displayPart } from './bodyRegions'
import { devOverride, injuryInfo } from './injuryInfo'

/**
 * Pain & injury card: tall card: large body figure (hover the injured area for details) with the summary below.
 * Data comes from the profile (injury_body_part / injury_status / pain_level).
 */
export default function PainCard({ profile: rawProfile }) {
  const { openCoach } = useCoach()
  const profile = devOverride(rawProfile)
  const { status, text, pain, injured, parsed } = injuryInfo(profile)
  const tone = status === 'Current' ? 'danger' : status === 'Recovering' ? 'warning' : 'success'
  const part = parsed.matched ? displayPart(text) : `Couldn't place '${text}'`

  return (
    <Card className="db-pain">
      <CardHeader title="Pain & injury" subtitle="From profile"
        action={<Link to="/profile" className="link-action">Update <ArrowRight size={13} /></Link>} />
      <div className="pain-body">
        <BodyFigure profile={profile} />
        <div className="pain-info">
          {!injured ? (
            <>
              <p className="pain-part">No injuries logged</p>
              <p className="card-muted">Add one in your profile and it shows up here.</p>
            </>
          ) : (
            <>
              <p className="pain-part" title={text}>{part}</p>
              <Badge tone={tone} dot>{status}</Badge>
              <div className="pain-meter">
                <span className="card-muted">Pain</span>
                <div className="kpi-progress" role="progressbar" aria-valuenow={pain} aria-valuemin={0} aria-valuemax={10}
                  aria-label="Pain level">
                  <span style={{ width: `${Math.min(100, pain * 10)}%`, background: status === 'Current' ? 'var(--danger)' : 'var(--warning)' }} />
                </div>
                <b className="num">{pain}/10</b>
              </div>
              <button type="button" className="link-action"
                onClick={() => openCoach(`My ${text.toLowerCase()} is ${status.toLowerCase()} (pain ${pain}/10). What should I change in training?`)}>
                <Sparkles size={13} /> Ask coach
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
