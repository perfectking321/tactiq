/**
 * Renders the small subset of Markdown the coach uses (paragraphs, **bold**, bullet and numbered
 * lists, ### headings) plus [n] citation markers - as React elements, never as raw HTML.
 * Citations are focusable chips; hover/focus shows the source title + section when `sources` is given.
 */

function Cite({ n, source }) {
  if (!source) return <sup className="cite">{n}</sup>
  return (
    <sup className="cite-wrap">
      <span className="cite" tabIndex={0} aria-label={`Source ${n}: ${source.title}, ${source.section}`}>{n}</span>
      <span className="cite-pop" role="tooltip">
        <b>{source.title}</b>
        <span>{source.section}</span>
      </span>
    </sup>
  )
}

function inline(raw, keyPrefix, sources) {
  // a whole line wrapped in single asterisks is italic: drop the markers
  const text = raw.replace(/^\*(?![*\s])(.*)\*$/, '$1')
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).filter(Boolean)
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>
    const cite = part.match(/^\[(\d+)\]$/)
    if (cite) {
      const source = sources?.find((s) => String(s.ref).replace(/\D/g, '') === cite[1])
      return <Cite key={key} n={cite[1]} source={source} />
    }
    return part.replace(/\*([^*]+)\*/g, '$1')
  })
}

export default function RichText({ text, sources }) {
  const blocks = []
  let list = null

  const flush = () => {
    if (list) blocks.push(list)
    list = null
  }

  text.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    const bullet = line.match(/^[-*•]\s+(.*)/)
    const numbered = line.match(/^\d+[.)]\s+(.*)/)
    if (bullet || numbered) {
      const type = bullet ? 'ul' : 'ol'
      if (!list || list.type !== type) {
        flush()
        list = { type, items: [] }
      }
      list.items.push(inline((bullet || numbered)[1], `li${i}`, sources))
      return
    }
    flush()
    if (!line) return
    const heading = line.match(/^#{1,4}\s+(.*)/)
    blocks.push({ type: heading ? 'h' : 'p', content: inline(heading ? heading[1] : line, `p${i}`, sources) })
  })
  flush()

  return (
    <div className="rich-text">
      {blocks.map((b, i) => {
        if (b.type === 'ul' || b.type === 'ol') {
          const List = b.type
          return <List key={i}>{b.items.map((item, j) => <li key={j}>{item}</li>)}</List>
        }
        if (b.type === 'h') return <p key={i} className="rich-heading">{b.content}</p>
        return <p key={i}>{b.content}</p>
      })}
    </div>
  )
}
