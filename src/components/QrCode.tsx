// QR en SVG con la estética de Dripo. Lo usan DesktopGate y la landing (ambos en chunks lazy para que `uqr`
// no pese en el bundle del teléfono).
import { useMemo } from 'react'
import { encode } from 'uqr'
import { Isotipo } from '@/components/Brand'

/** Agrega la atribución del salto escritorio → teléfono a una URL (absoluta o relativa al origen actual). */
export function withQrUtm(href: string, source = 'desktop'): string {
  const url = new URL(href, window.location.origin)
  url.searchParams.set('utm_source', source)
  url.searchParams.set('utm_medium', 'qr')
  return url.toString()
}

/**
 * QR con módulos redondeados, marcadores de esquina redondeados e isotipo al centro.
 * Corrección de errores alta (H, ~30 %): el hueco del logo (≈20 % del lado) no afecta la lectura.
 */
export function QrCode({ value, size, label = 'Código QR para abrir Dripo en el teléfono' }: { value: string; size: number; label?: string }) {
  const { n, dots } = useMemo(() => {
    const qr = encode(value, { ecc: 'H', border: 0 })
    const n = qr.size
    const hole = Math.ceil(n * 0.22) | 1 // impar, centrado
    const h0 = (n - hole) / 2
    const inFinder = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7)
    const inHole = (x: number, y: number) => x >= h0 - 0.5 && x < h0 + hole + 0.5 && y >= h0 - 0.5 && y < h0 + hole + 0.5
    const dots: Array<[number, number]> = []
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.data[y][x] && !inFinder(x, y) && !inHole(x, y)) dots.push([x, y])
    return { n, dots }
  }, [value])

  const finders: Array<[number, number]> = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ]
  const logo = n * 0.16
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label={label} className="block text-[#111111]">
      {dots.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.36} fill="currentColor" />
      ))}
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`} fill="currentColor">
          <path fillRule="evenodd" d={`${roundedRect(x, y, 7, 7, 2.2)} ${roundedRect(x + 1, y + 1, 5, 5, 1.5)}`} />
          <rect x={x + 2} y={y + 2} width={3} height={3} rx={1} />
        </g>
      ))}
      <Isotipo x={(n - logo * 0.7) / 2} y={(n - logo) / 2} width={logo * 0.7} height={logo} />
    </svg>
  )
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - 2 * r}a${r},${r} 0 0 1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`
}
