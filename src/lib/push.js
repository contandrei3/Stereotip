// Phone/desktop push notifications (Web Push). The server side lives in /functions.
import { setItem, removeItem } from '../data/store'
import { isFirebaseConfigured } from '../data/firebase'

export const VAPID_PUBLIC = 'BJi68RX4i09IM3jQt3DRXDpx_j2BAalU9dM3FzwfVCZsjJOHcrjJlWlhKe917BGdMhiEUNxxgdi2nJO3UhDlTDM'

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e))
}

const b64ToBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
async function subId(sub) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub.endpoint))
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function registration() {
  registerServiceWorker()
  return navigator.serviceWorker.ready
}

/** 'unsupported' | 'ios-needs-install' | 'denied' | 'on' | 'off' */
export async function pushStatus() {
  if (!pushSupported()) return isIOS() && !isStandalone() ? 'ios-needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  const sub = await (await registration()).pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

async function save(sub, memberId) {
  await setItem('pushSubs', await subId(sub), {
    memberId, sub: JSON.parse(JSON.stringify(sub)), ua: navigator.userAgent.slice(0, 160), updatedAt: Date.now(),
  })
}

/** Must be called from a tap (iOS requires a user gesture). */
export async function enablePush(memberId) {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'denied' : 'dismissed')
  const reg = await registration()
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) })
  await save(sub, memberId)
}

export async function disablePush() {
  const sub = await (await registration()).pushManager.getSubscription()
  if (!sub) return
  try { await removeItem('pushSubs', await subId(sub)) } catch { /* already gone */ }
  await sub.unsubscribe()
}

/** Keeps the stored subscription pointing at whoever uses this phone now. */
export async function syncPushMember(memberId) {
  if (!memberId || !pushSupported() || Notification.permission !== 'granted') return
  const sub = await (await registration()).pushManager.getSubscription()
  if (sub) await save(sub, memberId)
}

export async function testNotification() {
  const reg = await registration()
  await reg.showNotification('Stereo.tip', {
    body: isFirebaseConfigured ? 'Notifications work on this device 🤘' : 'Demo mode: this is a local test only.',
    icon: 'icon-192.png', badge: 'badge-96.png', tag: 'test',
  })
}
