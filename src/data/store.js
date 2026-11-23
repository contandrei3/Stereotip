// Tiny data layer. Every collection is shared by the whole band.
// Uses Firestore when configured, otherwise localStorage ("demo mode").
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, getDoc, query, where,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

// ── Local (demo) backend ──────────────────────────────────────────────
const LS = 'stereotip:'
const localListeners = new Map() // coll -> Set(fn)
const readLocal = (c) => {
  try { return JSON.parse(localStorage.getItem(LS + c) || '[]') } catch { return [] }
}
const writeLocal = (c, rows) => {
  localStorage.setItem(LS + c, JSON.stringify(rows))
  localListeners.get(c)?.forEach((fn) => fn())
}
const setPath = (obj, path, value) => {
  const keys = path.split('.')
  const out = { ...obj }
  let cur = out
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = value
    else { cur[k] = { ...(cur[k] || {}) }; cur = cur[k] }
  })
  return out
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith(LS)) localListeners.get(e.key.slice(LS.length))?.forEach((fn) => fn())
  })
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const local = {
  subscribe(c, filter, cb) {
    const run = () => {
      let rows = readLocal(c)
      if (filter) rows = rows.filter((r) => r[filter[0]] === filter[1])
      cb(rows)
    }
    if (!localListeners.has(c)) localListeners.set(c, new Set())
    localListeners.get(c).add(run)
    run()
    return () => localListeners.get(c).delete(run)
  },
  async add(c, data) {
    const id = uid()
    writeLocal(c, [...readLocal(c), { ...data, id }])
    return id
  },
  async update(c, id, patch) {
    writeLocal(c, readLocal(c).map((r) => {
      if (r.id !== id) return r
      let next = r
      for (const [k, v] of Object.entries(patch)) next = setPath(next, k, v)
      return next
    }))
  },
  async remove(c, id) { writeLocal(c, readLocal(c).filter((r) => r.id !== id)) },
  async getDoc(c, id) { return readLocal(c).find((r) => r.id === id) ?? null },
  async setDoc(c, id, data) {
    const rows = readLocal(c).filter((r) => r.id !== id)
    writeLocal(c, [...rows, { ...data, id }])
  },
}

// ── Firestore backend ────────────────────────────────────────────────
const strip = (data) => {
  // Firestore rejects `undefined` values and we never want to store the id field.
  const out = {}
  for (const [k, v] of Object.entries(data)) if (v !== undefined && k !== 'id') out[k] = v
  return out
}
const remote = {
  subscribe(c, filter, cb, onError) {
    const ref = filter ? query(collection(db, c), where(filter[0], '==', filter[1])) : collection(db, c)
    return onSnapshot(ref, (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), onError)
  },
  async add(c, data) { return (await addDoc(collection(db, c), strip(data))).id },
  async update(c, id, patch) { await updateDoc(doc(db, c, id), strip(patch)) },
  async remove(c, id) { await deleteDoc(doc(db, c, id)) },
  async getDoc(c, id) {
    const s = await getDoc(doc(db, c, id))
    return s.exists() ? { ...s.data(), id: s.id } : null
  },
  async setDoc(c, id, data) { await setDoc(doc(db, c, id), strip(data)) },
}

const backend = isFirebaseConfigured ? remote : local

// ── Shared, ref-counted subscriptions so many components can watch one collection ──
const subs = new Map() // key -> { rows, loading, error, listeners:Set, unsub }
export function watch(c, filter, fn) {
  const key = c + (filter ? `|${filter[0]}=${filter[1]}` : '')
  let s = subs.get(key)
  if (!s) {
    s = { rows: [], loading: true, error: null, listeners: new Set(), unsub: null }
    subs.set(key, s)
    s.unsub = backend.subscribe(c, filter, (rows) => {
      s.rows = rows; s.loading = false; s.error = null
      s.listeners.forEach((l) => l(s))
    }, (err) => {
      console.error(`[${c}]`, err)
      s.loading = false; s.error = err
      s.listeners.forEach((l) => l(s))
    })
  }
  s.listeners.add(fn)
  fn(s)
  return () => {
    s.listeners.delete(fn)
    if (s.listeners.size === 0) {
      // keep it alive briefly so navigating between pages doesn't refetch
      setTimeout(() => {
        if (s.listeners.size === 0 && subs.get(key) === s) { s.unsub?.(); subs.delete(key) }
      }, 30000)
    }
  }
}

export const addItem = (c, data) => backend.add(c, { ...data, createdAt: Date.now() })
export const updateItem = (c, id, patch) => backend.update(c, id, { ...patch, updatedAt: Date.now() })
export const removeItem = (c, id) => backend.remove(c, id)
export const getItem = (c, id) => backend.getDoc(c, id)
export const setItem = (c, id, data) => backend.setDoc(c, id, data)
