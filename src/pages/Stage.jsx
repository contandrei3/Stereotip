import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCollection } from '../data/hooks'
import { Loading } from '../components/ui'
import Icon from '../components/Icon'
import { fmtDuration } from '../lib/dates'
import { eventTitle } from '../components/events'

// Full-screen setlist view for the phone on stage.
// Next/previous: big buttons, swipe, or keys (→ ← space, PageUp/PageDown, so Bluetooth page-turner pedals work).
const posKey = (id) => `stereotip:stage:${id}`
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

export default function Stage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { rows: setlists, loading } = useCollection('setlists')
  const { rows: songs } = useCollection('songs')
  const { rows: events } = useCollection('events')
  const setlist = setlists.find((s) => s.id === id)
  const items = (setlist?.songIds || []).map((sid) => songs.find((s) => s.id === sid)).filter(Boolean)

  const saved = read(posKey(id), {})
  const [i, setI] = useState(saved.i ?? 0)
  const [startedAt, setStartedAt] = useState(saved.startedAt ?? null)
  const [now, setNow] = useState(Date.now())
  const [showList, setShowList] = useState(false)
  const [pulse, setPulse] = useState(() => read('stereotip:stage:pulse', false))
  const [flash, setFlash] = useState(false)
  const touch = useRef(null)

  const idx = Math.min(i, Math.max(items.length - 1, 0))
  const song = items[idx], next = items[idx + 1], prev = items[idx - 1]

  useEffect(() => { write(posKey(id), { i: idx, startedAt }) }, [id, idx, startedAt])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  const go = useCallback((d) => {
    setI((x) => Math.max(0, Math.min(items.length - 1, Math.min(x, items.length - 1) + d)))
    setStartedAt((s) => s ?? Date.now())
  }, [items.length])

  // Keyboard / page-turner pedals
  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(1) }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(-1) }
      else if (e.key === 'Escape') { showList ? setShowList(false) : navigate(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, navigate, showList])

  // Keep the screen awake while on stage
  useEffect(() => {
    let lock = null, alive = true
    const get = async () => { try { lock = await navigator.wakeLock?.request('screen') } catch { /* not supported / denied */ } }
    const onVis = () => { if (alive && document.visibilityState === 'visible') get() }
    get(); document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); lock?.release?.().catch(() => {}) }
  }, [])

  // Visual beat at the song's BPM
  useEffect(() => {
    write('stereotip:stage:pulse', pulse)
    const bpm = Number(song?.bpm)
    if (!pulse || !bpm) return
    const t = setInterval(() => { setFlash(true); setTimeout(() => setFlash(false), 90) }, 60000 / bpm)
    return () => clearInterval(t)
  }, [pulse, song?.bpm])

  if (loading) return <div className="center-screen stage-bg"><Loading /></div>
  if (!setlist) return (
    <div className="center-screen stage-bg"><div className="auth-card">
      <p>This setlist doesn't exist anymore.</p>
      <button className="btn primary" onClick={() => navigate('/songs')}>Back to songs</button>
    </div></div>
  )
  if (!items.length) return (
    <div className="center-screen stage-bg"><div className="auth-card">
      <p>This setlist has no songs yet.</p>
      <button className="btn primary" onClick={() => navigate(-1)}>Back</button>
    </div></div>
  )

  const left = items.slice(idx).reduce((t, s) => t + (s.duration || 0), 0)
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0
  const gig = events.find((e) => e.id === setlist.eventId)
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x, dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
  }
  const restart = () => { if (window.confirm('Restart the set from the first song and reset the timer?')) { setI(0); setStartedAt(null) } }
  const fullscreen = () => {
    const el = document.documentElement
    if (document.fullscreenElement) document.exitFullscreen?.()
    else el.requestFullscreen?.().catch(() => {})
  }

  return (
    <div className={`stage ${flash ? 'flash' : ''}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="stage-top">
        <button className="stage-icon" onClick={() => navigate(-1)} aria-label="Exit stage mode"><Icon name="x" size={24} /></button>
        <div className="stage-title">
          <strong>{setlist.name}</strong>
          <span>{gig ? eventTitle(gig) : `${items.length} songs`}</span>
        </div>
        <div className="stage-tools">
          {document.documentElement.requestFullscreen && <button className="stage-icon" onClick={fullscreen} aria-label="Full screen"><Icon name="expand" size={22} /></button>}
          <button className="stage-icon" onClick={() => setShowList(true)} aria-label="All songs"><Icon name="list" size={24} /></button>
        </div>
      </header>

      <div className="stage-progress" aria-hidden="true">
        {items.map((s, n) => <i key={s.id} className={n < idx ? 'done' : n === idx ? 'on' : ''} />)}
      </div>

      <main className="stage-main" aria-live="polite">
        <div className="stage-count">{idx + 1} <span>/ {items.length}</span></div>
        <h1 className="stage-song">{song.title}</h1>
        <div className="stage-facts">
          <div><span>Key</span><strong>{song.key || '–'}</strong></div>
          <div className={pulse && song.bpm ? 'beat' : ''} onClick={() => setPulse(!pulse)} role="button" tabIndex={0}
            title="Tap to toggle the beat flash" aria-label={`Tempo ${song.bpm || 'unknown'}. Tap to ${pulse ? 'stop' : 'start'} the beat flash`}>
            <span>BPM {song.bpm ? <em className={`pulse-dot ${pulse ? 'on' : ''}`} /> : null}</span><strong>{song.bpm || '–'}</strong>
          </div>
          <div><span>Length</span><strong>{song.duration ? fmtDuration(song.duration) : '–'}</strong></div>
        </div>
        {song.notes && <p className="stage-notes">{song.notes}</p>}
      </main>

      <footer className="stage-bottom">
        <div className="stage-next">
          {next ? <><span>Next</span><strong>{next.title}</strong><em>{[next.key, next.bpm && `${next.bpm} bpm`].filter(Boolean).join(' · ')}</em></>
            : <><span>Last song</span><strong>Thank you, good night! 🤘</strong></>}
        </div>
        <div className="stage-nav">
          <button className="stage-btn" onClick={() => go(-1)} disabled={!prev} aria-label="Previous song">
            <Icon name="chevL" size={30} /><span>{prev ? 'Prev' : ''}</span>
          </button>
          <button className="stage-btn primary" onClick={() => go(1)} disabled={!next} aria-label="Next song">
            <span>Next</span><Icon name="chevR" size={30} />
          </button>
        </div>
        <div className="stage-time">
          <button onClick={restart} className="stage-link">{startedAt ? `Set time ${fmtDuration(elapsed)}` : 'Timer starts on first Next'}</button>
          <span>{fmtDuration(left, true)} of music left</span>
        </div>
      </footer>

      {showList && (
        <div className="stage-list" role="dialog" aria-label="All songs">
          <div className="stage-list-head">
            <strong>Jump to song</strong>
            <button className="stage-icon" onClick={() => setShowList(false)} aria-label="Close"><Icon name="x" size={24} /></button>
          </div>
          <ol>
            {items.map((s, n) => (
              <li key={s.id}>
                <button className={n === idx ? 'on' : n < idx ? 'done' : ''} onClick={() => { setI(n); setStartedAt((x) => x ?? Date.now()); setShowList(false) }}>
                  <span className="n">{n + 1}</span>
                  <span className="t">{s.title}</span>
                  <span className="m">{[s.key, s.bpm].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ol>
          <button className="stage-link restart" onClick={restart}>Restart set</button>
        </div>
      )}
    </div>
  )
}
