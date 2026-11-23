import { useMemo, useState } from 'react'
import { useCollection } from '../data/hooks'
import { addItem } from '../data/store'
import { Modal, Field } from '../components/ui'
import Icon from '../components/Icon'
import { SONG_STATUS } from '../config'
import { fmtDuration, fmtDate, today, byDate } from '../lib/dates'
import { eventTitle, TYPE_LABEL } from '../components/events'
import { buildSetlist, describeTransition, energyOf } from '../lib/setlistAlgo'

const RANK_LABEL = ['Best song (closes the show)', '2nd best', '3rd best']
const MEDAL = ['1', '2', '3']

export default function SetlistWizard({ onClose, onSaved }) {
  const { rows: songs } = useCollection('songs')
  const { rows: events } = useCollection('events')
  const [step, setStep] = useState(1)
  const [picked, setPicked] = useState([])
  const [showFuture, setShowFuture] = useState(false)
  const [ranks, setRanks] = useState(['', '', ''])
  const [seed, setSeed] = useState(0)
  const [name, setName] = useState('')
  const [eventId, setEventId] = useState('')

  const byStatus = (st) => songs.filter((s) => (s.status || 'progress') === st).sort((a, b) => a.title.localeCompare(b.title))
  const chosen = songs.filter((s) => picked.includes(s.id))
  const total = chosen.reduce((t, s) => t + (s.duration || 0), 0)
  const toggle = (id) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])
  const needRanks = Math.min(3, chosen.length)

  const result = useMemo(() => (step === 3 ? buildSetlist(chosen, ranks, seed) : []), [step, seed]) // eslint-disable-line react-hooks/exhaustive-deps
  const upcoming = events.filter((e) => e.date >= today()).sort(byDate)

  const setRank = (i, id) => setRanks(ranks.map((r, j) => (j === i ? id : r === id ? '' : r)))
  const save = async () => {
    const ev = events.find((e) => e.id === eventId)
    await addItem('setlists', { name: name.trim() || (ev ? eventTitle(ev) : 'New setlist'), eventId: eventId || null, songIds: result.map((r) => r.song.id) })
    onSaved?.()
    onClose()
  }

  const SongPick = ({ s }) => (
    <li>
      <button type="button" className={`pick-row ${picked.includes(s.id) ? 'on' : ''}`} onClick={() => toggle(s.id)} aria-pressed={picked.includes(s.id)}>
        <span className="opt-check sq">{picked.includes(s.id) && <Icon name="check" size={14} />}</span>
        <span className="grow">{s.title}<span className="muted small"> {[s.key, s.bpm && `${s.bpm} bpm`].filter(Boolean).join(' · ')}</span></span>
        <span className="muted small">{fmtDuration(s.duration)}</span>
      </button>
    </li>
  )

  return (
    <Modal title="Make a setlist" onClose={onClose}
      footer={
        step === 1 ? <>
          <span className="muted small">{chosen.length} songs · {fmtDuration(total, true)}</span>
          <button className="btn primary" disabled={chosen.length < 2} onClick={() => setStep(2)}>Next <Icon name="chevR" size={16} /></button>
        </> : step === 2 ? <>
          <button className="btn ghost" onClick={() => setStep(1)}><Icon name="chevL" size={16} /> Back</button>
          <button className="btn primary" disabled={ranks.slice(0, needRanks).some((r) => !r)} onClick={() => { setSeed(0); setStep(3) }}>Build setlist <Icon name="chevR" size={16} /></button>
        </> : <>
          <button className="btn ghost" onClick={() => setStep(2)}><Icon name="chevL" size={16} /> Back</button>
          <button className="btn primary" onClick={save}>Save setlist</button>
        </>
      }>
      <ol className="steps">
        {['Songs', 'Top 3', 'Result'].map((l, i) => <li key={l} className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}>{l}</li>)}
      </ol>

      {step === 1 && (
        <div className="form">
          <p className="muted small">Pick the songs for this show. The order doesn't matter, that's the next part.</p>
          {songs.length === 0 && <p className="muted">Add songs to the repertoire first.</p>}
          {['ready', 'progress'].map((st) => byStatus(st).length > 0 && (
            <section key={st}>
              <div className="section-head">
                <h3 className="line"><span className={`status-dot ${st}`} /> {SONG_STATUS[st]}</h3>
                <button type="button" className="btn small ghost" onClick={() => {
                  const ids = byStatus(st).map((s) => s.id)
                  const all = ids.every((id) => picked.includes(id))
                  setPicked(all ? picked.filter((id) => !ids.includes(id)) : [...new Set([...picked, ...ids])])
                }}>{byStatus(st).every((s) => picked.includes(s.id)) ? 'Clear' : 'Select all'}</button>
              </div>
              <ul className="pick-list plain">{byStatus(st).map((s) => <SongPick key={s.id} s={s} />)}</ul>
            </section>
          ))}
          {byStatus('future').length > 0 && (
            showFuture
              ? <section><h3 className="line"><span className="status-dot future" /> {SONG_STATUS.future}</h3>
                <ul className="pick-list plain">{byStatus('future').map((s) => <SongPick key={s.id} s={s} />)}</ul></section>
              : <button type="button" className="btn small ghost" onClick={() => setShowFuture(true)}>Show "In the future" songs ({byStatus('future').length})</button>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="form">
          <p className="muted small">Your <b>best song closes the show</b>. The <b>2nd and 3rd best</b> start it: the one with more energy opens, the other plays second.</p>
          {RANK_LABEL.slice(0, needRanks).map((label, i) => (
            <Field key={i} label={<span className="rank-label"><span className={`medal m${i + 1}`}>{MEDAL[i]}</span> {label}</span>}>
              <select value={ranks[i]} onChange={(e) => setRank(i, e.target.value)} required>
                <option value="">Choose a song…</option>
                {chosen.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </Field>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="form">
          <div className="setlist-total">
            <span><strong>{result.length}</strong> songs</span>
            <span>Total <strong>{fmtDuration(total)}</strong></span>
          </div>
          <ol className="built">
            {result.map((r, i) => {
              const prev = result[i - 1]?.song
              const t = prev && describeTransition(prev, r.song)
              return (
                <li key={r.song.id}>
                  {t && t.text && <div className={`transition ${t.level}`}><span>{t.text}</span></div>}
                  <div className={`built-row ${r.role ? 'role' : ''}`}>
                    <span className="pos">{i + 1}</span>
                    <span className="grow">
                      <strong>{r.song.title}</strong>
                      <span className="muted small"> {[r.song.key, r.song.bpm && `${r.song.bpm} bpm`].filter(Boolean).join(' · ')}</span>
                      {r.role && <span className="role-tag">{r.role}</span>}
                    </span>
                    <span className="energy" title={`Energy ${energyOf(r.song).toFixed(1)} / 5`}>
                      {[1, 2, 3, 4, 5].map((n) => <i key={n} className={energyOf(r.song) >= n - 0.25 ? 'on' : ''} />)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
          <button type="button" className="btn small ghost" onClick={() => setSeed(seed + 1)}><Icon name="music" size={14} /> Try another order</button>
          <p className="muted small">You can still drag songs around after saving.</p>
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Club Fabrica – main set" /></Field>
          <Field label="Linked gig / event (optional)">
            <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">— none —</option>
              {upcoming.map((e) => <option key={e.id} value={e.id}>{TYPE_LABEL[e.type]}: {eventTitle(e)} · {fmtDate(e.date)}</option>)}
            </select>
          </Field>
        </div>
      )}
    </Modal>
  )
}
