/** Comparte con la hoja nativa (Web Share API) o copia el enlace al portapapeles. */
export async function shareLink(data: { title: string; text?: string; url: string }): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(data)
      return 'shared'
    } catch (e) {
      // El usuario canceló la hoja: no es un error.
      if (e instanceof DOMException && e.name === 'AbortError') return 'failed'
    }
  }
  try {
    await navigator.clipboard.writeText(data.url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export function absoluteUrl(path: string): string {
  return `${window.location.origin}${path}`
}
