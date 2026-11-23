import { useMemo, useState } from 'react'
import { useCollection } from '../data/hooks'
import { EventCard, EventForm, EventDetail, eventTitle } from '../components/events'
import { PageHead, AddButton, Empty, Segmented, Loading, ErrorNote, Fab } from '../components/ui'
import Icon from '../components/Icon'
import { AbsenceForm, AbsenceRow, AwayNote, awayMembersOn } from '../components/absences'
import { memberById } from '../config'
import { today, toISODate, byDate, MONTHS_LONG, WEEKDAYS, fmtDate } from '../lib/dates'

export default function Calendar() {
  const { rows: events, loading, error } = useCollection('events')
  const { rows: absences } = useCollection('absences')
  const [awayForm, setAwayForm] = useState(null)
  const [view, setView] = useState('month')
  const [form, setForm] = useState(null)
  const [open, setOpen] = useState(null)
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState(today())
  const [filter, setFilter] = useState('all')

  const filtered = events.filter((e) => filter === 'all' || e.type === filter)
  const byDay = useMemo(() => {
    const m = {}
    for (const e of filtered) (m[e.date] ||= []).push(e)
    for (const k in m) m[k].sort(byDate)
    return m
  }, [filtered])
  const upcoming = filtered.filter((e) => e.date >= today()).sort(byDate)
  const past = filtered.filter((e) => e.date < today()).sort(byDate).reverse()
  const activeAway = absences.filter((a) => (a.to || a.from) >= today()).sort((a, b) => a.from.localeCompare(b.from))
  const awaySection = (
    <section className="away-section">
      <div className="section-head">
        <h2>Away periods</h2>
        <button className="btn small ghost" onClick={() => setAwayForm({})}><Icon name="plus" size={16} /> I'm away</button>
      </div>
      {activeAway.length === 0
        ? <p className="muted small">Nobody has marked any days off. Tap "I'm away" when you can't rehearse.</p>
        : <ul className="task-list">{activeAway.map((a) => <AbsenceRow key={a.id} a={a} onEdit={setAwayForm} />)}</ul>}
    </section>
  )

  const cells = useMemo(() => {
    const first = new Date(cursor)
    const offset = (first.getDay() + 6) % 7 // Monday first
    const start = new Date(first); start.setDate(1 - offset)
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [cursor])
  const move = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))
  const goToday = () => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(today()) }

  return (
    <div className="page">
      <PageHead title="Calendar" sub="Rehearsals & gigs" action={<AddButton label="Event" onClick={() => setForm({ date: selected >= today() ? selected : today() })} />} />
      <div className="toolbar">
        <Segmented options={[['month', 'Month'], ['list', 'Upcoming']]} value={view} onChange={setView} />
        <button className="btn small away-btn" onClick={() => setAwayForm({ from: selected >= today() ? selected : today() })}><Icon name="away" size={16} /> I'm away</button>
        <Segmented small options={[['all', 'All'], ['rehearsal', 'Rehearsals'], ['gig', 'Gigs']]} value={filter} onChange={setFilter} />
      </div>
      <ErrorNote error={error} />
      {loading ? <Loading /> : view === 'month' ? (
        <div className="cal-layout">
          <div className="card cal">
            <div className="cal-head">
              <button className="icon-btn" onClick={() => move(-1)} aria-label="Previous month"><Icon name="chevL" /></button>
              <button className="cal-title" onClick={goToday} title="Go to today">{MONTHS_LONG[cursor.getMonth()]} {cursor.getFullYear()}</button>
              <button className="icon-btn" onClick={() => move(1)} aria-label="Next month"><Icon name="chevR" /></button>
            </div>
            <div className="cal-grid">
              {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w[0]}<span>{w.slice(1)}</span></div>)}
              {cells.map((d) => {
                const iso = toISODate(d)
                const evs = byDay[iso] || []
                const away = awayMembersOn(absences, iso)
                const cls = ['cal-day',
                  d.getMonth() !== cursor.getMonth() && 'other',
                  iso === today() && 'today', iso === selected && 'selected', iso < today() && 'past', away.length && 'has-away'].filter(Boolean).join(' ')
                return (
                  <button key={iso} className={cls} onClick={() => setSelected(iso)} aria-label={`${iso}, ${evs.length} events`}>
                    <span className="num">{d.getDate()}</span>
                    <span className="cal-evs">
                      {evs.slice(0, 3).map((e) => <i key={e.id} className={`ev-mark ${e.type}`}><b>{e.time} {eventTitle(e)}</b></i>)}
                    </span>
                    {away.length > 0 && (
                      <span className="cal-away" title={`Away: ${away.map((id) => memberById(id)?.name).join(', ')}`}>
                        {away.slice(0, 3).map((id) => <i key={id} style={{ background: memberById(id)?.color }}>{memberById(id)?.name[0]}</i>)}
                        {away.length > 3 && <i className="more">+{away.length - 3}</i>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="legend"><span><i className="ev-mark rehearsal" /> Rehearsal</span><span><i className="ev-mark gig" /> Gig</span><span><i className="legend-away">A</i> Away</span></div>
          </div>
          <div className="day-panel">
            <div className="section-head">
              <h2>{fmtDate(selected, { year: true })}</h2>
              <button className="btn small ghost" onClick={() => setForm({ date: selected })}><Icon name="plus" size={16} /> Add</button>
            </div>
            <AwayNote absences={absences} date={selected} />
            {(byDay[selected] || []).length === 0
              ? <p className="muted">No events on this day.</p>
              : <div className="stack">{byDay[selected].map((e) => <EventCard key={e.id} event={e} onOpen={setOpen} />)}</div>}
            {awaySection}
          </div>
        </div>
      ) : (
        <>
          {upcoming.length === 0
            ? <Empty icon="calendar" action={<AddButton label="Event" onClick={() => setForm({})} />}>No upcoming events. Schedule the next rehearsal!</Empty>
            : <div className="stack">{upcoming.map((e) => <EventCard key={e.id} event={e} onOpen={setOpen} />)}</div>}
          {awaySection}
          {past.length > 0 && <details className="past">
            <summary>Past events ({past.length})</summary>
            <div className="stack">{past.map((e) => <EventCard key={e.id} event={e} onOpen={setOpen} compact />)}</div>
          </details>}
        </>
      )}
      <Fab label="Add event" onClick={() => setForm({ date: selected >= today() ? selected : today() })} />
      {form && <EventForm initial={form} onClose={() => setForm(null)} />}
      {awayForm && <AbsenceForm initial={awayForm} onClose={() => setAwayForm(null)} />}
      {open && <EventDetail event={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
