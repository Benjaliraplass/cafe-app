// Pantalla para escritorio: Dripo es mobile-first, así que en un computador invitamos a abrirla en el teléfono con un QR.
// Se carga aparte (lazy) para que `uqr` no pese en el bundle del teléfono.
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { encode } from 'uqr'
import { Camera, Coffee, Compass, Home, Plus, Smartphone, SquarePlus, User } from 'lucide-react'
import { Isotipo, Logo } from '@/components/Brand'
import { track } from '@/lib/analytics'

/** URL que codifica el QR: la misma página que se abrió, marcada para atribuir el salto escritorio → teléfono. */
export function desktopQrUrl(href: string): string {
  const url = new URL(href)
  url.searchParams.set('utm_source', 'desktop')
  url.searchParams.set('utm_medium', 'qr')
  return url.toString()
}

/** Contenedor: registra la vista y el "continuar en este navegador". */
export function DesktopGate({ onContinue }: { onContinue: () => void }) {
  const qrUrl = useMemo(() => desktopQrUrl(window.location.href), [])
  useEffect(() => {
    track('desktop_gate_viewed', { path: window.location.pathname })
  }, [])
  return (
    <DesktopGateView
      qrUrl={qrUrl}
      onContinue={() => {
        track('desktop_gate_continued', { path: window.location.pathname })
        onContinue()
      }}
    />
  )
}

export function DesktopGateView({ qrUrl, onContinue }: { qrUrl: string; onContinue: () => void }) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-10 pt-8">
        <Logo className="h-9 w-auto" />
        <span className="eyebrow">Beta por invitación</span>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-16 px-10 py-12">
        <section className="flex max-w-xl flex-col gap-8">
          <div className="flex flex-col gap-5">
            <span className="eyebrow flex items-center gap-2">
              <Smartphone className="size-3.5" strokeWidth={1.8} /> Hecha para tu teléfono
            </span>
            <h1 className="text-[64px] font-medium leading-[0.98] tracking-tightest">Tu diario de café vive en tu bolsillo.</h1>
            <p className="max-w-md text-[18px] leading-relaxed text-muted-foreground">
              Escanea la etiqueta del café que estás tomando, guárdalo en tu diario y recibe recetas a medida. Dripo se usa con la cámara, junto a la taza.
            </p>
          </div>

          <div className="flex items-center gap-7 rounded-[28px] bg-card p-5 pr-8">
            <div className="shrink-0 rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.06)]">
              <QrCode value={qrUrl} size={176} />
            </div>
            <ol className="flex flex-col gap-4">
              <Step icon={<Camera className="size-[18px]" strokeWidth={1.7} />} title="Escanea con la cámara">
                Apunta tu teléfono a este código.
              </Step>
              <Step icon={<SquarePlus className="size-[18px]" strokeWidth={1.7} />} title="Agrégala a tu inicio">
                En Safari: Compartir, luego "Agregar a inicio".
              </Step>
              <Step icon={<Isotipo className="h-[18px] w-auto" />} title="Ábrela como una app">
                Pantalla completa, sin barra del navegador.
              </Step>
            </ol>
          </div>

          <p className="text-sm text-tertiary">
            ¿Prefieres seguir aquí?{' '}
            <button type="button" onClick={onContinue} className="font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Continuar en este navegador
            </button>
          </p>
        </section>

        <PhoneMockup />
      </main>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between px-10 pb-8 text-[13px] text-tertiary">
        <span>dripocoffee.com</span>
        <Link to="/privacidad" className="underline-offset-4 hover:text-muted-foreground hover:underline">
          Política de privacidad
        </Link>
      </footer>
    </div>
  )
}

function Step({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-foreground">{icon}</span>
      <span className="flex flex-col gap-0.5 pt-0.5">
        <span className="text-[15px] font-medium leading-tight">{title}</span>
        <span className="text-sm text-muted-foreground">{children}</span>
      </span>
    </li>
  )
}

/**
 * QR en SVG con módulos redondeados, marcadores de esquina redondeados e isotipo al centro.
 * Corrección de errores alta (H, ~30 %): el hueco del logo (≈20 % del lado) no afecta la lectura.
 */
function QrCode({ value, size }: { value: string; size: number }) {
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
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label="Código QR para abrir Dripo en el teléfono" className="block text-foreground">
      {dots.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.36} fill="currentColor" />
      ))}
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`} fill="currentColor">
          <path
            fillRule="evenodd"
            d={`${roundedRect(x, y, 7, 7, 2.2)} ${roundedRect(x + 1, y + 1, 5, 5, 1.5)}`}
          />
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

/** Teléfono ilustrativo: hero de la app, logo y la barra inferior con el botón central (únicos usos del cereza). */
function PhoneMockup() {
  return (
    <div className="relative hidden lg:block" aria-hidden>
      <div className="absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-card" />
      <div className="relative h-[600px] w-[296px] rounded-[54px] bg-foreground p-[10px] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.45)]">
        <div className="relative flex size-full flex-col overflow-hidden rounded-[44px] bg-background">
          <div className="absolute top-3 left-1/2 z-10 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-foreground" />
          <div className="relative h-[58%] shrink-0">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#6b5c4d_0%,#2a2421_100%)]" />
            <img src="/hero.jpg" alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-x-0 -bottom-px h-[70%] bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.85)_55%,var(--background)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 px-5 pb-1">
              <Logo className="h-[34px] w-auto self-start" />
              <span className="text-[12px] text-muted-foreground">Tu diario de café de especialidad</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 px-5 pt-4">
            <span className="eyebrow text-[9px]">Tus últimos escaneos</span>
            <div className="flex gap-2.5">
              {['Etiopía · Natural', 'Colombia · Honey'].map((t) => (
                <div key={t} className="flex flex-1 flex-col gap-1.5 rounded-2xl bg-card p-2">
                  <div className="aspect-square rounded-xl bg-[linear-gradient(135deg,#6b5c4d_0%,#2a2421_100%)]" />
                  <span className="text-[10px] font-medium leading-tight">{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute inset-x-3 bottom-4 flex items-center justify-between rounded-full border border-foreground/10 bg-background/80 p-1 shadow-[0_4px_12px_-4px_rgb(0_0_0/0.2)] backdrop-blur">
            {[Home, Compass].map((Icon, i) => (
              <span key={i} className={`flex h-8 flex-1 items-center justify-center rounded-full ${i === 0 ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>
                <Icon className="size-4" strokeWidth={1.8} />
              </span>
            ))}
            <span className="mx-1 flex size-9 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <Plus className="size-4" strokeWidth={2} />
            </span>
            {[Coffee, User].map((Icon, i) => (
              <span key={i} className="flex h-8 flex-1 items-center justify-center rounded-full text-muted-foreground">
                <Icon className="size-4" strokeWidth={1.8} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
