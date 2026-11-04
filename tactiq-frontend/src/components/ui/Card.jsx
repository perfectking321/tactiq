/** Standard card. Every card in the app uses CardHeader so titles/actions line up everywhere. */
export function Card({ as: Tag = 'section', className = '', children, ...rest }) {
  return <Tag className={`ui-card ${className}`.trim()} {...rest}>{children}</Tag>
}

/** title (15-16/600) + optional muted subtitle on the left; optional action node on the right. */
export function CardHeader({ title, subtitle, action, id }) {
  return (
    <header className="ui-card-head">
      <div className="ui-card-titles">
        <h2 className="ui-card-title" id={id}>{title}</h2>
        {subtitle && <p className="ui-card-sub">{subtitle}</p>}
      </div>
      {action && <div className="ui-card-action">{action}</div>}
    </header>
  )
}
