import { useState } from 'react'
import { useCollection } from '../data/hooks'
import { addItem, updateItem, removeItem } from '../data/store'
import { useAuth } from '../data/auth'
import { PageHead, AddButton, Empty, Segmented, Modal, Field, Avatar, Loading, ErrorNote, Fab, confirmDelete } from '../components/ui'
import Icon from '../components/Icon'
import { MEMBERS, memberName } from '../config'
import { fmtDate, timeAgo, today, byDate, relDays } from '../lib/dates'
import { awayMembersOn } from '../components/absences'
import { eventTitle } from '../components/events'

// Poll: { question, category, options: { [id]: { text?, date?, time?, songId?, order, by } },
//         votes: { [memberId]: [optionId] }, multi, allowAdd, deadline, eventId, closed, author }
export const CATEGORIES = [['gig', 'Gig'], ['rehearsal', 'Rehearsal'], ['song', 'Song'], ['other', 'Other']]
const CAT_LABEL = Object.fromEntries(CATEGORIES)
const PLACEHOLDER = {
  gig: 'e.g. Do we accept the gig at Club Fabrica on 20 Dec?',
  rehearsal: 'e.g. When do we rehearse next week?',
  song: 'e.g. Which song do we learn next?',
  other: 'e.g. Which band photo do we use?',
}
const oid = () => Math.random().toString(36).slice(2, 9)

export const optionList = (poll) =>
  Object.entries(poll.options || {}).map(([id, o]) => ({ ...o, id })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
export const votersOf = (poll) => Object.entries(poll.votes || {}).filter(([, v]) => v?.length).map(([m]) => m)
export const isOpen = (poll) => !poll.closed && (!poll.deadline || poll.deadline >= today())

function OptionLabel({ poll, o, songs, absences }) {
  if (poll.category === 'rehearsal' && o.date) {
    const away = awayMembersOn(absences, o.date)
    return (
      <span className="opt-label">
        <strong>{fmtDate(o.date)}</strong>{o.time && <span> · {o.time}</span>}
        {o.text && <span className="muted"> · {o.text}</span>}
        {away.length > 0 && <span className="opt-away"> · away: {away.map(memberName).join(', ')}</span>}
      </span>
    )
  }
  if (o.songId) {
    const s = songs.find((x) => x.id === o.songId)
    return (
      <span className="opt-label">
        <Icon name="music" size={14} /> <strong>{s?.title ?? 'Deleted song'}</strong>
        {s && <span className="muted small"> {s.key}{s.status === 'ready' ? ' · ready' : ' · in progress'}</span>}
      </span>
    )
  }
  return <span className="opt-label">{o.text}</span>
}

export function PollCard({ poll, compact }) {
  const { memberId } = useAuth()
  const { rows: songs } = useCollection('songs')
  const { rows: absences } = useCollection('absences')
  const { rows: events } = useCollection('events')
  const [adding, setAdding] = useState(false)
  const opts = optionList(poll)
  const mine = poll.votes?.[memberId] || []
  const voters = votersOf(poll)
  const waiting = MEMBERS.filter((m) => !voters.includes(m.id))
  const open = isOpen(poll)
  const count = (id) => MEMBERS.filter((m) => (poll.votes?.[m.id] || []).includes(id))
  const max = Math.max(0, ...opts.map((o) => count(o.id).length))
  const linked = events.find((e) => e.id === poll.eventId)

  const vote = (id) => {
    if (!open) return
    let next
    if (poll.multi) next = mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id]
    else next = mine.includes(id) ? [] : [id]
    updateItem('polls', poll.id, { [`votes.${memberId}`]: next })
  }
  const schedule = async (o) => {
    const id = await addItem('events', { type: 'rehearsal', title: '', date: o.date, time: o.time || '', location: '', notes: `From poll: ${poll.question}`, availability: {} })
    await updateItem('polls', poll.id, { [`scheduled.${o.id}`]: id })
  }
  const del = () => confirmDelete('this poll') && removeItem('polls', poll.id)

  return (
    <article className={`card poll ${open ? '' : 'closed'}`}>
      <header className="poll-head">
        <span className={`cat-pill ${poll.category}`}>{CAT_LABEL[poll.category]}</span>
        <span className="muted small">
          {memberName(poll.author)} · {timeAgo(poll.createdAt)}
          {poll.deadline && open && <> · closes {relDays(poll.deadline)}</>}
          {!open && <> · <strong>closed</strong></>}
        </span>
      </header>
      <h3 className="poll-q">{poll.question}</h3>
      {linked && <p className="muted small line"><Icon name="calendar" size={14} /> {eventTitle(linked)} · {fmtDate(linked.date)}</p>}
      <p className="muted small">{poll.multi ? 'Pick as many as you like' : 'Pick one'}</p>
      <ul className="poll-opts">
        {opts.map((o) => {
          const who = count(o.id)
          const pct = voters.length ? (who.length / MEMBERS.length) * 100 : 0
          const lead = who.length > 0 && who.length === max
          const sel = mine.includes(o.id)
          return (
            <li key={o.id}>
              <button className={`poll-opt ${sel ? 'sel' : ''} ${lead ? 'lead' : ''}`} onClick={() => vote(o.id)} disabled={!open}
                aria-pressed={sel}>
                <span className="opt-fill" style={{ width: `${pct}%` }} />
                <span className={`opt-check ${poll.multi ? 'sq' : ''}`}>{sel && <Icon name="check" size={14} />}</span>
                <OptionLabel poll={poll} o={o} songs={songs} absences={absences} />
                <span className="opt-voters">{who.map((m) => <Avatar key={m.id} id={m.id} size={20} />)}</span>
                <span className="opt-count">{who.length}</span>
              </button>
              {poll.category === 'rehearsal' && o.date && lead && o.date >= today() && !compact && (
                poll.scheduled?.[o.id] && events.some((e) => e.id === poll.scheduled[o.id])
                  ? <p className="ok-text small sched">Added to the calendar ✓</p>
                  : <button className="btn small ghost sched" onClick={() => schedule(o)}><Icon name="calendar" size={14} /> Add this rehearsal to the calendar</button>
              )}
            </li>
          )
        })}
      </ul>
      {adding && <AddOption poll={poll} onDone={() => setAdding(false)} />}
      <footer className="poll-foot">
        <span className="muted small">
          {voters.length}/{MEMBERS.length} voted
          {open && waiting.length > 0 && waiting.length < MEMBERS.length && <> · waiting for {waiting.map((m) => m.name).join(', ')}</>}
        </span>
        {!compact && (
          <span className="poll-actions">
            {open && poll.allowAdd && !adding && <button className="btn small ghost" onClick={() => setAdding(true)}><Icon name="plus" size={14} /> Option</button>}
            <button className="btn small ghost" onClick={() => updateItem('polls', poll.id, { closed: open, ...(open ? {} : { deadline: null }) })}>{open ? 'Close' : 'Reopen'}</button>
            {poll.author === memberId && <button className="icon-btn" onClick={del} aria-label="Delete poll"><Icon name="trash" size={16} /></button>}
          </span>
        )}
      </footer>
    </article>
  )
}

function AddOption({ poll, onDone }) {
  const { memberId } = useAuth()
  const { rows: songs } = useCollection('songs')
  const [o, setO] = useState({ text: '', date: today(), time: '19:00', songId: '' })
  const save = async (e) => {
    e.preventDefault()
    const opt = poll.category === 'rehearsal' ? { date: o.date, time: o.time }
      : poll.category === 'song' && o.songId ? { songId: o.songId } : { text: o.text.trim() }
    if (!opt.date && !opt.songId && !opt.text) return
    await updateItem('polls', poll.id, { [`options.${oid()}`]: { ...opt, order: Date.now(), by: memberId } })
    onDone()
  }
  return (
    <form className="add-opt" onSubmit={save}>
      {poll.category === 'rehearsal' ? (
        <>
          <input type="date" value={o.date} onChange={(e) => setO({ ...o, date: e.target.value })} required />
          <input type="time" value={o.time} onChange={(e) => setO({ ...o, time: e.target.value })} />
        </>
      ) : poll.category === 'song' ? (
        <>
          <select value={o.songId} onChange={(e) => setO({ ...o, songId: e.target.value })}>
            <option value="">New idea (type below)…</option>
            {[...songs].sort((a, b) => a.title.localeCompare(b.title)).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          {!o.songId && <input value={o.text} onChange={(e) => setO({ ...o, text: e.target.value })} placeholder="Song name" autoFocus />}
        </>
      ) : <input value={o.text} onChange={(e) => setO({ ...o, text: e.target.value })} placeholder="New option" autoFocus required />}
      <button className="btn small primary">Add</button>
      <button type="button" className="icon-btn" onClick={onDone} aria-label="Cancel"><Icon name="x" size={16} /></button>
    </form>
  )
}

export default function Polls() {
  const { rows: polls, loading, error } = useCollection('polls')
  const { memberId } = useAuth()
  const [tab, setTab] = useState('open')
  const [cat, setCat] = useState('all')
  const [form, setForm] = useState(false)
  const list = polls
    .filter((p) => (tab === 'open' ? isOpen(p) : !isOpen(p)))
    .filter((p) => cat === 'all' || p.category === cat)
    .sort((a, b) => b.createdAt - a.createdAt)
  const needMyVote = polls.filter((p) => isOpen(p) && !(p.votes?.[memberId]?.length)).length
  return (
    <div className="page narrow">
      <PageHead title="Polls" sub={needMyVote ? `${needMyVote} waiting for your vote` : 'Decide things together'}
        action={<AddButton label="Poll" onClick={() => setForm(true)} />} />
      <div className="toolbar">
        <Segmented options={[['open', 'Open'], ['closed', 'Closed']]} value={tab} onChange={setTab} />
        <Segmented small options={[['all', 'All'], ...CATEGORIES]} value={cat} onChange={setCat} />
      </div>
      <ErrorNote error={error} />
      {loading ? <Loading /> : list.length === 0
        ? <Empty icon="poll" action={tab === 'open' && <AddButton label="Poll" onClick={() => setForm(true)} />}>
          {tab === 'open' ? 'No open polls. Got something to decide?' : 'No closed polls yet.'}</Empty>
        : <div className="feed">{list.map((p) => <PollCard key={p.id} poll={p} />)}</div>}
      <Fab label="New poll" onClick={() => setForm(true)} />
      {form && <PollForm onClose={() => setForm(false)} />}
    </div>
  )
}

function PollForm({ onClose }) {
  const { memberId } = useAuth()
  const { rows: songs } = useCollection('songs')
  const { rows: events } = useCollection('events')
  const { rows: absences } = useCollection('absences')
  const [category, setCategory] = useState('rehearsal')
  const [question, setQuestion] = useState('')
  const [opts, setOpts] = useState([{ k: oid(), text: '', date: '', time: '19:00', songId: '' }])
  const [multi, setMulti] = useState(true)
  const [allowAdd, setAllowAdd] = useState(true)
  const [deadline, setDeadline] = useState('')
  const [eventId, setEventId] = useState('')
  const gigs = events.filter((e) => e.date >= today()).sort(byDate)

  const changeCat = (c) => {
    setCategory(c)
    setMulti(c === 'rehearsal')
    setOpts([{ k: oid(), text: '', date: '', time: '19:00', songId: '' }])
  }
  const setOpt = (i, patch) => setOpts(opts.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  const addRow = () => setOpts([...opts, { k: oid(), text: '', date: '', time: opts.at(-1)?.time || '19:00', songId: '' }])
  const cleaned = opts.map((o) => (category === 'rehearsal' ? (o.date ? { date: o.date, time: o.time } : null)
    : category === 'song' ? (o.songId ? { songId: o.songId } : o.text.trim() ? { text: o.text.trim() } : null)
      : o.text.trim() ? { text: o.text.trim() } : null)).filter(Boolean)

  const save = async (e) => {
    e.preventDefault()
    if (cleaned.length < 2 && !allowAdd) return alert('Add at least two options.')
    if (cleaned.length < 1) return alert('Add at least one option.')
    const options = {}
    cleaned.forEach((o, i) => { options[oid()] = { ...o, order: i, by: memberId } })
    await addItem('polls', {
      question: question.trim(), category, options, votes: {}, multi, allowAdd,
      deadline: deadline || null, eventId: eventId || null, closed: false, author: memberId,
    })
    onClose()
  }
  return (
    <Modal title="New poll" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="About"><Segmented options={CATEGORIES} value={category} onChange={changeCat} /></Field>
        <Field label="Question"><input value={question} onChange={(e) => setQuestion(e.target.value)} required placeholder={PLACEHOLDER[category]} /></Field>

        <div className="field">
          <span className="field-label">{category === 'rehearsal' ? 'Possible dates' : category === 'song' ? 'Songs' : 'Options'}</span>
          {category === 'gig' && (
            <div className="quick-range">
              <button type="button" className="chip" onClick={() => setOpts(['Yes', 'No', 'Maybe'].map((t) => ({ k: oid(), text: t, date: '', time: '', songId: '' })))}>Yes / No / Maybe</button>
            </div>
          )}
          <div className="opt-rows">
            {opts.map((o, i) => (
              <div key={o.k} className="opt-row">
                {category === 'rehearsal' ? (
                  <>
                    <input type="date" value={o.date} onChange={(e) => setOpt(i, { date: e.target.value })} />
                    <input type="time" value={o.time} onChange={(e) => setOpt(i, { time: e.target.value })} />
                  </>
                ) : category === 'song' ? (
                  <>
                    <select value={o.songId} onChange={(e) => setOpt(i, { songId: e.target.value })}>
                      <option value="">New idea…</option>
                      {[...songs].sort((a, b) => a.title.localeCompare(b.title)).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                    {!o.songId && <input value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} placeholder="Song name" />}
                  </>
                ) : <input value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} placeholder={`Option ${i + 1}`} />}
                <button type="button" className="icon-btn" onClick={() => setOpts(opts.length > 1 ? opts.filter((_, j) => j !== i) : opts)} aria-label="Remove option"><Icon name="x" size={16} /></button>
                {category === 'rehearsal' && o.date && awayMembersOn(absences, o.date).length > 0 && (
                  <span className="opt-away small row-note">Away: {awayMembersOn(absences, o.date).map(memberName).join(', ')}</span>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="btn small ghost" onClick={addRow}><Icon name="plus" size={14} /> {category === 'rehearsal' ? 'Add date' : 'Add option'}</button>
        </div>

        {category === 'gig' && (
          <Field label="Linked gig (optional)">
            <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">— none —</option>
              {gigs.map((e) => <option key={e.id} value={e.id}>{eventTitle(e)} · {fmtDate(e.date)}</option>)}
            </select>
          </Field>
        )}
        <div className="row2">
          <label className="check"><input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> Multiple choices</label>
          <label className="check"><input type="checkbox" checked={allowAdd} onChange={(e) => setAllowAdd(e.target.checked)} /> Others can add options</label>
        </div>
        <Field label="Closes on (optional)"><input type="date" value={deadline} min={today()} onChange={(e) => setDeadline(e.target.value)} /></Field>
        <button className="btn primary block">Create poll</button>
      </form>
    </Modal>
  )
}
