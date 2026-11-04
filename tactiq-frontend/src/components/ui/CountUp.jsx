import { useCountUp } from './useCountUp'

/** <CountUp value={19} /> or <CountUp value={7.4} decimals={1} /> */
export default function CountUp({ value, decimals = 0 }) {
  const v = useCountUp(value)
  if (v === null || v === undefined) return '--'
  return v.toFixed(decimals)
}
