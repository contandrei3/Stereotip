// Pure helpers: who gets notified about what, and what the notification says.
// Kept free of Firebase so they can be tested on their own.
const TZ = 'Europe/Bucharest'
const MEMBERS = { andrei: 'Andrei', mario: 'Mario', mihai: 'Mihai', david: 'David', andreeas: 'Andreeas' }
const ALL = Object.keys(MEMBERS)
const name = (id) => MEMBERS[id] || 'Someone'
const clip = (t = '', n = 90) => (t.length > n ? t.slice(0, n - 1) + '…' : t)
const others = (by) => ALL.filter((m) => m !== by)

/** 'YYYY-MM-DD' -> 'Thu, 26 Nov' */
function fmtDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(Date.UTC(y, m - 1, day, 12)))
}

/** Minutes the zone is ahead of UTC at instant ts. */
function tzOffset(ts, tz = TZ) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ts))
  const g = (t) => Number(p.find((x) => x.type === t).value)
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - ts) / 60000
}
/** Band-local date + time ('19:00') -> UTC ms. Missing time = end of day. */
function localToUtc(date, time, tz = TZ) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = (time || '23:59').split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let ts = guess - tzOffset(guess, tz) * 60000
  ts = guess - tzOffset(ts, tz) * 60000 // second pass handles DST edges
  return ts
}

const TYPE = { rehearsal: 'rehearsal', gig: 'gig' }

/**
 * Message for a newly created document, or null if nobody should be notified.
 * ctx gives already-loaded related docs: { event, song, post, commenters }.
 */
function messageForCreate(col, d, ctx = {}) {
  const by = d.by || d.author || d.createdBy || null
  const who = name(by)
  switch (col) {
    case 'events': {
      const t = d.title ? `: ${d.title}` : ''
      return { to: others(by), url: '#/calendar', tag: `ev-${ctx.id}`,
        title: `New ${TYPE[d.type] || 'event'}${t}`,
        body: `${who} added it for ${fmtDate(d.date)}${d.time ? ` at ${d.time}` : ''}${d.location ? ` · ${d.location}` : ''}. Can you make it?` }
    }
    case 'polls':
      return { to: others(by), url: '#/polls', tag: `poll-${ctx.id}`, title: `New poll from ${who}`, body: `${clip(d.question)} Tap to vote.` }
    case 'tasks':
      if (!d.assignee || d.assignee === by) return null
      return { to: [d.assignee], url: '#/tasks', tag: `task-${ctx.id}`, title: `${who} gave you a task`,
        body: `${clip(d.title)}${d.due ? ` (due ${fmtDate(d.due)})` : ''}` }
    case 'reminders': {
      const to = (d.for === 'all' ? ALL : [d.for]).filter((m) => m && m !== by)
      if (!to.length) return null
      return { to, url: '#/reminders', tag: `rem-new-${ctx.id}`, title: `${who} added a reminder${d.for === 'all' ? ' for everyone' : ' for you'}`,
        body: `${clip(d.text)} · ${fmtDate(d.date)}${d.time ? ` ${d.time}` : ''}` }
    }
    case 'posts':
      return { to: others(by), url: '#/journal', tag: `post-${ctx.id}`, title: `${who} posted in the journal`, body: clip(d.text) || '📷 New photos' }
    case 'comments': {
      // the post's author and everyone else who commented on it
      const to = [...new Set([ctx.post?.author, ...(ctx.commenters || [])])].filter((m) => m && m !== by)
      if (!to.length) return null
      return { to, url: '#/journal', tag: `post-${d.postId}`, title: `${who} commented`, body: clip(d.text) }
    }
    case 'observations': {
      const when = ctx.event ? ` (rehearsal ${fmtDate(ctx.event.date)})` : ''
      return { to: others(by), url: '#/calendar', tag: `obs-${d.eventId}`, title: `${who} added a rehearsal note${when}`,
        body: `${ctx.song ? `${ctx.song.title}: ` : ''}${clip(d.text)}` }
    }
    case 'absences': {
      const range = d.to && d.to !== d.from ? `${fmtDate(d.from)} – ${fmtDate(d.to)}` : fmtDate(d.from)
      return { to: others(d.member), url: '#/calendar', tag: `away-${ctx.id}`, title: `${name(d.member)} can't rehearse`,
        body: `Away ${range}${d.reason ? ` · ${d.reason}` : ''}` }
    }
    case 'setlists':
      return { to: others(by), url: '#/songs', tag: `setlist-${ctx.id}`, title: `${who} made a setlist`,
        body: `${d.name}${ctx.event ? ` for ${ctx.event.title || TYPE[ctx.event.type]} on ${fmtDate(ctx.event.date)}` : ''} · ${(d.songIds || []).length} songs` }
    default:
      return null
  }
}

/** A reminder whose time has come. */
function messageForDueReminder(r, id) {
  return { to: r.for === 'all' ? ALL : [r.for], url: '#/reminders', tag: `rem-${id}`, title: '⏰ Reminder', body: clip(r.text) }
}

/** The day-before heads-up for an event. */
function messageForUpcomingEvent(e, id, songs = []) {
  const label = e.title || (e.type === 'gig' ? 'Gig' : 'Rehearsal')
  const startsToday = fmtDate(e.date) === fmtDate(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()))
  const plan = songs.length ? ` · Songs: ${songs.slice(0, 4).join(', ')}${songs.length > 4 ? '…' : ''}` : ''
  return { to: ALL, url: '#/calendar', tag: `ev-${id}`,
    title: `${startsToday ? 'Today' : 'Tomorrow'}: ${label}${e.time ? ` at ${e.time}` : ''}`,
    body: `${e.location || 'No location set'}${plan}` }
}

module.exports = { messageForCreate, messageForDueReminder, messageForUpcomingEvent, localToUtc, fmtDate, ALL, TZ }
