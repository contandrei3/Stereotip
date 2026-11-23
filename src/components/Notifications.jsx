import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCollection } from '../data/hooks'
import { setItem } from '../data/store'
import { useAuth } from '../data/auth'
import { memberName } from '../config'
import { fmtDate, dateTime, timeAgo } from '../lib/dates'
import { fmtRange } from './absences'
import { Modal, Avatar } from './ui'
import Icon from './Icon'

const WINDOW = 14 * 86400000 // show the last two weeks
const clip = (t = '', n = 70) => (t.length > n ? t.slice(0, n - 1) + '…' : t)
const POPUP_KEY = 'stereotip:popups'

/** Builds the activity feed for the current member from the shared data. */
function useActivity() {
  const { memberId } = useAuth()
  const c = (n) => useCollection(n).rows // eslint-disable-line react-hooks/rules-of-hooks
  const events = c('events'), polls = c('polls'), tasks = c('tasks'), reminders = c('reminders')
  const posts = c('posts'), comments = c('comments'), absences = c('absences'), songs = c('songs'), setlists = c('setlists')
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])

  return useMemo(() => {
    const out = []
    const since = now - WINDOW
    const who = (x) => x.by || x.author || x.createdBy || null
    const fresh = (x) => x.createdAt > since && who(x) !== memberId
    const push = (x, item) => out.push({ by: who(x), at: x.createdAt, ...item })

    events.filter(fresh).forEach((e) => push(e, {
      key: 'ev' + e.id, icon: 'calendar', to: '/calendar',
      text: <>added a <b>{e.type}</b>{e.title ? <>: <b>{e.title}</b></> : ''} on {fmtDate(e.date)}{e.time ? ` at ${e.time}` : ''}</>,
    }))
    polls.filter(fresh).forEach((p) => push(p, {
      key: 'po' + p.id, icon: 'poll', to: '/polls', text: <>started a poll: <b>{clip(p.question)}</b></>,
    }))
    tasks.filter((t) => fresh(t) && t.assignee === memberId).forEach((t) => push(t, {
      key: 'ta' + t.id, icon: 'tasks', to: '/tasks', text: <>gave you a task: <b>{clip(t.title)}</b>{t.due ? ` (due ${fmtDate(t.due)})` : ''}</>,
    }))
    reminders.filter((r) => r.for === 'all' || r.for === memberId).forEach((r) => {
      if (fresh(r)) push(r, { key: 'rn' + r.id, icon: 'bell', to: '/reminders', text: <>added a reminder for {r.for === 'all' ? 'everyone' : 'you'}: <b>{clip(r.text)}</b></> })
      const due = dateTime(r.date, r.time).getTime()
      if (!r.done && due <= now && due > since) {
        out.push({ key: 'rd' + r.id, at: due, by: null, icon: 'bell', to: '/reminders', urgent: true, text: <>Reminder: <b>{r.text}</b></> })
      }
    })
    posts.filter(fresh).forEach((p) => push(p, {
      key: 'ps' + p.id, icon: 'journal', to: '/journal', text: <>posted in the journal: “{clip(p.text)}”</>,
    }))
    comments.filter(fresh).forEach((cm) => {
      const post = posts.find((p) => p.id === cm.postId)
      push(cm, {
        key: 'cm' + cm.id, icon: 'comment', to: '/journal',
        text: <>commented{post?.author === memberId ? ' on your post' : ''}: “{clip(cm.text)}”</>,
      })
    })
    absences.filter(fresh).forEach((a) => push(a, {
      key: 'ab' + a.id, icon: 'away', to: '/calendar',
      text: a.member === who(a) ? <>is away <b>{fmtRange(a)}</b>{a.reason ? ` (${a.reason})` : ''}</>
        : <>marked <b>{memberName(a.member)}</b> away {fmtRange(a)}</>,
    }))
    songs.filter(fresh).forEach((s) => push(s, { key: 'so' + s.id, icon: 'music', to: '/songs', text: <>added a song: <b>{s.title}</b></> }))
    setlists.filter(fresh).forEach((s) => push(s, { key: 'sl' + s.id, icon: 'list', to: '/songs', text: <>made a setlist: <b>{s.name}</b></> }))

    return out.sort((a, b) => b.at - a.at).slice(0, 60)
  }, [events, polls, tasks, reminders, posts, comments, absences, songs, setlists, memberId, now])
}

function useSeen() {
  const { memberId } = useAuth()
  const { rows, loading } = useCollection('seen')
  const doc = rows.find((r) => r.id === memberId)
  return {
    loading,
    seenAt: doc?.at ?? null,
    markSeen: () => setItem('seen', memberId, { at: Date.now() }),
  }
}

export function NotificationBell() {
  const items = useActivity()
  const { seenAt, loading, markSeen } = useSeen()
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const shown = useRef(null)
  const navigate = useNavigate()
  const unread = loading ? [] : items.filter((i) => seenAt === null || i.at > seenAt)

  // Badge on the tab title and (when installed) on the app icon.
  useEffect(() => {
    document.title = (unread.length ? `(${unread.length}) ` : '') + 'Stereo.tip · Band Hub'
    try { unread.length ? navigator.setAppBadge?.(unread.length) : navigator.clearAppBadge?.() } catch { /* not supported */ }
  }, [unread.length])

  // Pop-up for things that arrive while the app is open.
  useEffect(() => {
    if (loading) return
    if (shown.current === null) { shown.current = new Set(items.map((i) => i.key)); return }
    const fresh = unread.filter((i) => !shown.current.has(i.key))
    fresh.forEach((i) => shown.current.add(i.key))
    if (!fresh.length) return
    const latest = fresh[0]
    setToast(latest)
    const t = setTimeout(() => setToast(null), 6000)
    try {
      if (localStorage.getItem(POPUP_KEY) === '1' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        const el = document.createElement('div')
        new Notification('Stereo.tip', { body: `${latest.by ? memberName(latest.by) + ' ' : ''}${textOf(latest, el)}`, icon: './icon-192.png', tag: latest.key })
      }
    } catch { /* ignore */ }
    return () => clearTimeout(t)
  }, [items, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (i) => { setOpen(false); setToast(null); markSeen(); navigate(i.to) }
  const close = () => { setOpen(false); markSeen() }

  return (
    <>
      <button className="icon-btn bell" onClick={() => setOpen(true)} aria-label={`Notifications${unread.length ? `, ${unread.length} new` : ''}`}>
        <Icon name="bell" size={20} />
        {unread.length > 0 && <span className="badge">{unread.length > 9 ? '9+' : unread.length}</span>}
      </button>
      {toast && !open && (
        <button className="toast" onClick={() => go(toast)}>
          {toast.by ? <Avatar id={toast.by} size={28} /> : <span className="toast-icon"><Icon name={toast.icon} size={16} /></span>}
          <span className="grow">{toast.by && <b>{memberName(toast.by)} </b>}{toast.text}</span>
          <span className="toast-x" onClick={(e) => { e.stopPropagation(); setToast(null) }} aria-label="Dismiss"><Icon name="x" size={14} /></span>
        </button>
      )}
      {open && (
        <Modal title="Notifications" onClose={close}>
          {items.length === 0 ? <p className="muted">Nothing new from the band in the last two weeks.</p> : (
            <ul className="notif-list">
              {items.map((i) => {
                const isNew = seenAt === null || i.at > seenAt
                return (
                  <li key={i.key}>
                    <button className={`notif ${isNew ? 'new' : ''} ${i.urgent ? 'urgent' : ''}`} onClick={() => go(i)}>
                      {i.by ? <Avatar id={i.by} size={32} /> : <span className="notif-icon"><Icon name={i.icon} size={16} /></span>}
                      <span className="grow">
                        <span className="notif-text">{i.by && <b>{memberName(i.by)} </b>}{i.text}</span>
                        <span className="muted small">{timeAgo(i.at)}</span>
                      </span>
                      {isNew && <span className="new-dot" aria-label="new" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <PopupSetting />
        </Modal>
      )}
    </>
  )
}

function textOf(item, el) {
  // Plain-text version of a JSX snippet for system notifications.
  const parts = []
  const walk = (n) => {
    if (n == null || n === false) return
    if (typeof n === 'string' || typeof n === 'number') return parts.push(String(n))
    if (Array.isArray(n)) return n.forEach(walk)
    if (n.props) walk(n.props.children)
  }
  walk(item.text)
  return parts.join('')
}

function PopupSetting() {
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [on, setOn] = useState(() => { try { return localStorage.getItem(POPUP_KEY) === '1' } catch { return false } })
  if (!supported) return null
  const toggle = async (e) => {
    const want = e.target.checked
    if (want && Notification.permission !== 'granted') {
      const res = await Notification.requestPermission()
      if (res !== 'granted') return setOn(false)
    }
    try { localStorage.setItem(POPUP_KEY, want ? '1' : '0') } catch { /* ignore */ }
    setOn(want)
  }
  return (
    <label className="check notif-setting">
      <input type="checkbox" checked={on} onChange={toggle} />
      <span>Also show system pop-ups when the site is open in another tab or in the background
        <span className="muted small"> (on this device only)</span></span>
    </label>
  )
}
