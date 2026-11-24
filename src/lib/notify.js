// Talks to the Stereo.tip push server (Cloudflare Worker, see /worker).
import { auth, isFirebaseConfigured } from '../data/firebase'
import { peek, setWriteListener } from '../data/store'
import { messageForCreate, scheduleFor } from './pushMessages'

export const PUSH_URL = 'https://stereotip-push.stereotip.workers.dev'

export async function pushApi(path, body) {
  if (!isFirebaseConfigured || !auth?.currentUser) return null
  const token = await auth.currentUser.getIdToken()
  const res = await fetch(PUSH_URL + path, {
    method: 'POST', keepalive: true,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`push server: ${res.status}`)
  return res.json()
}

const ctx = { peek }
const quiet = (p) => p.catch((e) => console.warn('notification not sent', e.message))

async function reschedule(col, id, doc) {
  const s = scheduleFor(col, id, doc, ctx)
  if (s) await pushApi('/schedule', s)
  else await pushApi('/unschedule', { key: `${col === 'reminders' ? 'rem' : 'ev'}:${id}` })
}

/** Hooked into every write the app makes. */
export function startNotifications() {
  setWriteListener((kind, col, id, data) => {
    if (!isFirebaseConfigured) return
    if (kind === 'add') {
      const msg = messageForCreate(col, id, data, ctx)
      if (msg?.to?.length) quiet(pushApi('/send', msg))
    }
    if (col === 'reminders' || col === 'events') {
      if (kind === 'remove') quiet(pushApi('/unschedule', { key: `${col === 'reminders' ? 'rem' : 'ev'}:${id}` }))
      else {
        const doc = kind === 'add' ? data : (peek(col).find((x) => x.id === id) || data)
        quiet(reschedule(col, id, doc))
      }
    }
  })
}
