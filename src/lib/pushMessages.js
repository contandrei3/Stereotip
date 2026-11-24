// What each notification says and who gets it. The person who did something is never notified about it.
import { MEMBERS, memberName } from '../config'
import { fmtDate, dateTime } from './dates'

export const ALL = MEMBERS.map((m) => m.id)
const others = (by) => ALL.filter((m) => m !== by)
const clip = (t = '', n = 90) => (t.length > n ? t.slice(0, n - 1) + '…' : t)
const range = (a) => (a.to && a.to !== a.from ? `${fmtDate(a.from, { weekday: false })} – ${fmtDate(a.to, { weekday: false })}` : fmtDate(a.from))

/** ctx: { peek(col) -> cached rows } */
export function messageForCreate(col, id, d, ctx) {
  const by = d.by || d.author || null
  const who = memberName(by)
  const find = (c, i) => (i ? ctx.peek(c).find((x) => x.id === i) : undefined)
  switch (col) {
    case 'events':
      return { to: others(by), url: '#/calendar', tag: `ev-${id}`,
        title: `New ${d.type === 'gig' ? 'gig' : 'rehearsal'}${d.title ? `: ${d.title}` : ''}`,
        body: `${who} added it for ${fmtDate(d.date)}${d.time ? ` at ${d.time}` : ''}${d.location ? ` · ${d.location}` : ''}. Can you make it?` }
    case 'polls':
      return { to: others(by), url: '#/polls', tag: `poll-${id}`, title: `New poll from ${who}`, body: `${clip(d.question)} Tap to vote.` }
    case 'tasks':
      if (!d.assignee || d.assignee === by) return null
      return { to: [d.assignee], url: '#/tasks', tag: `task-${id}`, title: `${who} gave you a task`, body: `${clip(d.title)}${d.due ? ` (due ${fmtDate(d.due)})` : ''}` }
    case 'reminders': {
      const to = (d.for === 'all' ? ALL : [d.for]).filter((m) => m && m !== by)
      if (!to.length) return null
      return { to, url: '#/reminders', tag: `rem-new-${id}`, title: `${who} added a reminder${d.for === 'all' ? ' for everyone' : ' for you'}`,
        body: `${clip(d.text)} · ${fmtDate(d.date)}${d.time ? ` ${d.time}` : ''}` }
    }
    case 'posts':
      if (d.fromObservation) return null // already notified as a rehearsal note
      return { to: others(by), url: '#/journal', tag: `post-${id}`, title: `${who} posted in the journal`, body: clip(d.text) || '📷 New photos' }
    case 'comments': {
      const post = find('posts', d.postId)
      const commenters = ctx.peek('comments').filter((c) => c.postId === d.postId).map((c) => c.author)
      const to = [...new Set([post?.author, ...commenters])].filter((m) => m && m !== by)
      if (!to.length) return null
      return { to, url: '#/journal', tag: `post-${d.postId}`, title: `${who} commented`, body: clip(d.text) }
    }
    case 'observations': {
      const ev = find('events', d.eventId), song = find('songs', d.songId)
      return { to: others(by), url: '#/calendar', tag: `obs-${d.eventId}`, title: `${who} added a rehearsal note${ev ? ` (${fmtDate(ev.date)})` : ''}`,
        body: `${song ? `${song.title}: ` : ''}${clip(d.text)}` }
    }
    case 'absences':
      return { to: others(d.member), url: '#/calendar', tag: `away-${id}`, title: `${memberName(d.member)} can't rehearse`, body: `Away ${range(d)}${d.reason ? ` · ${d.reason}` : ''}` }
    case 'setlists': {
      const ev = find('events', d.eventId)
      return { to: others(by), url: '#/songs', tag: `setlist-${id}`, title: `${who} made a setlist`,
        body: `${d.name}${ev ? ` for ${ev.title || ev.type} on ${fmtDate(ev.date)}` : ''} · ${(d.songIds || []).length} songs` }
    }
    default:
      return null
  }
}

/** Scheduled notifications for reminders (at their time) and events (24 h before). null = nothing to schedule. */
export function scheduleFor(col, id, d, ctx, now = Date.now()) {
  if (!d) return null
  if (col === 'reminders') {
    if (d.done || !d.date) return null
    const at = dateTime(d.date, d.time).getTime()
    if (at <= now) return null
    return { key: `rem:${id}`, at, to: d.for === 'all' ? ALL : [d.for], title: '⏰ Reminder', body: clip(d.text), url: '#/reminders', tag: `rem-${id}` }
  }
  if (col === 'events') {
    if (!d.date) return null
    const start = dateTime(d.date, d.time || '12:00').getTime()
    const at = start - 24 * 3600 * 1000
    if (at <= now) return null
    const songs = Object.values(d.plan || {}).filter(Boolean).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((p) => ctx.peek('songs').find((s) => s.id === p.songId)?.title).filter(Boolean)
    const label = d.title || (d.type === 'gig' ? 'Gig' : 'Rehearsal')
    return { key: `ev:${id}`, at, to: ALL, url: '#/calendar', tag: `ev-${id}`,
      title: `Tomorrow: ${label}${d.time ? ` at ${d.time}` : ''}`,
      body: `${d.location || 'No location set'}${songs.length ? ` · Songs: ${songs.slice(0, 4).join(', ')}${songs.length > 4 ? '…' : ''}` : ''}` }
  }
  return null
}
