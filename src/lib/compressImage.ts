// Verkleinert Fotos im Browser, bevor sie hochgeladen werden: Handyfotos
// haben gern 5 MB, nach dem Verkleinern sind es meist 100–250 KB.
import { SHOP_IMAGE } from './config'

interface Options {
  maxSize: number
  quality: number
  maxBytes: number
  /** mittig quadratisch zuschneiden (Profilbilder) */
  square?: boolean
}

export async function compressImage(file: File, { maxSize, quality, maxBytes, square = false }: Options = SHOP_IMAGE): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Das ist kein Bild.')
  // imageOrientation: Handyfotos stehen sonst je nach EXIF-Daten auf dem Kopf
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error('Das Bild konnte nicht gelesen werden (HEIC? Dann bitte als JPEG speichern).')
  })
  // Ausschnitt aus dem Original: ganzes Bild oder das mittlere Quadrat
  const side = Math.min(bitmap.width, bitmap.height)
  const src = square
    ? { x: (bitmap.width - side) / 2, y: (bitmap.height - side) / 2, w: side, h: side }
    : { x: 0, y: 0, w: bitmap.width, h: bitmap.height }
  const scale = Math.min(1, maxSize / Math.max(src.w, src.h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(src.w * scale)
  canvas.height = Math.round(src.h * scale)
  const ctx = canvas.getContext('2d')!
  // JPEG kennt keine Transparenz – sonst würden transparente PNG-Flächen schwarz
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, src.x, src.y, src.w, src.h, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Das Bild konnte nicht verkleinert werden.')
  if (blob.size > maxBytes) throw new Error('Das Foto ist auch verkleinert noch zu groß.')
  return blob
}
