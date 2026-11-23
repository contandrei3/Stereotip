import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection } from '../data/hooks'
import { useAuth } from '../data/auth'
import { EventCard, EventDetail, eventTitle, TYPE_LABEL } from '../components/events'
import { Loading, ErrorNote } from '../components/ui'
import Icon from '../components/Icon'
import { today, addDays, byDate, fmtDate, relDays } from '../lib/dates'
import { TaskRow, TaskForm } from './Tasks'
import { ReminderRow, remindersFor } from './Reminders'
import { Post } from './Journal'
import { AbsenceRow, overlaps } from '../components/absences'

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Home() {
  const { me, memberId } = useAuth()
  const { rows: events, loading, error } = useCollection('events')
  const { rows: reminders } = useCollection('reminders')
  const { rows: tasks } = useCollection('tasks')
  const { rows: posts } = useCollection('posts')
  const { rows: absences } = useCollection('absences')
  const [open, setOpen] = useState(null)
  const [taskForm, setTaskForm] = useState(null)

  const t = today(), in7 = addDays(t, 7)
  const upcoming = events.filter((e) => e.date >= t).sort(byDate)
  const nextRehearsal = upcoming.find((e) => e.type === 'rehearsal')
  const nextGig = upcoming.find((e) => e.type === 'gig')
  const week = [
    ...upcoming.filter((e) => e.date <= in7).map((e) => ({ ...e, kind: 'event' })),
  ]
  const myReminders = remindersFor(reminders, memberId).filter((r) => !r.done && r.date <= in7).sort(byDate)
  const openTasks = tasks.filter((x) => x.status !== 'done')
  const myTasks = openTasks.filter((x) => x.assignee === memberId)
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
  const otherOpen = openTasks.length - myTasks.length
  const weekAway = absences.filter((a) => overlaps(a, t, in7)).sort((a, b) => a.from.localeCompare(b.from))
  const latestPosts = [...posts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3)
  const needsAnswer = upcoming.filter((e) => !e.availability?.[memberId]).length

  return (
    <div className="page home">
      <div className="hello">
        <h1>{greeting()}, {me.name}.</h1>
        <p className="muted">
          {needsAnswer > 0 ? <><strong className="accent">{needsAnswer}</strong> event{needsAnswer > 1 ? 's' : ''} waiting for your answer. </> : 'You\'re all set. '}
        </p>
      </div>
      <ErrorNote error={error} />
      {loading ? <Loading /> : (
        <div className="home-grid">
          <section className="home-next">
            <div className="section-head"><h2>Next up</h2><Link to="/calendar" className="see-all">Calendar <Icon name="chevR" size={14} /></Link></div>
            {!nextRehearsal && !nextGig && (
              <div className="card empty-card"><p className="muted">Nothing scheduled. <Link to="/calendar">Plan the next rehearsal →</Link></p></div>
            )}
            <div className="stack">
              {nextRehearsal && <EventCard event={nextRehearsal} onOpen={setOpen} />}
              {nextGig && <EventCard event={nextGig} onOpen={setOpen} />}
            </div>
          </section>

          <section>
            <div className="section-head"><h2>Next 7 days</h2><Link to="/reminders" className="see-all">Reminders <Icon name="chevR" size={14} /></Link></div>
            <div className="card">
              {week.length === 0 && myReminders.length === 0 && weekAway.length === 0 ? <p className="muted">A quiet week.</p> : (
                <>
                  {week.length > 0 && <ul className="week-list">
                    {week.map((e) => (
                      <li key={e.id} role="button" tabIndex={0} onClick={() => setOpen(e)}>
                        <span className={`type-bar ${e.type}`} />
                        <div className="grow">
                          <div className="task-title">{eventTitle(e)}</div>
                          <div className="muted small">{TYPE_LABEL[e.type]} · {fmtDate(e.date)}{e.time ? ` · ${e.time}` : ''}{e.location ? ` · ${e.location}` : ''}</div>
                        </div>
                        <span className="muted small">{relDays(e.date)}</span>
                      </li>
                    ))}
                  </ul>}
                  {myReminders.length > 0 && <ul className="task-list">{myReminders.map((r) => <ReminderRow key={r.id} r={r} />)}</ul>}
                  {weekAway.length > 0 && <ul className="task-list">{weekAway.map((a) => <AbsenceRow key={a.id} a={a} />)}</ul>}
                </>
              )}
            </div>
          </section>

          <section>
            <div className="section-head"><h2>My open tasks</h2><Link to="/tasks" className="see-all">All tasks <Icon name="chevR" size={14} /></Link></div>
            <div className="card">
              {myTasks.length === 0 ? <p className="muted">Nothing on your plate.</p>
                : <ul className="task-list">{myTasks.slice(0, 6).map((x) => <TaskRow key={x.id} task={x} onEdit={setTaskForm} />)}</ul>}
              {myTasks.length > 6 && <p className="muted small">+{myTasks.length - 6} more</p>}
              {otherOpen > 0 && <p className="muted small"><Link to="/tasks">{otherOpen} open task{otherOpen > 1 ? 's' : ''} for the others</Link></p>}
            </div>
          </section>

          <section>
            <div className="section-head"><h2>Latest in the journal</h2><Link to="/journal" className="see-all">Journal <Icon name="chevR" size={14} /></Link></div>
            {latestPosts.length === 0 ? <div className="card"><p className="muted">No posts yet. <Link to="/journal">Write the first one →</Link></p></div>
              : <div className="stack">{latestPosts.map((p) => <Link key={p.id} to="/journal" className="plain"><Post post={p} preview /></Link>)}</div>}
          </section>
        </div>
      )}
      {open && <EventDetail event={open} onClose={() => setOpen(null)} />}
      {taskForm && <TaskForm initial={taskForm} onClose={() => setTaskForm(null)} />}
    </div>
  )
}
