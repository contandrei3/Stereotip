// Dates are stored as 'YYYY-MM-DD' strings and times as 'HH:mm' (local band time).
const pad = (n) => String(n).padStart(2, '0')
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => toISODate(new Date())
export const parseISODate = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (s, n) => {
  const d = parseISODate(s); d.setDate(d.getDate() + n); return toISODate(d)
}
export const dateTime = (date, time) => {
  const d = parseISODate(date)
  if (time) { const [h, m] = time.split(':').map(Number); d.setHours(h, m) } else d.setHours(23, 59)
  return d
}
export const sortKey = (x) => `${x.date || '9999-99-99'} ${x.time || '99:99'}`
export const byDate = (a, b) => sortKey(a).localeCompare(sortKey(b))

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function fmtDate(s, { weekday = true, year = false } = {}) {
  if (!s) return ''
  const d = parseISODate(s)
  const t = today()
  if (s === t) return 'Today'
  if (s === addDays(t, 1)) return 'Tomorrow'
  if (s === addDays(t, -1)) return 'Yesterday'
  const showYear = year || d.getFullYear() !== new Date().getFullYear()
  return `${weekday ? WD[d.getDay()] + ', ' : ''}${d.getDate()} ${MO[d.getMonth()]}${showYear ? ' ' + d.getFullYear() : ''}`
}
export const fmtMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS_LONG[m - 1]} ${y}`
}
export function daysUntil(s) {
  return Math.round((parseISODate(s) - parseISODate(today())) / 86400000)
}
export function relDays(s) {
  const n = daysUntil(s)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}
export function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`
  return fmtDate(toISODate(new Date(ms)), { weekday: false })
}

// durations (seconds) <-> "m:ss"
export function fmtDuration(sec, long = false) {
  if (!sec && sec !== 0) return '–'
  sec = Math.round(sec)
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  if (long && h) return `${h} h ${m} min`
  if (long) return `${m} min${s ? ` ${s} s` : ''}`
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
export function parseDuration(str) {
  if (!str) return null
  const parts = String(str).trim().split(':').map((p) => Number(p))
  if (parts.some((p) => Number.isNaN(p))) return null
  if (parts.length === 1) return Math.round(parts[0] * 60) // minutes
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}
