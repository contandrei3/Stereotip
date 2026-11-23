// Setlist builder.
// Order: opener = the higher-energy of the #2/#3 best songs → the other one → middle → #1 best as closer.
// The middle is ordered to keep key and tempo changes smooth and give the set an
// energy arc (small dip in the middle, building towards the closer).

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 }

/** Position on the circle of fifths (0–11), minor keys mapped to their relative major. */
export function fifthsPos(key) {
  if (!key) return null
  const minor = key.endsWith('m')
  const pc = NOTE[minor ? key.slice(0, -1) : key]
  if (pc === undefined) return null
  const major = minor ? (pc + 3) % 12 : pc
  return (major * 7) % 12
}
export function keyDistance(a, b) {
  const x = fifthsPos(a), y = fifthsPos(b)
  if (x === null || y === null) return null
  const d = Math.abs(x - y)
  return Math.min(d, 12 - d) // 0 = same/relative key, 1 = neighbour, 6 = furthest
}

/** Energy 1–5: the song's own rating if set, otherwise estimated from BPM. */
export function energyOf(s) {
  if (s.energy) return Number(s.energy)
  const b = Number(s.bpm)
  if (!b) return 3
  if (b < 80) return 2
  if (b < 100) return 2.8
  if (b < 120) return 3.4
  if (b < 140) return 4.1
  return 4.7
}

function transitionCost(a, b) {
  const kd = keyDistance(a.key, b.key)
  const key = kd === null ? 0.35 : kd / 6
  const ta = Number(a.bpm), tb = Number(b.bpm)
  // superlinear: one huge jump costs more than the same change spread over a gradual climb
  const tempo = ta && tb ? Math.min(Math.pow(Math.abs(ta - tb) / 40, 1.6), 4) : 0.3
  return key * 1.0 + tempo * 0.8
}
// Energy target for the middle section (t: 0..1): fairly high, dips around 55%, climbs to the end.
const target = (t) => 3.5 - 0.7 * Math.sin(Math.PI * Math.min(t / 0.8, 1)) + (t > 0.8 ? (t - 0.8) * 2.5 : 0)

const pairKey = (a, b) => `${a.id}>${b.id}`

function pathCost(seq, before, after, banned) {
  let c = 0
  const full = [before, ...seq, after].filter(Boolean)
  for (let i = 0; i < full.length - 1; i++) {
    c += transitionCost(full[i], full[i + 1])
    if (banned.has(pairKey(full[i], full[i + 1]))) c += 0.8 // steer "Try another order" away from earlier suggestions
  }
  seq.forEach((s, i) => { c += 0.25 * Math.abs(energyOf(s) - target(seq.length > 1 ? i / (seq.length - 1) : 0.5)) })
  return c
}

function rng(seed) { let s = (seed * 2654435761 + 12345) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }

function optimiseMiddle(middle, before, after, banned) {
  if (middle.length < 2) return middle
  const rand = rng(1)
  let best = null, bestCost = Infinity
  for (let restart = 0; restart < 16; restart++) {
    // greedy start from a random song, then improve with reversals (2-opt)
    const pool = [...middle]
    const seq = [pool.splice(Math.floor(rand() * pool.length), 1)[0]]
    while (pool.length) {
      const last = seq.at(-1)
      pool.sort((x, y) => transitionCost(last, x) - transitionCost(last, y) + (rand() - 0.5) * 0.3)
      seq.push(pool.shift())
    }
    let cost = pathCost(seq, before, after, banned), improved = true
    while (improved) {
      improved = false
      for (let i = 0; i < seq.length - 1; i++) {
        for (let j = i + 1; j < seq.length; j++) {
          const cand = [...seq.slice(0, i), ...seq.slice(i, j + 1).reverse(), ...seq.slice(j + 1)]
          const cc = pathCost(cand, before, after, banned)
          if (cc < cost - 1e-9) { seq.splice(0, seq.length, ...cand); cost = cc; improved = true }
        }
      }
    }
    if (cost < bestCost) { best = [...seq]; bestCost = cost }
  }
  return best
}

/**
 * @param songs   selected songs
 * @param ranks   [bestId, secondId, thirdId] (2nd/3rd optional)
 * @returns [{ song, role }]
 */
export function buildSetlist(songs, ranks, seed = 0) {
  const byId = Object.fromEntries(songs.map((s) => [s.id, s]))
  const [b1, b2, b3] = ranks.map((id) => byId[id]).filter(Boolean).concat([null, null, null]).slice(0, 3)
  const ranked = new Set([b1, b2, b3].filter(Boolean).map((s) => s.id))
  const middle = songs.filter((s) => !ranked.has(s.id))

  // Opener: the higher-energy of the 2nd and 3rd best (tie → faster); the other one plays second.
  const early = [b2, b3].filter(Boolean)
    .sort((a, b) => energyOf(b) - energyOf(a) || (Number(b.bpm) || 0) - (Number(a.bpm) || 0))
  const opener = early.shift() || null

  const before = early.at(-1) || opener
  // seed 0 = the best order. Each "Try another order" (seed 1, 2, …) penalises the song
  // pairs used by the earlier suggestions, so you get a different but still smooth order.
  const banned = new Set()
  let mid = middle
  for (let k = 0; k <= seed % 5; k++) {
    mid = optimiseMiddle(middle, before, b1, banned)
    const full = [before, ...mid, b1].filter(Boolean)
    for (let i = 0; i < full.length - 1; i++) banned.add(pairKey(full[i], full[i + 1]))
  }

  const out = []
  if (opener) out.push({ song: opener, role: `opener · ${opener === b2 ? '2nd' : '3rd'} best` })
  early.forEach((s) => out.push({ song: s, role: s === b2 ? '2nd best' : '3rd best' }))
  mid.forEach((s) => out.push({ song: s, role: null }))
  if (b1) out.push({ song: b1, role: 'closer · best song' })
  return out
}

export function describeTransition(a, b) {
  const kd = keyDistance(a.key, b.key)
  const parts = []
  let score = 0
  if (kd !== null) {
    parts.push(kd === 0 ? (a.key === b.key ? 'same key' : 'relative key') : kd === 1 ? 'next key' : kd <= 2 ? 'close key' : 'key jump')
    score += kd <= 1 ? 0 : kd <= 2 ? 1 : 2
  }
  const ta = Number(a.bpm), tb = Number(b.bpm)
  if (ta && tb) {
    const d = tb - ta
    parts.push(d === 0 ? 'same tempo' : `${d > 0 ? '+' : ''}${d} bpm`)
    score += Math.abs(d) <= 12 ? 0 : Math.abs(d) <= 30 ? 1 : 2
  }
  return { text: parts.join(' · '), level: score <= 1 ? 'smooth' : score <= 2 ? 'ok' : 'jump' }
}
