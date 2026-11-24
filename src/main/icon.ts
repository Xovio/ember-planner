import { nativeImage, type NativeImage } from 'electron'
import { iconPixels } from './iconPixels'

/** App icon as a native image (tray, window); same drawing as the installed app's .ico */
export function createAppIcon(size = 32): NativeImage {
  const rgba = iconPixels(size)
  const bgra = Buffer.alloc(rgba.length)
  for (let i = 0; i < rgba.length; i += 4) {
    bgra[i] = rgba[i + 2]
    bgra[i + 1] = rgba[i + 1]
    bgra[i + 2] = rgba[i]
    bgra[i + 3] = rgba[i + 3]
  }
  return nativeImage.createFromBitmap(bgra, { width: size, height: size })
}
