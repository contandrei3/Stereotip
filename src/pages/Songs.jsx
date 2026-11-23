import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCollection } from '../data/hooks'
import { addItem, updateItem, removeItem } from '../data/store'
import {
  PageHead, AddButton, Empty, Segmented, Modal, Field, Loading, ErrorNote, Fab, confirmDelete, isUrl, linkLabel,
} from '../components/ui'
import Icon from '../components/Icon'
import { SONG_KEYS } from '../config'
import { fmtDuration, parseDuration, fmtDate, today, byDate } from '../lib/dates'
import { eventTitle, TYPE_LABEL } from '../components/events'

const STATUS = { progress: 'In progress', ready: 'Ready' }

export default function Songs() {
  const [tab, setTab] = useState('songs')
  const [form, setForm] = useState(null)
  const [setlistOpen, setSetlistOpen] = useState(null)
  const add = () => (tab === 'songs' ? setForm({}) : setSetlistOpen({}))
  return (
    <div className="page">
      <PageHead title="Songs" sub="Repertoire & setlists" action={<AddButton label={tab === 'songs' ? 'Song' : 'Setlist'} onClick={add} />} />
      <div className="toolbar"><Segmented options={[['songs', 'Repertoire'], ['setlists', 'Setlists']]} value={tab} onChange={setTab} /></div>
      {tab === 'songs' ? <Repertoire onEdit={setForm} /> : <Setlists onOpen={setSetlistOpen} />}
      <Fab label="Add" onClick={add} />
      {form && <SongForm initial={form} onClose={() => setForm(null)} />}
      {setlistOpen && <SetlistEditor initial={setlistOpen} onClose={() => setSetlistOpen(null)} />}
    </div>
  )
}

function Repertoire({ onEdit }) {
  const { rows: songs, loading, error } = useCollection('songs')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [openId, setOpenId] = useState(null)
  if (loading) return <Loading />
  const list = songs
    .filter((s) => status === 'all' || s.status === status)
    .filter((s) => s.title?.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title))
  const ready = songs.filter((s) => s.status === 'ready').length
  return (
    <>
      <ErrorNote error={error} />
      <div className="toolbar">
        <input className="search" placeholder="Search songs…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Segmented small options={[['all', `All ${songs.length}`], ['ready', `Ready ${ready}`], ['progress', `In progress ${songs.length - ready}`]]} value={status} onChange={setStatus} />
      </div>
      {list.length === 0
        ? <Empty icon="music" action={!songs.length && <AddButton label="Song" onClick={() => onEdit({})} />}>{songs.length ? 'No songs match.' : 'No songs yet. Add your repertoire.'}</Empty>
        : <div className="song-list">
          {list.map((s) => (
            <article key={s.id} className={`card song ${openId === s.id ? 'open' : ''}`}>
              <button className="song-row" onClick={() => setOpenId(openId === s.id ? null : s.id)}>
                <span className={`status-dot ${s.status}`} title={STATUS[s.status]} />
                <span className="song-title">{s.title}</span>
                <span className="song-meta">
                  {s.key && <span className="kbd">{s.key}</span>}
                  {s.bpm && <span className="kbd">{s.bpm} bpm</span>}
                  <span className="muted small">{fmtDuration(s.duration)}</span>
                </span>
              </button>
              {openId === s.id && (
                <div className="song-detail">
                  <p><span className={`tag ${s.status}`}>{STATUS[s.status]}</span></p>
                  {s.notes && <p className="notes">{s.notes}</p>}
                  {(s.links || []).length > 0 && (
                    <div className="links">
                      {s.links.map((l, i) => (
                        <a key={i} href={l} target="_blank" rel="noreferrer" className="link-chip">
                          <Icon name={l.includes('youtu') ? 'play' : 'link'} size={14} /> {linkLabel(l)}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="row-actions">
                    <button className="btn small ghost danger" onClick={() => confirmDelete(`"${s.title}"`) && removeItem('songs', s.id)}><Icon name="trash" size={16} /> Delete</button>
                    <button className="btn small" onClick={() => onEdit(s)}><Icon name="edit" size={16} /> Edit</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>}
    </>
  )
}

function SongForm({ initial, onClose }) {
  const [f, setF] = useState({
    title: '', key: '', bpm: '', status: 'progress', notes: '', ...initial,
    duration: initial.duration ? fmtDuration(initial.duration) : '',
    links: (initial.links || []).join('\n'),
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target?.value ?? e })
  const save = async (e) => {
    e.preventDefault()
    const data = {
      title: f.title.trim(), key: f.key, bpm: f.bpm ? Number(f.bpm) : null, status: f.status,
      duration: parseDuration(f.duration), notes: f.notes.trim(),
      links: f.links.split(/\s+/).map((x) => x.trim()).filter(isUrl),
    }
    if (f.id) await updateItem('songs', f.id, data); else await addItem('songs', data)
    onClose()
  }
  return (
    <Modal title={f.id ? 'Edit song' : 'New song'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Title"><input value={f.title} onChange={set('title')} required autoFocus /></Field>
        <div className="row3">
          <Field label="Key">
            <select value={f.key} onChange={set('key')}>
              <option value="">—</option>
              {SONG_KEYS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="BPM"><input type="number" inputMode="numeric" min="20" max="300" value={f.bpm ?? ''} onChange={set('bpm')} /></Field>
          <Field label="Duration"><input value={f.duration} onChange={set('duration')} placeholder="3:45" inputMode="decimal" /></Field>
        </div>
        <Field label="Status"><Segmented options={[['progress', 'In progress'], ['ready', 'Ready']]} value={f.status} onChange={set('status')} /></Field>
        <Field label="Notes"><textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Structure, who starts, capo…" /></Field>
        <Field label="Links" hint="YouTube, tabs, etc. One per line."><textarea rows={3} value={f.links} onChange={set('links')} placeholder="https://youtube.com/…" /></Field>
        <button className="btn primary block">{f.id ? 'Save changes' : 'Add song'}</button>
      </form>
    </Modal>
  )
}

function Setlists({ onOpen }) {
  const { rows: setlists, loading, error } = useCollection('setlists')
  const { rows: songs } = useCollection('songs')
  const { rows: events } = useCollection('events')
  if (loading) return <Loading />
  if (!setlists.length) return <Empty icon="list" action={<AddButton label="Setlist" onClick={() => onOpen({})} />}>No setlists yet. Build one from your repertoire.</Empty>
  const evDate = (s) => events.find((e) => e.id === s.eventId)?.date || ''
  const sorted = [...setlists].sort((a, b) => evDate(b).localeCompare(evDate(a)) || (b.createdAt - a.createdAt))
  return (
    <>
      <ErrorNote error={error} />
      <div className="grid-cards">
        {sorted.map((s) => {
          const items = (s.songIds || []).map((id) => songs.find((x) => x.id === id)).filter(Boolean)
          const total = items.reduce((t, x) => t + (x.duration || 0), 0)
          const ev = events.find((e) => e.id === s.eventId)
          return (
            <article key={s.id} className="card setlist-card" role="button" tabIndex={0} onClick={() => onOpen(s)}>
              <h3>{s.name}</h3>
              {ev ? <p className="muted small line"><Icon name="calendar" size={14} /> {eventTitle(ev)} · {fmtDate(ev.date)}</p>
                : <p className="muted small">Not linked to a gig</p>}
              <p className="setlist-stats"><strong>{items.length}</strong> songs · <strong>{fmtDuration(total, true)}</strong></p>
              <ol className="setlist-preview">{items.slice(0, 5).map((x) => <li key={x.id}>{x.title}</li>)}{items.length > 5 && <li className="muted">+{items.length - 5} more</li>}</ol>
            </article>
          )
        })}
      </div>
    </>
  )
}

function SortableSong({ id, index, song, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <li ref={setNodeRef} className={`sortable ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button type="button" className="grip" {...attributes} {...listeners} aria-label={`Drag ${song.title}`}><Icon name="grip" /></button>
      <span className="pos">{index + 1}</span>
      <span className="grow">{song.title}<span className="muted small"> {song.key} {song.bpm ? `· ${song.bpm} bpm` : ''}</span></span>
      <span className="muted small">{fmtDuration(song.duration)}</span>
      <button type="button" className="icon-btn" onClick={() => onRemove(id)} aria-label="Remove"><Icon name="x" size={16} /></button>
    </li>
  )
}

function SetlistEditor({ initial, onClose }) {
  const { rows: songs } = useCollection('songs')
  const { rows: events } = useCollection('events')
  const [name, setName] = useState(initial.name || '')
  const [eventId, setEventId] = useState(initial.eventId || '')
  const [ids, setIds] = useState(initial.songIds || [])
  const [picking, setPicking] = useState(!initial.id)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const items = ids.map((id) => songs.find((s) => s.id === id)).filter(Boolean)
  const total = items.reduce((t, s) => t + (s.duration || 0), 0)
  const available = songs.filter((s) => !ids.includes(s.id)).sort((a, b) => (a.status === b.status ? a.title.localeCompare(b.title) : a.status === 'ready' ? -1 : 1))
  const gigs = events.filter((e) => e.date >= today() || e.id === eventId).sort(byDate)

  const onDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) setIds((arr) => arrayMove(arr, arr.indexOf(active.id), arr.indexOf(over.id)))
  }
  const save = async () => {
    const ev = events.find((e) => e.id === eventId)
    const data = { name: name.trim() || (ev ? eventTitle(ev) : 'Setlist'), eventId: eventId || null, songIds: ids }
    if (initial.id) await updateItem('setlists', initial.id, data); else await addItem('setlists', data)
    onClose()
  }
  const del = async () => { if (confirmDelete('this setlist')) { await removeItem('setlists', initial.id); onClose() } }
  return (
    <Modal title={initial.id ? 'Edit setlist' : 'New setlist'} onClose={onClose}
      footer={<>
        {initial.id && <button className="btn ghost danger" onClick={del}><Icon name="trash" size={16} /> Delete</button>}
        <button className="btn primary" onClick={save}>Save setlist</button>
      </>}>
      <div className="form">
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Club Fabrica – main set" /></Field>
        <Field label="Linked gig / event">
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">— none —</option>
            {gigs.map((e) => <option key={e.id} value={e.id}>{TYPE_LABEL[e.type]}: {eventTitle(e)} · {fmtDate(e.date)}</option>)}
          </select>
        </Field>
        <div className="setlist-total">
          <span><strong>{items.length}</strong> songs</span>
          <span>Total <strong>{fmtDuration(total)}</strong> <span className="muted small">({fmtDuration(total, true)})</span></span>
        </div>
        {items.length === 0 ? <p className="muted">Add songs from the repertoire below.</p> : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ol className="sortable-list">
                {items.map((s, i) => <SortableSong key={s.id} id={s.id} index={i} song={s} onRemove={(id) => setIds(ids.filter((x) => x !== id))} />)}
              </ol>
            </SortableContext>
          </DndContext>
        )}
        <button type="button" className="btn ghost block" onClick={() => setPicking(!picking)}>
          <Icon name={picking ? 'x' : 'plus'} size={16} /> {picking ? 'Hide repertoire' : 'Add songs'}
        </button>
        {picking && (
          available.length === 0 ? <p className="muted small">All songs are already in this setlist (or the repertoire is empty).</p> :
          <ul className="pick-list">
            {available.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setIds([...ids, s.id])}>
                  <span className={`status-dot ${s.status}`} />
                  <span className="grow">{s.title}</span>
                  <span className="muted small">{fmtDuration(s.duration)}</span>
                  <Icon name="plus" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
