import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Ellipsis } from 'lucide-react'

/**
 * Popover menu (portal'ed, position: fixed under the trigger). Keyboard: Enter/Space/ArrowDown opens,
 * arrows move, Esc closes and returns focus. Click outside closes.
 *
 * Props:
 *  variant   'pill' (label + chevron) | 'icon' (the "..." button) | 'custom' (renderTrigger)
 *  options   [{ value, label, icon?, to?, danger?, onSelect? }]  - with `onChange` items are radio items
 *  header    optional node rendered above the items
 */
export default function Menu({
  variant = 'pill', label, icon: Icon, active = false, options, value, onChange, header, ariaLabel, align = 'left',
  renderTrigger, className = '',
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const setBtn = useCallback((node) => {
    btn.current = node
  }, [])
  const menu = useRef(null)
  const id = useId()
  const radio = onChange !== undefined

  const close = useCallback((refocus) => {
    setOpen(false)
    setPos(null)
    if (refocus === true) btn.current?.focus()
  }, [])

  useLayoutEffect(() => {
    if (!open || !btn.current || !menu.current) return
    const r = btn.current.getBoundingClientRect()
    const w = menu.current.offsetWidth
    const h = menu.current.offsetHeight
    let left = align === 'right' ? r.right - w : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
    let top = r.bottom + 6
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6)
    setPos({ left, top })
  }, [open, align])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) close(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close(true)
      }
    }
    const onScroll = (e) => {
      if (!menu.current?.contains(e.target)) close(false)
    }
    const onResize = () => close(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('scroll', onScroll, true)
    const first = menu.current?.querySelector('[aria-checked="true"]') ?? menu.current?.querySelector('[role^="menuitem"]')
    first?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open, close])

  const onMenuKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...menu.current.querySelectorAll('[role^="menuitem"]')]
    const i = items.indexOf(document.activeElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  const triggerProps = {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    onClick: () => setOpen((o) => !o),
  }

  let trigger
  if (renderTrigger) {
    trigger = renderTrigger({ ...triggerProps, open, triggerRef: setBtn })
  } else if (variant === 'icon') {
    trigger = (
      <button ref={setBtn} type="button" className={`icon-btn${open ? ' is-on' : ''} ${className}`.trim()}
        aria-label={ariaLabel ?? 'More actions'} {...triggerProps}>
        <Ellipsis size={18} />
      </button>
    )
  } else {
    trigger = (
      <button ref={setBtn} type="button" className={`pill-btn${active ? ' is-active' : ''} ${className}`.trim()} aria-label={ariaLabel}
        {...triggerProps}>
        {Icon && <Icon size={15} />}
        <span>{label}</span>
        <ChevronDown size={14} className="pill-caret" />
      </button>
    )
  }

  const select = (o) => {
    if (radio) onChange(o.value)
    o.onSelect?.()
    close(true)
  }

  return (
    <>
      {trigger}
      {open && createPortal(
        <div id={id} ref={menu} className="menu" role="menu" aria-label={ariaLabel ?? label} onKeyDown={onMenuKey}
          style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}>
          {header}
          {options.map((o) => {
            const OIcon = o.icon
            const on = radio && value === o.value
            const cls = `menu-item${on ? ' is-on' : ''}${o.danger ? ' is-danger' : ''}`
            const key = String(o.value ?? o.label)
            const inner = (
              <>
                {OIcon && <OIcon size={16} />}
                {o.label}
                {on && <Check size={14} className="menu-tick" />}
              </>
            )
            if (o.to) {
              return <Link key={key} className={cls} to={o.to} role="menuitem" onClick={() => close(false)}>{inner}</Link>
            }
            return (
              <button key={key} className={cls} type="button" role={radio ? 'menuitemradio' : 'menuitem'}
                aria-checked={radio ? on : undefined} onClick={() => select(o)}>
                {inner}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
