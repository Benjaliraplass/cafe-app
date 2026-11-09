/**
 * Redimensiona una imagen en el navegador y la devuelve como JPEG base64
 * (sin el prefijo data:). Mantiene el costo de la llamada a Claude bajo control.
 */
export async function imageToJpegBase64(
  file: File,
  maxSide = 1280,
  quality = 0.85,
): Promise<{ base64: string; blob: Blob }> {
  const bitmap = await createImageBitmap(file).catch(async () => {
    // Fallback para formatos que createImageBitmap no soporta (ej. HEIC en algunos navegadores)
    const img = await loadImage(URL.createObjectURL(file))
    return img
  })

  const w = 'width' in bitmap ? bitmap.width : (bitmap as HTMLImageElement).naturalWidth
  const h = 'height' in bitmap ? bitmap.height : (bitmap as HTMLImageElement).naturalHeight
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const cw = Math.round(w * scale)
  const ch = Math.round(h * scale)

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, cw, ch)

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo codificar la imagen'))), 'image/jpeg', quality),
  )
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
  return { base64: dataUrl.split(',')[1], blob }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo leer la imagen'))
    img.src = src
  })
}
