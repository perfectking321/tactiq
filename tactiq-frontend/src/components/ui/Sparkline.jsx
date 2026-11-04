import { useId } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'

/** Tiny gradient area chart (no axes, no tooltip). data: number[] (null gaps allowed). */
export default function Sparkline({ data, color = '#6d5dfc' }) {
  const gid = useId().replace(/:/g, '')
  const rows = data.map((v, i) => ({ i, v }))
  const nums = data.filter((v) => typeof v === 'number')
  const lo = Math.min(...nums)
  const hi = Math.max(...nums)
  const pad = Math.max((hi - lo) * 0.15, 0.5)
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <AreaChart data={rows} margin={{ top: 3, right: 6, bottom: 2, left: 6 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[lo - pad, hi + pad]} />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} fill={`url(#${gid})`} dot={false}
          connectNulls isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
