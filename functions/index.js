const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { setGlobalOptions, logger } = require('firebase-functions/v2')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const webpush = require('web-push')
const { messageForCreate, messageForDueReminder, messageForUpcomingEvent, localToUtc, TZ } = require('./messages')

initializeApp()
const db = getFirestore()
setGlobalOptions({ region: 'europe-west3', maxInstances: 2, memory: '256MiB' })

// Public half is also in the web app (src/lib/push.js); the private half is a Firebase secret.
const VAPID_PUBLIC = 'BJi68RX4i09IM3jQt3DRXDpx_j2BAalU9dM3FzwfVCZsjJOHcrjJlWlhKe917BGdMhiEUNxxgdi2nJO3UhDlTDM'
const VAPID_PRIVATE = defineSecret('VAPID_PRIVATE_KEY')

const WATCHED = ['events', 'polls', 'tasks', 'reminders', 'posts', 'comments', 'observations', 'absences', 'setlists']

async function send(msg) {
  if (!msg || !msg.to?.length) return 0
  webpush.setVapidDetails('https://stereotip-59432.web.app', VAPID_PUBLIC, VAPID_PRIVATE.value())
  const snap = await db.collection('pushSubs').where('memberId', 'in', msg.to.slice(0, 30)).get()
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.tag })
  let sent = 0
  await Promise.all(snap.docs.map(async (doc) => {
    try {
      await webpush.sendNotification(doc.data().sub, payload, { TTL: 60 * 60 * 24, urgency: 'high' })
      sent++
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await doc.ref.delete() // phone unsubscribed
      else logger.warn('push failed', { status: err.statusCode, error: err.message, body: err.body })
    }
  }))
  logger.info('push', { title: msg.title, to: msg.to, devices: snap.size, sent })
  return sent
}

async function loadContext(col, d, id) {
  const ctx = { id }
  const get = async (c, i) => (i ? (await db.collection(c).doc(i).get()).data() : undefined)
  if (col === 'observations' || col === 'setlists') ctx.event = await get('events', d.eventId)
  if (col === 'observations') ctx.song = await get('songs', d.songId)
  if (col === 'comments') {
    ctx.post = await get('posts', d.postId)
    const cs = await db.collection('comments').where('postId', '==', d.postId).get()
    ctx.commenters = cs.docs.map((x) => x.data().author || x.data().by).filter(Boolean)
  }
  return ctx
}

// Something new was added anywhere → tell the right members.
exports.notifyOnCreate = onDocumentCreated({ document: '{col}/{id}', secrets: [VAPID_PRIVATE] }, async (event) => {
  const { col, id } = event.params
  if (!WATCHED.includes(col)) return
  const d = event.data?.data()
  if (!d) return
  const msg = messageForCreate(col, d, await loadContext(col, d, id))
  await send(msg)
})

// Every 5 minutes: reminders that are due, and events starting within 24 hours.
exports.timedNotifications = onSchedule({ schedule: 'every 5 minutes', timeZone: TZ, secrets: [VAPID_PRIVATE] }, async () => {
  const now = Date.now()

  const reminders = await db.collection('reminders').where('done', '==', false).get()
  for (const doc of reminders.docs) {
    const r = doc.data()
    if (r.pushedAt || !r.date) continue
    const due = localToUtc(r.date, r.time)
    if (due > now) continue
    // created after its own time, or long overdue: just mark it, don't send
    const stale = (r.createdAt && r.createdAt > due) || now - due > 6 * 3600 * 1000
    if (!stale) await send(messageForDueReminder(r, doc.id))
    await doc.ref.update({ pushedAt: now })
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(now))
  const events = await db.collection('events').where('date', '>=', today).get()
  for (const doc of events.docs) {
    const e = doc.data()
    if (e.headsUpAt) continue
    const start = localToUtc(e.date, e.time || '12:00')
    if (start - now > 24 * 3600 * 1000 || start < now) continue
    // added less than a day before it starts: the "new event" notification already covered it
    if (!(e.createdAt && e.createdAt > start - 24 * 3600 * 1000)) {
      const planIds = Object.values(e.plan || {}).filter(Boolean).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((p) => p.songId)
      const songs = []
      for (const sid of planIds) { const s = (await db.collection('songs').doc(sid).get()).data(); if (s) songs.push(s.title) }
      await send(messageForUpcomingEvent(e, doc.id, songs))
    }
    await doc.ref.update({ headsUpAt: now })
  }
})
