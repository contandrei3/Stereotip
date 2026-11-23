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
import { SONG_KEYS, SONG_STATUS, SONG_STATUS_OPTIONS } from '../config'
import { fmtDuration, parseDuration, fmtDate, today, byDate } from '../lib/dates'
import { eventTitle, TYPE_LABEL } from '../components/events'
import SetlistWizard from './SetlistWizard'
import { useNavigate } from 'react-router-dom'

const STATUS = SONG_STATUS, STATUS_OPTIONS = SONG_STATUS_OPTIONS
const STATUS_RANK = { ready: 0, progress: 1, future: 2 }

export default function Songs() {
  // remembered for this browser tab, so coming back from stage mode lands on Setlists again
  const [tab, setTabState] = useState(() => { try { return sessionStorage.getItem('stereotip:songsTab') || 'songs' } catch { return 'songs' } })
  const setTab = (t) => { setTabState(t); try { sessionStorage.setItem('stereotip:songsTab', t) } catch { /* ignore */ } }
  const [form, setForm] = useState(null)
  const [setlistOpen, setSetlistOpen] = useState(null)
  const [wizard, setWizard] = useState(false)
  const add = () => (tab === 'songs' ? setForm({}) : setSetlistOpen({}))
  return (
    <div className="page">
      <PageHead title="Songs" sub="Repertoire & setlists" action={<AddButton label={tab === 'songs' ? 'Song' : 'Setlist'} onClick={add} />} />
      <div className="toolbar"><Segmented options={[['songs', 'Repertoire'], ['setlists', 'Setlists']]} value={tab} onChange={setTab} /></div>
      {tab === 'songs' ? <Repertoire onEdit={setForm} /> : <Setlists onOpen={setSetlistOpen} onWizard={() => setWizard(true)} />}
      <Fab label="Add" onClick={add} />
      {form && <SongForm initial={form} onClose={() => setForm(null)} />}
      {wizard && <SetlistWizard onClose={() => setWizard(false)} />}
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
  const n = (st) => songs.filter((s) => s.status === st).length
  return (
    <>
      <ErrorNote error={error} />
      <div className="toolbar">
        <input className="search" placeholder="Search songs…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Segmented small options={[['all', `All ${songs.length}`], ...STATUS_OPTIONS.map(([k, l]) => [k, `${l} ${n(k)}`])]} value={status} onChange={setStatus} />
      </div>
      {list.length === 0
        ? <Empty icon="music" action={!songs.length && <AddButton label="Song" onClick={() => onEdit({})} />}>{songs.length ? 'No songs match.' : 'No songs yet. Add your repertoire.'}</Empty>
        : STATUS_OPTIONS.map(([st, label]) => {
          const group = list.filter((s) => (s.status || 'progress') === st)
          if (!group.length) return null
          return (
            <section key={st} className={`song-group ${st}`}>
              <h2 className="group-title"><span className={`status-dot ${st}`} /> {label} <span className="count">{group.length}</span></h2>
              <div className="song-list">
                {group.map((s) => <SongItem key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} onEdit={onEdit} />)}
              </div>
            </section>
          )
        })}
    </>
  )
}

function SongItem({ s, open, onToggle, onEdit }) {
  return (
    <article key={s.id} className={`card song ${open ? 'open' : ''}`}>
      <button className="song-row" onClick={onToggle}>
        <span className={`status-dot ${s.status}`} title={STATUS[s.status]} />
        <span className="song-title">{s.title}</span>
        <span className="song-meta">
          {s.key && <span className="kbd">{s.key}</span>}
          {s.bpm && <span className="kbd">{s.bpm} bpm</span>}
          <span className="muted small">{fmtDuration(s.duration)}</span>
        </span>
      </button>
      {open && (
        <div className="song-detail">
          <p><span className={`tag ${s.status}`}>{STATUS[s.status]}</span></p>
          {s.notes && <p className="notes">{s.notes}</p>}
          <SongRehearsals songId={s.id} />
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
  )
}

function SongRehearsals({ songId }) {
  const { rows: events } = useCollection('events')
  const list = events.filter((e) => Object.values(e.plan || {}).some((p) => p.songId === songId)).sort(byDate)
  if (!list.length) return null
  const next = list.find((e) => e.date >= today())
  const past = list.filter((e) => e.date < today()).reverse()
  return (
    <p className="muted small line">
      <Icon name="calendar" size={14} />
      {next && <span>Next rehearsal: <strong className="accent">{fmtDate(next.date)}</strong>{past.length ? ' · ' : ''}</span>}
      {past.length > 0 && <span>Rehearsed {past.length}× (last {fmtDate(past[0].date)})</span>}
    </p>
  )
}

function SongForm({ initial, onClose }) {
  const [f, setF] = useState({
    title: '', key: '', bpm: '', status: 'progress', notes: '', energy: null, ...initial,
    duration: initial.duration ? fmtDuration(initial.duration) : '',
    links: (initial.links || []).join('\n'),
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target?.value ?? e })
  const save = async (e) => {
    e.preventDefault()
    const data = {
      title: f.title.trim(), key: f.key, bpm: f.bpm ? Number(f.bpm) : null, status: f.status,
      duration: parseDuration(f.duration), notes: f.notes.trim(), energy: f.energy ? Number(f.energy) : null,
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
        <Field label="Status"><Segmented options={STATUS_OPTIONS} value={f.status} onChange={set('status')} /></Field>
        <Field label="Energy (optional)" hint="Used to pick the opener and shape the setlist. Empty = guessed from BPM.">
          <Segmented small options={[['', 'Auto'], ['1', '1 calm'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5 high']]} value={f.energy ? String(f.energy) : ''} onChange={(v) => setF({ ...f, energy: v || null })} />
        </Field>
        <Field label="Notes"><textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Structure, who starts, capo…" /></Field>
        <Field label="Links" hint="YouTube, tabs, etc. One per line."><textarea rows={3} value={f.links} onChange={set('links')} placeholder="https://youtube.com/…" /></Field>
        <button className="btn primary block">{f.id ? 'Save changes' : 'Add song'}</button>
      </form>
    </Modal>
  )
}

function Setlists({ onOpen, onWizard }) {
  const navigate = useNavigate()
  const { rows: setlists, loading, error } = useCollection('setlists')
  const { rows: songs } = useCollection('songs')
  const { rows: events } = useCollection('events')
  if (loading) return <Loading />
  const makeCard = (
    <button className="card make-setlist" onClick={onWizard}>
      <span className="make-icon"><Icon name="list" size={22} /></span>
      <span className="grow"><strong>Make a setlist</strong>
        <span className="muted small">Pick songs, rank your top 3 and get the best order: high-energy opener, smooth keys and tempos, best song last.</span></span>
      <Icon name="chevR" size={18} />
    </button>
  )
  if (!setlists.length) return <>{makeCard}<Empty icon="list" action={<AddButton label="Empty setlist" onClick={() => onOpen({})} />}>No setlists yet.</Empty></>
  const evDate = (s) => events.find((e) => e.id === s.eventId)?.date || ''
  const sorted = [...setlists].sort((a, b) => evDate(b).localeCompare(evDate(a)) || (b.createdAt - a.createdAt))
  return (
    <>
      <ErrorNote error={error} />
      {makeCard}
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
              {items.length > 0 && (
                <button className="btn small stage-open" onClick={(e) => { e.stopPropagation(); navigate(`/stage/${s.id}`) }}>
                  <Icon name="stage" size={16} /> Stage mode
                </button>
              )}
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
  const navigate = useNavigate()
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
  const available = songs.filter((s) => !ids.includes(s.id)).sort((a, b) => ((STATUS_RANK[a.status] ?? 1) - (STATUS_RANK[b.status] ?? 1) || a.title.localeCompare(b.title)))
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
        {initial.id && <button className="btn ghost danger" onClick={del}><Icon name="trash" size={16} /></button>}
        {initial.id && ids.length > 0 && <button className="btn" onClick={async () => { await save(); navigate(`/stage/${initial.id}`) }}><Icon name="stage" size={16} /> Stage</button>}
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
