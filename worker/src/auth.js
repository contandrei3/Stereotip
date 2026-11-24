// Verifies Firebase Auth ID tokens (RS256) so only the band app can use this server.
import { b64u } from './webpush.js'
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
let cache = { keys: null, until: 0 }

async function keys(fetchImpl) {
  if (cache.keys && Date.now() < cache.until) return cache.keys
  const res = await fetchImpl(JWKS_URL)
  const { keys } = await res.json()
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600)
  cache = { keys, until: Date.now() + maxAge * 1000 }
  return keys
}

export async function verifyIdToken(token, projectId, fetchImpl = fetch) {
  if (!token) throw new Error('missing token')
  const [h, p, s] = token.split('.')
  const header = JSON.parse(new TextDecoder().decode(b64u.decode(h)))
  const claims = JSON.parse(new TextDecoder().decode(b64u.decode(p)))
  const now = Math.floor(Date.now() / 1000)
  if (header.alg !== 'RS256') throw new Error('bad alg')
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('wrong project')
  if (!(claims.exp > now) || !(claims.iat <= now + 300) || !claims.sub) throw new Error('expired')
  const jwk = (await keys(fetchImpl)).find((k) => k.kid === header.kid)
  if (!jwk) throw new Error('unknown key')
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u.decode(s), new TextEncoder().encode(`${h}.${p}`))
  if (!ok) throw new Error('bad signature')
  return claims
}

export const _resetKeyCache = () => { cache = { keys: null, until: 0 } }
