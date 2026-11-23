import { useState } from 'react'
import { addItem, updateItem, removeItem } from '../data/store'
import { useAuth } from '../data/auth'
import { MEMBERS, memberName } from '../config'
import { fmtDate, today, addDays, relDays } from '../lib/dates'
import { Modal, Field, MemberSelect, Avatar, confirmDelete } from './ui'
import Icon from './Icon'

// Away periods: { member, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', reason }
export const isAwayOn = (a, date) => a.from <= date && date <= (a.to || a.from)
export const awayOn = (absences, date) => absences.filter((a) => isAwayOn(a, date))
export const awayMembersOn = (absences, date) => [...new Set(awayOn(absences, date).map((a) => a.member))]
export const overlaps = (a, from, to) => a.from <= to && (a.to || a.from) >= from

export function fmtRange(a) {
  const to = a.to || a.from
  if (a.from === to) return fmtDate(a.from)
  const [fy, fm] = a.from.split('-'), [ty, tm] = to.split('-')
  if (fy === ty && fm === tm) {
    // "12–13 Dec"
    const end = fmtDate(to, { weekday: false })
    if (/^\d/.test(end)) return `${Number(a.from.slice(8))}–${end}`
  }
  return `${fmtDate(a.from, { weekday: false })} – ${fmtDate(to, { weekday: false })}`
}

export function AbsenceRow({ a, onEdit }) {
  const now = isAwayOn(a, today())
  return (
    <li className="absence" role="button" tabIndex={0} onClick={() => onEdit?.(a)} onKeyDown={(e) => e.key === 'Enter' && onEdit?.(a)}>
      <Avatar id={a.member} size={28} />
      <div className="grow">
        <div className="task-title">{memberName(a.member)} <span className="muted">is away</span></div>
        <div className="muted small">{fmtRange(a)}{a.reason ? ` · ${a.reason}` : ''}</div>
      </div>
      {now ? <span className="tag away">Away now</span> : <span className="muted small">{relDays(a.from)}</span>}
    </li>
  )
}

export function AbsenceForm({ initial, onClose }) {
  const { memberId } = useAuth()
  const [f, setF] = useState({ member: memberId, from: initial?.from || today(), to: '', reason: '', ...initial })
  const set = (k) => (e) => setF({ ...f, [k]: e.target?.value ?? e })
  const save = async (e) => {
    e.preventDefault()
    const to = f.to && f.to >= f.from ? f.to : f.from
    const data = { member: f.member, from: f.from, to, reason: f.reason.trim() }
    if (f.id) await updateItem('absences', f.id, data); else await addItem('absences', data)
    onClose()
  }
  const del = async () => { if (confirmDelete('this away period')) { await removeItem('absences', f.id); onClose() } }
  return (
    <Modal title={f.id ? 'Edit away period' : "I can't rehearse"} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <p className="muted small">Mark the days you're out of town or busy, so nobody schedules a rehearsal then.</p>
        <Field label="Who"><MemberSelect required value={f.member} onChange={set('member')} /></Field>
        <div className="row2">
          <Field label="From"><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: f.to && f.to < e.target.value ? e.target.value : f.to })} required /></Field>
          <Field label="To" hint="Leave empty for one day"><input type="date" value={f.to} min={f.from} onChange={set('to')} /></Field>
        </div>
        <div className="quick-range">
          {[['1 day', 0], ['Weekend', null], ['1 week', 6], ['2 weeks', 13]].map(([label, n]) => (
            <button type="button" key={label} className="chip" onClick={() => {
              if (n === null) {
                const d = new Date(f.from + 'T00:00'); const toSat = (6 - d.getDay() + 7) % 7
                const sat = addDays(f.from, toSat); setF({ ...f, from: sat, to: addDays(sat, 1) })
              } else setF({ ...f, to: addDays(f.from, n) })
            }}>{label}</button>
          ))}
        </div>
        <Field label="Reason (optional)"><input value={f.reason} onChange={set('reason')} placeholder="e.g. Out of town, exams, vacation" /></Field>
        <button className="btn primary block">{f.id ? 'Save changes' : 'Save'}</button>
        {f.id && <button type="button" className="btn ghost danger block" onClick={del}><Icon name="trash" size={16} /> Delete</button>}
      </form>
    </Modal>
  )
}

/** "Away: Mario, David" note for a given date (used in event forms / day panel). */
export function AwayNote({ absences, date, className = '' }) {
  const list = awayOn(absences, date)
  if (!list.length) return null
  return (
    <div className={`away-note ${className}`}>
      <Icon name="away" size={16} />
      <span>
        <strong>Away:</strong>{' '}
        {list.map((a, i) => (
          <span key={a.id}>{i > 0 && ', '}{memberName(a.member)}{a.reason ? <span className="muted"> ({a.reason})</span> : ''}</span>
        ))}
        {list.length >= MEMBERS.length - 1 && <span className="muted"> · probably not a rehearsal day</span>}
      </span>
    </div>
  )
}
