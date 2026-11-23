// Photos are resized in the browser and stored as JPEG data-URLs in Firestore
// (keeps everything on the free Firebase plan — no Cloud Storage needed).
export function compressImage(file, maxSide = 1400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      let q = quality, data = c.toDataURL('image/jpeg', q)
      // stay well under Firestore's 1 MB document limit
      while (data.length > 900_000 && q > 0.3) { q -= 0.1; data = c.toDataURL('image/jpeg', q) }
      resolve({ data, width: w, height: h })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')) }
    img.src = url
  })
}
