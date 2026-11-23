import { useEffect, useState } from 'react'
import { MEMBERS, memberById } from '../config'
import { LOGO_SRC, LOGO_FALLBACK } from '../lib/theme'
import Icon from './Icon'

export function Logo({ size = 36 }) {
  const [src, setSrc] = useState(LOGO_SRC)
  return <img className="logo" src={src} alt="Stereo.tip" style={{ height: size }}
    onError={() => src !== LOGO_FALLBACK && setSrc(LOGO_FALLBACK)} />
}

export function Avatar({ id, size = 28, title }) {
  const m = memberById(id)
  if (!m) return <span className="avatar" style={{ width: size, height: size }}>?</span>
  return (
    <span className="avatar" title={title ?? m.name}
      style={{ width: size, height: size, fontSize: size * 0.42, background: m.color }}>
      {m.name[0]}
    </span>
  )
}

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll') }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, hint, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function MemberSelect({ value, onChange, allowAll = false, allLabel = 'Everyone', required }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required}>
      {allowAll && <option value="all">{allLabel}</option>}
      {!allowAll && !required && <option value="">—</option>}
      {MEMBERS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  )
}

export function Segmented({ options, value, onChange, small }) {
  return (
    <div className={`segmented ${small ? 'small' : ''}`} role="tablist">
      {options.map((o) => {
        const [v, label] = Array.isArray(o) ? o : [o, o]
        return (
          <button key={v} type="button" role="tab" aria-selected={value === v}
            className={value === v ? 'active' : ''} onClick={() => onChange(v)}>{label}</button>
        )
      })}
    </div>
  )
}

export function Empty({ icon = 'list', children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <p>{children}</p>
      {action}
    </div>
  )
}

export function PageHead({ title, sub, action }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function AddButton({ onClick, label = 'Add' }) {
  return (
    <button className="btn primary" onClick={onClick}>
      <Icon name="plus" size={18} /> <span>{label}</span>
    </button>
  )
}

export function Fab({ onClick, label }) {
  return (
    <button className="fab" onClick={onClick} aria-label={label}><Icon name="plus" size={26} /></button>
  )
}

export function Loading() {
  return <div className="loading"><span /><span /><span /></div>
}

export function ErrorNote({ error }) {
  if (!error) return null
  return <div className="error-note">Couldn't load data: {error.code || error.message}. Check your connection or Firestore rules.</div>
}

export function confirmDelete(what = 'this') {
  return window.confirm(`Delete ${what}? This can't be undone.`)
}

export function isUrl(s) { return /^https?:\/\//i.test(s || '') }
export function linkLabel(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    if (h.includes('youtu')) return 'YouTube'
    if (h.includes('songsterr')) return 'Songsterr'
    if (h.includes('ultimate-guitar')) return 'Ultimate Guitar'
    if (h.includes('spotify')) return 'Spotify'
    if (h.includes('drive.google')) return 'Google Drive'
    return h
  } catch { return url }
}
