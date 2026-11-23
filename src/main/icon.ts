import { nativeImage, type NativeImage } from 'electron'

/**
 * Draws the app icon procedurally (rounded crimson tile with a calendar glyph),
 * so no binary asset is needed yet. Returns a BGRA bitmap image.
 */
export function createAppIcon(size = 32): NativeImage {
  const buf = Buffer.alloc(size * size * 4)
  const r = size * 0.22
  const s = size / 32

  const inRoundRect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number, rad: number): boolean => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const cx = x < x0 + rad ? x0 + rad : x > x1 - rad ? x1 - rad : x
    const cy = y < y0 + rad ? y0 + rad : y > y1 - rad ? y1 - rad : y
    return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5
      let rgba: [number, number, number, number] = [0, 0, 0, 0]
      if (inRoundRect(px, py, 0.5, 0.5, size - 0.5, size - 0.5, r)) {
        // vertical gradient from coral to crimson
        const t = py / size
        rgba = [Math.round(240 - 40 * t), Math.round(90 - 40 * t), Math.round(80 - 30 * t), 255]
        // white page
        if (inRoundRect(px, py, 7 * s, 8 * s, 25 * s, 25 * s, 2.5 * s)) rgba = [255, 246, 243, 255]
        // header bar on the page
        if (inRoundRect(px, py, 7 * s, 8 * s, 25 * s, 13 * s, 2.5 * s)) rgba = [120, 24, 30, 255]
        // ring hooks
        if ((Math.abs(px - 11.5 * s) < 1.2 * s || Math.abs(px - 20.5 * s) < 1.2 * s) && py > 5.5 * s && py < 10 * s)
          rgba = [255, 246, 243, 255]
        // one highlighted day
        if (inRoundRect(px, py, 17 * s, 17 * s, 22 * s, 22 * s, 1.2 * s)) rgba = [214, 60, 58, 255]
      }
      const i = (y * size + x) * 4
      buf[i] = rgba[2] // B
      buf[i + 1] = rgba[1] // G
      buf[i + 2] = rgba[0] // R
      buf[i + 3] = rgba[3]
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}
