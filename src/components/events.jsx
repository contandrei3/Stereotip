import { useState } from 'react'
import { MEMBERS } from '../config'
import { addItem, updateItem, removeItem } from '../data/store'
import { useAuth } from '../data/auth'
import { useCollection } from '../data/hooks'
import { fmtDate, relDays, today, fmtDuration } from '../lib/dates'
import { Modal, Field, Avatar, Segmented, confirmDelete } from './ui'
import Icon from './Icon'

export const TYPE_LABEL = { rehearsal: 'Rehearsal', gig: 'Gig' }
export const eventTitle = (e) => e.title?.trim() || TYPE_LABEL[e.type] || 'Event'

export function AvailabilitySummary({ event }) {
  const a = event.availability || {}
  return (
    <div className="avail-row">
      {MEMBERS.map((m) => (
        <span key={m.id} className={`avail-dot ${a[m.id] || 'unknown'}`} title={`${m.name}: ${a[m.id] === 'yes' ? 'can make it' : a[m.id] === 'no' ? "can't make it" : 'no answer yet'}`}>
          <Avatar id={m.id} size={24} />
        </span>
      ))}
    </div>
  )
}

export function MyAvailability({ event }) {
  const { memberId } = useAuth()
  const mine = event.availability?.[memberId]
  const set = (v) => updateItem('events', event.id, { [`availability.${memberId}`]: mine === v ? null : v })
  return (
    <div className="my-avail">
      <button className={`chip yes ${mine === 'yes' ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); set('yes') }}>
        <Icon name="check" size={16} /> I'm in
      </button>
      <button className={`chip no ${mine === 'no' ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); set('no') }}>
        <Icon name="x" size={16} /> Can't
      </button>
    </div>
  )
}

export function EventCard({ event, onOpen, compact }) {
  const yes = MEMBERS.filter((m) => event.availability?.[m.id] === 'yes').length
  return (
    <article className={`card event-card ${event.type}`} onClick={() => onOpen?.(event)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.(event)}>
      <div className="event-date">
        <span className="dd">{Number(event.date.slice(8, 10))}</span>
        <span className="mm">{new Date(event.date + 'T00:00').toLocaleString('en-US', { month: 'short' })}</span>
      </div>
      <div className="event-main">
        <div className="event-top">
          <span className={`type-pill ${event.type}`}>{TYPE_LABEL[event.type]}</span>
          <span className="muted small">{fmtDate(event.date)}{event.time ? ` · ${event.time}` : ''}</span>
        </div>
        <h3>{eventTitle(event)}</h3>
        {event.location && <p className="muted small line"><Icon name="pin" size={14} /> {event.location}</p>}
        {!compact && <AvailabilitySummary event={event} />}
        {!compact && event.date >= today() && <MyAvailability event={event} />}
        {compact && <p className="muted small">{yes}/{MEMBERS.length} confirmed · {relDays(event.date)}</p>}
      </div>
    </article>
  )
}

export function EventForm({ initial, onClose }) {
  const [f, setF] = useState({
    type: 'rehearsal', title: '', date: today(), time: '19:00', location: '', notes: '', ...initial,
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target?.value ?? e })
  const save = async (e) => {
    e.preventDefault()
    const data = { type: f.type, title: f.title.trim(), date: f.date, time: f.time, location: f.location.trim(), notes: f.notes.trim() }
    if (f.id) await updateItem('events', f.id, data)
    else await addItem('events', { ...data, availability: {} })
    onClose()
  }
  return (
    <Modal title={f.id ? 'Edit event' : 'New event'} onClose={onClose}>
      <form onSubmit={save} className="form">
        <Segmented options={[['rehearsal', 'Rehearsal'], ['gig', 'Gig']]} value={f.type} onChange={set('type')} />
        <Field label="Title (optional)"><input value={f.title} onChange={set('title')} placeholder={f.type === 'gig' ? 'e.g. Live at Club Fabrica' : 'e.g. Weekly rehearsal'} /></Field>
        <div className="row2">
          <Field label="Date"><input type="date" value={f.date} onChange={set('date')} required /></Field>
          <Field label="Time"><input type="time" value={f.time} onChange={set('time')} /></Field>
        </div>
        <Field label="Location"><input value={f.location} onChange={set('location')} placeholder="Rehearsal room, club, address…" /></Field>
        <Field label="Notes"><textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Bring the cables, soundcheck at 18:00…" /></Field>
        <button className="btn primary block">{f.id ? 'Save changes' : 'Add event'}</button>
      </form>
    </Modal>
  )
}

export function EventDetail({ event: ev, onClose }) {
  const [editing, setEditing] = useState(false)
  const { rows: setlists } = useCollection('setlists')
  const { rows: songs } = useCollection('songs')
  const { rows: events } = useCollection('events')
  const event = events.find((e) => e.id === ev.id) ?? ev
  if (editing) return <EventForm initial={event} onClose={() => setEditing(false)} />
  const linked = setlists.filter((s) => s.eventId === event.id)
  const del = async () => { if (confirmDelete('this event')) { await removeItem('events', event.id); onClose() } }
  return (
    <Modal title={eventTitle(event)} onClose={onClose}
      footer={<>
        <button className="btn ghost danger" onClick={del}><Icon name="trash" size={16} /> Delete</button>
        <button className="btn" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> Edit</button>
      </>}>
      <div className="detail">
        <p><span className={`type-pill ${event.type}`}>{TYPE_LABEL[event.type]}</span></p>
        <p className="line"><Icon name="calendar" size={16} /> {fmtDate(event.date, { year: true })} ({relDays(event.date)})</p>
        {event.time && <p className="line"><Icon name="clock" size={16} /> {event.time}</p>}
        {event.location && <p className="line"><Icon name="pin" size={16} /> {event.location}</p>}
        {event.notes && <p className="notes">{event.notes}</p>}

        <h4>Who's coming</h4>
        <MyAvailability event={event} />
        <ul className="avail-list">
          {MEMBERS.map((m) => {
            const a = event.availability?.[m.id]
            return (
              <li key={m.id}>
                <Avatar id={m.id} size={26} /> <span>{m.name}</span> <span className="muted small">{m.role}</span>
                <span className={`status-text ${a || 'unknown'}`}>{a === 'yes' ? 'Can make it' : a === 'no' ? "Can't make it" : 'No answer'}</span>
              </li>
            )
          })}
        </ul>

        {linked.length > 0 && <>
          <h4>Setlist</h4>
          {linked.map((s) => {
            const items = (s.songIds || []).map((id) => songs.find((x) => x.id === id)).filter(Boolean)
            const total = items.reduce((t, x) => t + (x.duration || 0), 0)
            return (
              <div key={s.id} className="mini-setlist">
                <strong>{s.name}</strong> <span className="muted small">{items.length} songs · {fmtDuration(total, true)}</span>
                <ol>{items.map((x) => <li key={x.id}>{x.title}</li>)}</ol>
              </div>
            )
          })}
        </>}
      </div>
    </Modal>
  )
}
