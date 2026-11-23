// ─── Band configuration ──────────────────────────────────────────────
// Put each member's login e-mail here. When someone signs in with that e-mail
// the app knows who they are. (If an e-mail isn't listed, the app asks the
// person once to pick which member they are.)
export const BAND_NAME = 'Stereo.tip'

export const MEMBERS = [
  { id: 'andrei', name: 'Andrei', role: 'Bass guitar', email: '', color: '#5b8cff' },
  { id: 'mario', name: 'Mario', role: 'Lead guitar', email: '', color: '#ff8a3d' },
  { id: 'mihai', name: 'Mihai', role: 'Rhythm guitar', email: '', color: '#3ddc97' },
  { id: 'david', name: 'David', role: 'Drums', email: '', color: '#c77dff' },
  { id: 'andreeas', name: 'Andreeas', role: 'Vocals', email: '', color: '#ffd23f' },
]

export const memberById = (id) => MEMBERS.find((m) => m.id === id)
export const memberName = (id) => memberById(id)?.name ?? 'Unknown'

export const EXPENSE_CATEGORIES = [
  'Rehearsal room',
  'Gear',
  'Transport',
  'Recording',
  'Promotion',
  'Food & drinks',
  'Other',
]

export const SONG_KEYS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
].flatMap((k) => [k, k + 'm'])

export const CURRENCY = 'RON'
