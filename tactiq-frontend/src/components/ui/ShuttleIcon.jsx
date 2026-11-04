/** Badminton shuttlecock, drawn in the same 24px / 2px-stroke style as the lucide icons. */
export default function ShuttleIcon({ size = 24, strokeWidth = 2, className = '', ...rest }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={`lucide lucide-shuttle ${className}`.trim()} aria-hidden="true" {...rest}>
      <circle cx="6.5" cy="17.5" r="3" />
      <path d="M9 15 17.5 6.5" />
      <path d="M11.5 19.5 20 11l-3-3" />
      <path d="M8.5 12.5 13 8l3 3" />
      <path d="M14 5l5 5" />
    </svg>
  )
}
