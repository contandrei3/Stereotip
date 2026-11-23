import { useState } from 'react'
import { useCollection } from '../data/hooks'
import { addItem, updateItem, removeItem } from '../data/store'
import { useAuth } from '../data/auth'
import { PageHead, AddButton, Empty, Segmented, Modal, Field, MemberSelect, Avatar, Loading, ErrorNote, Fab, confirmDelete } from '../components/ui'
import Icon from '../components/Icon'
import { memberName } from '../config'
import { fmtDate, today, byDate, dateTime, relDays } from '../lib/dates'

export const remindersFor = (rows, memberId) => rows.filter((r) => r.for === 'all' || r.for === memberId)

export function ReminderRow({ r, onEdit }) {
  const overdue = !r.done && dateTime(r.date, r.time) < new Date()
  return (
    <li className={`reminder ${r.done ? 'done' : ''} ${overdue ? 'overdue' : ''}`}>
      <button className={`task-check ${r.done ? 'done' : ''}`} aria-label={r.done ? 'Mark as not done' : 'Mark as done'}
        onClick={() => updateItem('reminders', r.id, { done: !r.done })}>
        {r.done && <Icon name="check" size={16} />}
      </button>
      <div className="grow" role="button" tabIndex={0} onClick={() => onEdit?.(r)} onKeyDown={(e) => e.key === 'Enter' && onEdit?.(r)}>
        <div className="task-title">{r.text}</div>
        <div className="task-meta muted small">
          <Icon name="bell" size={13} /> {fmtDate(r.date)}{r.time ? ` · ${r.time}` : ''}
          {overdue && <span className="overdue"> · overdue</span>}
          <span> · </span>
          {r.for === 'all' ? <span className="tag">Everyone</span> : <><Avatar id={r.for} size={18} /> {memberName(r.for)}</>}
        </div>
      </div>
    </li>
  )
}

export default function Reminders() {
  const { rows, loading, error } = useCollection('reminders')
  const { memberId } = useAuth()
  const [who, setWho] = useState('mine')
  const [form, setForm] = useState(null)
  const list = (who === 'mine' ? remindersFor(rows, memberId) : rows)
  const open = list.filter((r) => !r.done).sort(byDate)
  const done = list.filter((r) => r.done).sort(byDate).reverse()
  return (
    <div className="page">
      <PageHead title="Reminders" sub="Don't forget the cables" action={<AddButton label="Reminder" onClick={() => setForm({})} />} />
      <div className="toolbar"><Segmented options={[['mine', 'For me'], ['all', 'All reminders']]} value={who} onChange={setWho} /></div>
      <ErrorNote error={error} />
      {loading ? <Loading /> : open.length === 0 && done.length === 0
        ? <Empty icon="bell" action={<AddButton label="Reminder" onClick={() => setForm({})} />}>No reminders.</Empty>
        : <>
          {open.length === 0 ? <p className="muted">All caught up.</p> : <ul className="task-list">{open.map((r) => <ReminderRow key={r.id} r={r} onEdit={setForm} />)}</ul>}
          {done.length > 0 && <details className="past"><summary>Done ({done.length})</summary>
            <ul className="task-list">{done.map((r) => <ReminderRow key={r.id} r={r} onEdit={setForm} />)}</ul></details>}
        </>}
      <Fab label="Add reminder" onClick={() => setForm({})} />
      {form && <ReminderForm initial={form} onClose={() => setForm(null)} />}
    </div>
  )
}

function ReminderForm({ initial, onClose }) {
  const { memberId } = useAuth()
  const [f, setF] = useState({ text: '', date: today(), time: '18:00', for: 'all', ...initial })
  const set = (k) => (e) => setF({ ...f, [k]: e.target?.value ?? e })
  const save = async (e) => {
    e.preventDefault()
    const data = { text: f.text.trim(), date: f.date, time: f.time, for: f.for }
    if (f.id) await updateItem('reminders', f.id, data); else await addItem('reminders', { ...data, done: false, createdBy: memberId })
    onClose()
  }
  const del = async () => { if (confirmDelete('this reminder')) { await removeItem('reminders', f.id); onClose() } }
  return (
    <Modal title={f.id ? 'Edit reminder' : 'New reminder'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Reminder"><input value={f.text} onChange={set('text')} required autoFocus placeholder="e.g. Pay for the rehearsal room" /></Field>
        <div className="row2">
          <Field label="Date" hint={relDays(f.date)}><input type="date" value={f.date} onChange={set('date')} required /></Field>
          <Field label="Time"><input type="time" value={f.time} onChange={set('time')} /></Field>
        </div>
        <Field label="For"><MemberSelect allowAll value={f.for} onChange={set('for')} /></Field>
        <button className="btn primary block">{f.id ? 'Save changes' : 'Add reminder'}</button>
        {f.id && <button type="button" className="btn ghost danger block" onClick={del}><Icon name="trash" size={16} /> Delete reminder</button>}
      </form>
    </Modal>
  )
}
