// Stereo.tip push server.
//   POST /subscribe   { memberId, sub }          this phone wants notifications for memberId
//   POST /unsubscribe { endpoint }
//   POST /send        { to, title, body, url, tag }   notify members now
//   POST /schedule    { key, at, to, title, body, url, tag }   notify at a time (ms) — same key replaces
//   POST /unschedule  { key }
//   POST /test        { memberId }               test notification to one member's devices
// Every request needs "Authorization: Bearer <Firebase ID token>" from the band app.
// Cron (every 5 min): sends scheduled notifications that are due.
import { sendPush } from './webpush.js'
import { verifyIdToken } from './auth.js'

const MEMBERS = ['andrei', 'mario', 'mihai', 'david', 'andreeas']
const SCHEDULE = 'schedule'

const hash = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('')
const clean = (s, n) => String(s ?? '').slice(0, n)
const cleanTo = (to) => [...new Set((Array.isArray(to) ? to : []).filter((m) => MEMBERS.includes(m)))]
const message = (m) => ({ title: clean(m.title, 120) || 'Stereo.tip', body: clean(m.body, 300), url: clean(m.url, 60), tag: clean(m.tag, 80) || undefined })

async function subsFor(env, to) {
  const out = []
  for (const memberId of to) {
    const list = (await env.PUSH.get(`subs:${memberId}`, 'json')) || []
    for (const s of list) out.push({ memberId, sub: s })
  }
  return out
}
async function removeSub(env, memberId, endpoint) {
  const list = (await env.PUSH.get(`subs:${memberId}`, 'json')) || []
  const next = list.filter((s) => s.endpoint !== endpoint)
  if (next.length !== list.length) await env.PUSH.put(`subs:${memberId}`, JSON.stringify(next))
}

/** Deliver a message to every device of the given members. */
export async function deliver(env, to, msg, fetchImpl = fetch) {
  const targets = await subsFor(env, cleanTo(to))
  const payload = JSON.stringify(message(msg))
  let sent = 0
  await Promise.all(targets.map(async ({ memberId, sub }) => {
    try {
      const status = await sendPush(sub, payload, env, fetchImpl)
      if (status === 404 || status === 410) await removeSub(env, memberId, sub.endpoint)
      else if (status >= 200 && status < 300) sent++
      else console.warn('push rejected', status, new URL(sub.endpoint).host)
    } catch (e) { console.warn('push error', e.message) }
  }))
  return { devices: targets.length, sent }
}

async function readSchedule(env) { return (await env.PUSH.get(SCHEDULE, 'json')) || {} }

/** Sends scheduled notifications whose time has come (skips ones more than 6 h late). */
export async function runDue(env, now = Date.now(), fetchImpl = fetch) {
  const sched = await readSchedule(env)
  const due = Object.entries(sched).filter(([, it]) => it.at <= now)
  if (!due.length) return { due: 0 }
  for (const [key] of due) delete sched[key]
  await env.PUSH.put(SCHEDULE, JSON.stringify(sched))
  let sent = 0
  for (const [, it] of due) if (now - it.at < 6 * 3600 * 1000) sent += (await deliver(env, it.to, it, fetchImpl)).sent
  return { due: due.length, sent }
}

function cors(req, env) {
  const origin = req.headers.get('Origin') || ''
  const allowed = env.ALLOWED_ORIGINS.split(',').includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? origin : env.ALLOWED_ORIGINS.split(',')[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export async function handle(req, env, fetchImpl = fetch) {
  const headers = cors(req, env)
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  const path = new URL(req.url).pathname
  if (req.method === 'GET' && path === '/') return json({ ok: true, service: 'stereotip-push' })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  try {
    await verifyIdToken((req.headers.get('Authorization') || '').replace(/^Bearer /, ''), env.FIREBASE_PROJECT_ID, fetchImpl)
  } catch (e) { return json({ error: 'unauthorized', detail: e.message }, 401) }

  let b
  try { b = await req.json() } catch { return json({ error: 'bad json' }, 400) }

  switch (path) {
    case '/subscribe': {
      if (!MEMBERS.includes(b.memberId) || !b.sub?.endpoint?.startsWith('https://') || !b.sub?.keys?.p256dh || !b.sub?.keys?.auth) return json({ error: 'bad subscription' }, 400)
      const sub = { endpoint: b.sub.endpoint, keys: { p256dh: b.sub.keys.p256dh, auth: b.sub.keys.auth } }
      for (const m of MEMBERS) await removeSub(env, m, sub.endpoint) // one phone = one member
      const list = (await env.PUSH.get(`subs:${b.memberId}`, 'json')) || []
      await env.PUSH.put(`subs:${b.memberId}`, JSON.stringify([...list, sub].slice(-10)))
      return json({ ok: true })
    }
    case '/unsubscribe':
      for (const m of MEMBERS) await removeSub(env, m, String(b.endpoint || ''))
      return json({ ok: true })
    case '/send':
      return json(await deliver(env, b.to, b, fetchImpl))
    case '/schedule': {
      const at = Number(b.at)
      if (!b.key || !Number.isFinite(at)) return json({ error: 'bad schedule' }, 400)
      const sched = await readSchedule(env)
      sched[clean(b.key, 80)] = { at, to: cleanTo(b.to), ...message(b) }
      await env.PUSH.put(SCHEDULE, JSON.stringify(sched))
      return json({ ok: true })
    }
    case '/unschedule': {
      const sched = await readSchedule(env)
      if (sched[b.key]) { delete sched[b.key]; await env.PUSH.put(SCHEDULE, JSON.stringify(sched)) }
      return json({ ok: true })
    }
    case '/test':
      return json(await deliver(env, [b.memberId], { title: 'Stereo.tip', body: 'Notifications work on this phone 🤘', url: '', tag: 'test' }, fetchImpl))
    default:
      return json({ error: 'not found' }, 404)
  }
}

export default {
  fetch: (req, env) => handle(req, env),
  scheduled: (event, env, ctx) => ctx.waitUntil(runDue(env)),
}
