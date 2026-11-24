import { useState } from 'react'
import { useCollection } from '../data/hooks'
import { addItem, updateItem, removeItem } from '../data/store'
import { useAuth } from '../data/auth'
import { memberName, SONG_STATUS } from '../config'
import { timeAgo, fmtDuration, today } from '../lib/dates'
import { Avatar, confirmDelete } from './ui'
import { Link } from 'react-router-dom'
import Icon from './Icon'

const RANK = { progress: 0, ready: 1, future: 2 }
const pid = () => Math.random().toString(36).slice(2, 9)

// event.plan = { [id]: { songId, note, order, by } }
export const planList = (event) =>
  Object.entries(event.plan || {}).filter(([, p]) => p).map(([id, p]) => ({ ...p, id })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

/** Songs assigned to a rehearsal, each with its own note. */
export function RehearsalSongs({ event }) {
  const { memberId } = useAuth()
  const { rows: songs } = useCollection('songs')
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')
  const plan = planList(event)
  const assigned = new Set(plan.map((p) => p.songId))
  const available = songs.filter((s) => !assigned.has(s.id))
    .sort((a, b) => (RANK[a.status] ?? 1) - (RANK[b.status] ?? 1) || a.title.localeCompare(b.title))
  const total = plan.reduce((t, p) => t + (songs.find((s) => s.id === p.songId)?.duration || 0), 0)

  const add = (songId) => updateItem('events', event.id, { [`plan.${pid()}`]: { songId, note: '', order: Date.now(), by: memberId } })
  const remove = (id) => updateItem('events', event.id, { [`plan.${id}`]: null })
  const saveNote = async (id) => { await updateItem('events', event.id, { [`plan.${id}.note`]: draft.trim() }); setEditing(null) }

  return (
    <div className="rplan">
      {plan.length === 0 ? <p className="rsec-empty">No songs yet. What are we working on?</p> : (
        <>
          <ol className="rplan-list">
            {plan.map((p) => {
              const s = songs.find((x) => x.id === p.songId)
              return (
                <li key={p.id}>
                  <div className="rplan-row">
                    <span className={`status-dot ${s?.status}`} title={SONG_STATUS[s?.status]} />
                    <span className="grow"><strong>{s?.title ?? 'Deleted song'}</strong>
                      {s && <span className="muted small"> {s.key}{s.bpm ? ` · ${s.bpm} bpm` : ''} · {SONG_STATUS[s.status]?.toLowerCase()}</span>}</span>
                    <button className="icon-btn tiny" onClick={() => { setEditing(p.id); setDraft(p.note || '') }} aria-label="Edit note"><Icon name="edit" size={14} /></button>
                    <button className="icon-btn tiny" onClick={() => remove(p.id)} aria-label="Remove song"><Icon name="x" size={14} /></button>
                  </div>
                  {editing === p.id ? (
                    <form className="rplan-note-form" onSubmit={(e) => { e.preventDefault(); saveNote(p.id) }}>
                      <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus placeholder="What to work on, e.g. tighten the bridge, new ending" />
                      <button className="btn small primary">Save</button>
                    </form>
                  ) : p.note ? <p className="rplan-note" onClick={() => { setEditing(p.id); setDraft(p.note) }}>{p.note}</p> : null}
                </li>
              )
            })}
          </ol>
          <p className="muted small">{plan.length} song{plan.length > 1 ? 's' : ''}{total ? ` · ${fmtDuration(total, true)} of music` : ''}</p>
        </>
      )}
      <button className={`btn small ${picking ? '' : 'primary'}`} onClick={() => setPicking(!picking)}>
        <Icon name={picking ? 'check' : 'plus'} size={14} /> {picking ? 'Done' : 'Assign songs'}
      </button>
      {picking && (available.length === 0
        ? <p className="muted small">All songs are already assigned (or the repertoire is empty).</p>
        : <ul className="pick-list">
          {available.map((s) => (
            <li key={s.id}><button type="button" onClick={() => add(s.id)}>
              <span className={`status-dot ${s.status}`} /><span className="grow">{s.title}</span>
              <span className="muted small">{SONG_STATUS[s.status]}</span><Icon name="plus" size={16} />
            </button></li>
          ))}
        </ul>)}
    </div>
  )
}

/** Observations for a rehearsal: stored on their own (collection "observations"),
 *  not in the Journal, unless the author ticks "Also post in Journal". */
export function RehearsalObservations({ event }) {
  const { memberId } = useAuth()
  const { rows: all } = useCollection('observations')
  const { rows: posts } = useCollection('posts')
  const { rows: songs } = useCollection('songs')
  const [text, setText] = useState('')
  const [songId, setSongId] = useState('')
  const [toJournal, setToJournal] = useState(false)
  const list = all.filter((o) => o.eventId === event.id).sort((a, b) => a.createdAt - b.createdAt)
  const journalPosts = posts.filter((p) => p.eventId === event.id).length
  const planSongs = planList(event).map((p) => songs.find((s) => s.id === p.songId)).filter(Boolean)
  const others = songs.filter((s) => !planSongs.includes(s)).sort((a, b) => a.title.localeCompare(b.title))
  const send = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    const data = { text: text.trim(), author: memberId, eventId: event.id, songId: songId || null }
    await addItem('observations', data)
    if (toJournal) await addItem('posts', { ...data, photoCount: 0 })
    setText(''); setSongId(''); setToJournal(false)
  }
  return (
    <div className="obs">
      {list.length === 0 && <p className="rsec-empty">No observations yet. They stay here, in the rehearsal.</p>}
      {list.map((o) => {
        const s = songs.find((x) => x.id === o.songId)
        return (
          <div key={o.id} className="comment">
            <Avatar id={o.author} size={26} />
            <div className="bubble">
              <div className="small"><strong>{memberName(o.author)}</strong> <span className="muted">{timeAgo(o.createdAt)}</span>
                {s && <span className="obs-song"> · <Icon name="music" size={12} /> {s.title}</span>}</div>
              <div className="ctext">{o.text}</div>
            </div>
            {o.author === memberId && <button className="icon-btn tiny" aria-label="Delete observation" onClick={() => confirmDelete('this observation') && removeItem('observations', o.id)}><Icon name="x" size={14} /></button>}
          </div>
        )
      })}
      <form className="obs-form" onSubmit={send}>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. We need to work on the transition out of the chorus" />
        <div className="obs-form-row">
          <select value={songId} onChange={(e) => setSongId(e.target.value)} aria-label="About song">
            <option value="">General (no specific song)</option>
            {planSongs.length > 0 && <optgroup label="Songs in this rehearsal">{planSongs.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</optgroup>}
            {others.length > 0 && <optgroup label="Other songs">{others.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</optgroup>}
          </select>
          <button className="btn small primary" disabled={!text.trim()}>Add</button>
        </div>
        <label className="check small"><input type="checkbox" checked={toJournal} onChange={(e) => setToJournal(e.target.checked)} /> Also post in Journal (for important things)</label>
      </form>
      {journalPosts > 0 && <p className="muted small"><Icon name="journal" size={13} /> {journalPosts} Journal post{journalPosts > 1 ? 's' : ''} about this rehearsal · <Link to="/journal">open Journal</Link></p>}
    </div>
  )
}

/** Compact preview on rehearsal cards: song chips + observations. */
export function RehearsalSummary({ event, compact }) {
  const { rows: songs } = useCollection('songs')
  const { rows: observations } = useCollection('observations')
  const plan = planList(event).map((p) => ({ ...p, song: songs.find((s) => s.id === p.songId) })).filter((p) => p.song)
  const obs = observations.filter((o) => o.eventId === event.id).sort((a, b) => b.createdAt - a.createdAt)
  if (!plan.length && !obs.length) {
    if (compact || event.date < today()) return null
    return <p className="rsum-empty"><Icon name="music" size={14} /> No songs planned yet · tap to add</p>
  }
  const latest = obs[0]
  return (
    <div className="rsum">
      {plan.length > 0 && (
        <div className="rsum-songs" aria-label="Songs to work on">
          {plan.map((p) => (
            <span key={p.id} className={`song-chip ${p.note ? 'noted' : ''}`} title={p.note || p.song.title}>
              <span className={`status-dot ${p.song.status}`} />{p.song.title}
            </span>
          ))}
        </div>
      )}
      {latest && (
        <p className="rsum-obs">
          <Icon name="comment" size={14} />
          <span className="grow"><b>{obs.length} observation{obs.length > 1 ? 's' : ''}</b>
            <span className="muted"> · {memberName(latest.author)}: “{latest.text.length > 60 ? latest.text.slice(0, 59) + '…' : latest.text}”</span></span>
        </p>
      )}
    </div>
  )
}
