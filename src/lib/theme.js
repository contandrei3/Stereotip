// Reads the band logo and derives the accent colours from it, so the UI
// always matches the logo. Falls back to the defaults in styles.css when the
// logo is monochrome (e.g. white-on-transparent) or can't be read.
export const LOGO_SRC = './logo.png'
export const LOGO_FALLBACK = './icon-192.png'

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return [h, s, l]
}

export function applyLogoTheme(src = LOGO_SRC) {
  const img = new Image()
  img.onload = () => {
    try {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, 64, 64)
      const px = ctx.getImageData(0, 0, 64, 64).data
      const buckets = new Array(36).fill(0).map(() => ({ w: 0, s: 0, l: 0 }))
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 128) continue
        const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2])
        if (s < 0.35 || l < 0.15 || l > 0.9) continue // ignore greys, black, white
        const b = buckets[Math.floor(h / 10) % 36]
        const w = s
        b.w += w; b.s += s * w; b.l += l * w
      }
      const ranked = buckets.map((b, i) => ({ ...b, h: i * 10 + 5 })).filter((b) => b.w > 3)
        .sort((a, b) => b.w - a.w)
      if (!ranked.length) return
      const first = ranked[0]
      const second = ranked.find((b) => Math.min(Math.abs(b.h - first.h), 360 - Math.abs(b.h - first.h)) >= 40)
      const css = (b) => {
        const s = Math.max(0.6, b.s / b.w), l = Math.min(0.66, Math.max(0.55, b.l / b.w))
        return `hsl(${b.h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`
      }
      const root = document.documentElement.style
      root.setProperty('--accent', css(first))
      root.setProperty('--accent-2', css(second ?? { ...first, h: (first.h + 40) % 360 }))
    } catch (e) { /* tainted canvas etc. → keep defaults */ }
  }
  img.src = src
}
