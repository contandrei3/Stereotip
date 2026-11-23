// ─── Band configuration ──────────────────────────────────────────────
export const BAND_NAME = 'Stereo.tip'

export const MEMBERS = [
  { id: 'andrei', name: 'Andrei', role: 'Bass guitar', color: '#5b8cff' },
  { id: 'mario', name: 'Mario', role: 'Lead guitar', color: '#ff8a3d' },
  { id: 'mihai', name: 'Mihai', role: 'Rhythm guitar', color: '#3ddc97' },
  { id: 'david', name: 'David', role: 'Drums', color: '#c77dff' },
  { id: 'andreeas', name: 'Andreeas', role: 'Vocals', color: '#ffd23f' },
]

export const memberById = (id) => MEMBERS.find((m) => m.id === id)
export const memberName = (id) => memberById(id)?.name ?? 'Unknown'

export const SONG_KEYS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
].flatMap((k) => [k, k + 'm'])
