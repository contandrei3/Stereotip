// node test/run.mjs — end-to-end test of the worker with fake KV, fake Firebase keys and fake push services.
import assert from 'node:assert'
import nodeCrypto from 'node:crypto'
import { handle, runDue } from '../src/index.js'
import { b64u } from '../src/webpush.js'
import { _resetKeyCache } from '../src/auth.js'

// ── fake environment ──
const kv = new Map()
const vapid = (() => { const e = nodeCrypto.createECDH('prime256v1'); e.generateKeys(); return { pub: e.getPublicKey().toString('base64url'), priv: e.getPrivateKey().toString('base64url') } })()
const env = {
  FIREBASE_PROJECT_ID: 'stereotip-59432', VAPID_PUBLIC_KEY: vapid.pub, VAPID_PRIVATE_KEY: vapid.priv, VAPID_SUBJECT: 'https://stereotip-59432.web.app',
  ALLOWED_ORIGINS: 'https://stereotip-59432.web.app',
  PUSH: { get: async (k, t) => (kv.has(k) ? (t === 'json' ? JSON.parse(kv.get(k)) : kv.get(k)) : null), put: async (k, v) => { kv.set(k, v) } },
}

// ── fake Firebase signing key + tokens ──
const { publicKey, privateKey } = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }
const token = (over = {}) => {
  const now = Math.floor(Date.now() / 1000)
  const h = b64u.encode(Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' })))
  const p = b64u.encode(Buffer.from(JSON.stringify({ aud: 'stereotip-59432', iss: 'https://securetoken.google.com/stereotip-59432', sub: 'anon-1', iat: now, exp: now + 3600, ...over })))
  const s = nodeCrypto.sign('sha256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url')
  return `${h}.${p}.${s}`
}

// ── fake phones ──
const phones = {}
const phone = (name) => {
  const ecdh = nodeCrypto.createECDH('prime256v1'); ecdh.generateKeys(); const auth = nodeCrypto.randomBytes(16)
  phones[name] = { ecdh, auth }
  return { endpoint: `https://fcm.googleapis.com/fcm/send/${name}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } }
}
function decrypt(name, body) {
  const { ecdh, auth } = phones[name]
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen)
  const ikm = Buffer.from(nodeCrypto.hkdfSync('sha256', ecdh.computeSecret(asPub), auth, Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), asPub]), 32))
  const cek = Buffer.from(nodeCrypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16))
  const nonce = Buffer.from(nodeCrypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12))
  const d = nodeCrypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16))
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()])
  return JSON.parse(plain.subarray(0, plain.lastIndexOf(2)).toString())
}
function checkVapid(auth, endpoint) {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(auth); assert.ok(m, 'vapid header format')
  const [h, p, s] = m[1].split('.')
  const claims = JSON.parse(Buffer.from(p, 'base64url'))
  assert.strictEqual(claims.aud, new URL(endpoint).origin); assert.ok(claims.exp > Date.now() / 1000)
  const pub = Buffer.from(m[2], 'base64url')
  const key = nodeCrypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' })
  assert.ok(nodeCrypto.verify('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')), 'VAPID signature valid')
}

const delivered = []
let gone = new Set()
const fetchImpl = async (url, opts = {}) => {
  if (String(url).includes('securetoken@system.gserviceaccount.com')) return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'cache-control': 'max-age=3600' } })
  const name = String(url).split('/').pop()
  if (gone.has(name)) return new Response('', { status: 410 })
  checkVapid(opts.headers.Authorization, url)
  assert.strictEqual(opts.headers['Content-Encoding'], 'aes128gcm')
  delivered.push({ name, msg: decrypt(name, Buffer.from(opts.body)) })
  return new Response('', { status: 201 })
}
const call = async (path, body, tok = token(), origin = 'https://stereotip-59432.web.app') => {
  const res = await handle(new Request(`https://stereotip-push.stereotip.workers.dev${path}`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env, fetchImpl)
  return { status: res.status, cors: res.headers.get('Access-Control-Allow-Origin'), data: await res.json() }
}
const take = () => delivered.splice(0).map((d) => `${d.name}: ${d.msg.title} | ${d.msg.body} → ${d.msg.url}`).sort()

// ── tests ──
_resetKeyCache()
assert.strictEqual((await call('/send', { to: ['andrei'] }, 'nope')).status, 401); console.log('no token → 401 ✓')
assert.strictEqual((await call('/send', { to: ['andrei'] }, token({ aud: 'other-project' }))).status, 401); console.log('token from another project → 401 ✓')
assert.strictEqual((await call('/send', { to: ['andrei'] }, token({ exp: 1 }))).status, 401); console.log('expired token → 401 ✓')
const forged = token().split('.'); forged[1] = b64u.encode(Buffer.from(JSON.stringify({ aud: 'stereotip-59432', iss: 'https://securetoken.google.com/stereotip-59432', sub: 'x', iat: 1, exp: 9e9 })))
assert.strictEqual((await call('/send', { to: ['andrei'] }, forged.join('.'))).status, 401); console.log('tampered token → 401 ✓')

const opt = await handle(new Request('https://x/send', { method: 'OPTIONS', headers: { Origin: 'https://stereotip-59432.web.app' } }), env, fetchImpl)
assert.strictEqual(opt.status, 204); assert.strictEqual(opt.headers.get('Access-Control-Allow-Origin'), 'https://stereotip-59432.web.app'); console.log('CORS preflight ✓')

for (const [n, m] of [['andrei-phone', 'andrei'], ['mario-phone', 'mario'], ['mihai-phone', 'mihai'], ['david-phone', 'david']]) assert.strictEqual((await call('/subscribe', { memberId: m, sub: phone(n) })).status, 200)
assert.strictEqual((await call('/subscribe', { memberId: 'hacker', sub: phone('x') })).status, 400); console.log('unknown member rejected ✓')

let r = await call('/send', { to: ['andrei', 'mihai', 'david'], title: 'New rehearsal', body: 'Mario added it for Thu 26 Nov at 19:00 · Sala Rock', url: '#/calendar', tag: 'ev-1' })
console.log('send →', r.data); take().forEach((x) => console.log('   ', x))
assert.deepStrictEqual(r.data, { devices: 3, sent: 3 })

// same phone switches member: moves, not duplicated
await call('/subscribe', { memberId: 'andreeas', sub: { ...phone('david-phone') } })
r = await call('/send', { to: ['david'], title: 't' }); assert.strictEqual(r.data.devices, 0)
r = await call('/send', { to: ['andreeas'], title: 't' }); assert.strictEqual(r.data.devices, 1); take(); console.log('phone switched member: moved, not duplicated ✓')

gone = new Set(['mihai-phone'])
r = await call('/send', { to: ['mihai'], title: 't' }); assert.strictEqual(r.data.sent, 0)
r = await call('/send', { to: ['mihai'], title: 't' }); assert.strictEqual(r.data.devices, 0); console.log('dead subscription (410) removed ✓'); gone = new Set()

const now = Date.now()
await call('/schedule', { key: 'rem:1', at: now - 60e3, to: ['andrei', 'mario'], title: '⏰ Reminder', body: 'Pay for the rehearsal room', url: '#/reminders' })
await call('/schedule', { key: 'ev:9', at: now + 3600e3, to: ['andrei'], title: 'Tomorrow: Rehearsal at 19:00', body: 'Sala Rock' })
await call('/schedule', { key: 'rem:2', at: now - 60e3, to: ['andrei'], title: 'cancelled' })
await call('/unschedule', { key: 'rem:2' })
await call('/schedule', { key: 'rem:3', at: now - 7 * 3600e3, to: ['andrei'], title: 'way too late' })
r = await runDue(env, now, fetchImpl); console.log('cron →', r); take().forEach((x) => console.log('   ', x))
assert.deepStrictEqual(r, { due: 2, sent: 2 })
assert.deepStrictEqual(Object.keys(JSON.parse(kv.get('schedule'))), ['ev:9'])
r = await runDue(env, now, fetchImpl); assert.deepStrictEqual(r, { due: 0 }); console.log('second cron run sends nothing again ✓')
await call('/schedule', { key: 'ev:9', at: now - 1, to: ['andrei'], title: 'Moved earlier', body: '' })
r = await runDue(env, now, fetchImpl); assert.strictEqual(r.sent, 1); assert.ok(take()[0].includes('Moved earlier')); console.log('re-scheduling same key replaces it ✓')

r = await call('/test', { memberId: 'mario' }); assert.deepStrictEqual(r.data, { devices: 1, sent: 1 }); console.log('test endpoint →', take()[0])
console.log('ALL WORKER TESTS PASSED')
