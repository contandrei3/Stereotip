// Stereo.tip service worker: shows push notifications and opens the right page when tapped.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data && e.data.text() } }
  e.waitUntil(self.registration.showNotification(d.title || 'Stereo.tip', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'badge-96.png',
    tag: d.tag,
    renotify: Boolean(d.tag),
    data: { url: d.url || '' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = new URL('./' + (e.notification.data && e.notification.data.url || ''), self.registration.scope).href
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        await w.focus()
        try { await w.navigate(target) } catch { /* not controlled yet */ }
        return
      }
    }
    await self.clients.openWindow(target)
  })())
})
