// Landing pública de dripocoffee.com (sin sesión, en `/`). One pager que cuenta qué es Dripo; todos los CTA
// llevan a crear cuenta (/unete) o a entrar (/entrar). En escritorio los CTA abren un QR para seguir en el teléfono.
// Se carga aparte (lazy): quien ya tiene sesión nunca la descarga, y el QR (`uqr`) queda fuera del bundle principal.
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Camera,
  ChevronDown,
  Globe,
  LogIn,
  Mail,
  MapPin,
  Plus,
  ScanLine,
  Share2,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import { Isotipo, Logo } from '@/components/Brand'
import { QrCode, withQrUtm } from '@/components/QrCode'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { track } from '@/lib/analytics'
import { listRecentlyScannedCoffees, type RecentCoffee } from '@/lib/api'
import { cn } from '@/lib/utils'

export type LandingCta = 'signup' | 'login'
/** Devuelve true si el contenedor se hizo cargo del clic (en escritorio: abre el QR en vez de navegar). */
type OnCta = (cta: LandingCta, placement: string) => boolean

const HREF: Record<LandingCta, string> = { signup: '/unete', login: '/entrar' }

/** Contenedor: analítica y decisión escritorio (QR) vs. teléfono (navega). */
export function Landing() {
  const desktop = useIsDesktop()
  const [qr, setQr] = useState<LandingCta | null>(null)
  const [recent, setRecent] = useState<RecentCoffee[]>([])
  useEffect(() => {
    // Si falla o hay pocos, la marquesina muestra los campos que lee de una etiqueta.
    listRecentlyScannedCoffees().then(setRecent).catch(() => {})
  }, [])
  useEffect(() => {
    track('landing_viewed', { desktop })
    // Solo al montar: la vista se cuenta una vez por carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <LandingView
      recent={recent}
      qr={qr}
      onCloseQr={() => setQr(null)}
      onCta={(cta, placement) => {
        track('landing_cta_clicked', { cta, placement, desktop })
        if (!desktop) return false
        setQr(cta)
        return true
      }}
    />
  )
}

export function LandingView({
  recent = [],
  qr = null,
  onCloseQr = () => {},
  onCta = () => false,
}: {
  recent?: RecentCoffee[]
  qr?: LandingCta | null
  onCloseQr?: () => void
  onCta?: OnCta
}) {
  const root = useReveal()
  return (
    <div ref={root} className="min-h-full bg-background text-foreground">
      <Nav onCta={onCta} />
      <main>
        <Hero onCta={onCta} />
        <LabelMarquee recent={recent} />
        <HowItWorks />
        <Gallery />
        <Features />
        <RecipeEngine />
        <Bento />
        <TostadoClub onCta={onCta} />
        <Faq />
        <FinalCta onCta={onCta} />
      </main>
      <Footer onCta={onCta} />
      {qr && <QrDialog cta={qr} onClose={onCloseQr} />}
    </div>
  )
}

/* ---------- Piezas comunes ---------- */

function CtaLink({ cta, placement, onCta, className, children }: { cta: LandingCta; placement: string; onCta: OnCta; className?: string; children: ReactNode }) {
  return (
    <Link
      to={HREF[cta]}
      className={className}
      onClick={(e: MouseEvent) => {
        if (onCta(cta, placement)) e.preventDefault()
      }}
    >
      {children}
    </Link>
  )
}

const btn = 'inline-flex h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium transition-[background-color,color,transform] active:scale-[0.985]'

function SectionHead({ eyebrow, title, body, className, dark = false }: { eyebrow: string; title: ReactNode; body?: ReactNode; className?: string; dark?: boolean }) {
  return (
    <div data-reveal className={cn('flex max-w-2xl flex-col gap-4', className)}>
      <span className={cn('eyebrow', dark && 'text-white/50')}>{eyebrow}</span>
      <h2 className="text-[34px] font-medium leading-[1.04] tracking-tightest text-balance sm:text-[44px] lg:text-[52px]">{title}</h2>
      {body && <p className={cn('max-w-xl text-[16px] leading-relaxed lg:text-[18px]', dark ? 'text-white/65' : 'text-muted-foreground')}>{body}</p>}
    </div>
  )
}

/** Aparición suave al entrar en pantalla (solo si el usuario no pidió reducir movimiento; ver index.css). */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      el?.querySelectorAll('[data-reveal]').forEach((n) => n.setAttribute('data-shown', ''))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute('data-shown', '')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    el.querySelectorAll('[data-reveal]').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])
  return ref
}

/** Fondo de respaldo mientras carga una foto (o si no carga): el degradado café de la app. */
const coffeeGradient = 'bg-[linear-gradient(135deg,#6b5c4d_0%,#2a2421_100%)]'

/** Fotos de `public/fotos/` (exportadas a JPEG desde las originales de Benjamín; ver ROADMAP Lote 17). */
const FOTO = {
  // Portada: única versión disponible (736 px); clara, por eso el hero del teléfono usa texto oscuro.
  portada: '/fotos/portada.jpg',
  espresso: '/fotos/espresso.jpg',
  gota: '/fotos/gota.jpg',
  granos: '/fotos/granos.jpg',
  origami: '/fotos/origami.jpg',
  bloom: '/fotos/bloom.jpg',
  goteo: '/fotos/goteo.jpg',
  caja: '/fotos/caja-tostado-club.jpg',
  thumb: {
    espresso: '/fotos/espresso-thumb.jpg',
    vertido: '/fotos/vertido-thumb.jpg',
    granos: '/fotos/granos-thumb.jpg',
    origami: '/fotos/origami-thumb.jpg',
    bloom: '/fotos/bloom-thumb.jpg',
  },
}

/** Foto que cubre su contenedor. Decorativa salvo que se le pase `alt`. */
function Cover({ src, srcSet, sizes, alt = '', className, priority = false }: { src: string; srcSet?: string; sizes?: string; alt?: string; className?: string; priority?: boolean }) {
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={cn('absolute inset-0 size-full object-cover', className)}
      onError={(e) => {
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}

/** Miniatura cuadrada con foto (tarjetas de ejemplo). */
function Thumb({ src, className }: { src: string; className?: string }) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden', coffeeGradient, className)}>
      <Cover src={src} />
    </div>
  )
}

/* ---------- Navegación ---------- */

function Nav({ onCta }: { onCta: OnCta }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-[max(env(safe-area-inset-top),10px)] lg:px-6">
      <div
        className={cn(
          'mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 rounded-full pr-2 pl-5 transition-[background-color,color,box-shadow] duration-300',
          scrolled ? 'glass-solid text-foreground' : 'text-foreground',
        )}
      >
        <a href="#top" aria-label="Dripo, ir al inicio" className="shrink-0">
          <Logo className="h-[26px] w-auto" />
        </a>
        <nav className="hidden items-center gap-7 text-[14px] text-muted-foreground lg:flex">
          <a href="#como-funciona" className="hover:text-foreground">Cómo funciona</a>
          <a href="#recetas" className="hover:text-foreground">Recetas</a>
          <a href="#mas" className="hover:text-foreground">Explorar</a>
          <a href="#preguntas" className="hover:text-foreground">Preguntas</a>
        </nav>
        <div className="flex items-center gap-1.5">
          <CtaLink cta="login" placement="nav" onCta={onCta} className="rounded-full px-3.5 py-2 text-[14px] font-medium opacity-90 hover:opacity-100">
            Entrar
          </CtaLink>
          <CtaLink
            cta="signup"
            placement="nav"
            onCta={onCta}
            className={cn(
              'h-10 items-center rounded-full px-4 text-[14px] font-medium transition-colors',
              // En el teléfono aparece al bajar: sobre el hero ya están los dos CTA grandes.
              scrolled ? 'inline-flex bg-primary text-primary-foreground' : 'hidden lg:inline-flex lg:bg-primary lg:text-primary-foreground',
            )}
          >
            Crear cuenta
          </CtaLink>
        </div>
      </div>
    </header>
  )
}

/* ---------- Hero ---------- */

function Hero({ onCta }: { onCta: OnCta }) {
  return (
    <section id="top" className="relative lg:mx-auto lg:grid lg:max-w-6xl lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14 lg:px-6 lg:pt-28 lg:pb-10">
      {/* Foto: a sangre en el teléfono, panel redondeado a la derecha en escritorio. */}
      {/* Respaldo blanco en el teléfono: un fondo oscuro se asomaba como línea en los bordes cuando el alto cae en fracción de píxel. */}
      <div className="absolute inset-x-0 top-0 h-[60svh] min-h-[400px] overflow-hidden bg-background lg:relative lg:order-2 lg:h-[640px] lg:min-h-0 lg:rounded-[36px] lg:bg-[linear-gradient(135deg,#6b5c4d_0%,#2a2421_100%)]">
        <Cover src={FOTO.portada} priority className="object-top lg:object-center" />
        {/* Teléfono: fundido a blanco bajo el texto (como en Login). Escritorio: sombra suave para separar la tarjeta. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_45%,rgba(255,255,255,0.75)_76%,var(--background)_95%)] lg:bg-[linear-gradient(to_bottom,rgba(17,17,17,0)_55%,rgba(17,17,17,0.2)_100%)]" />
        <div className="landing-scanline absolute inset-x-0 top-0 hidden h-px bg-[#111111]/25 lg:block" />
        <div className="absolute right-6 bottom-6 left-6 hidden lg:block">
          <ScanCard />
        </div>
      </div>

      <div className="relative z-10 flex min-h-[100svh] flex-col justify-end gap-7 px-5 pt-28 pb-[max(env(safe-area-inset-bottom),28px)] text-foreground sm:px-8 lg:order-1 lg:min-h-0 lg:p-0">
        <span className="landing-rise flex w-fit items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-[12px] font-medium backdrop-blur-md lg:bg-card">
          <Sparkles className="size-3.5" strokeWidth={1.8} />
          Beta por invitación
        </span>
        <div className="flex flex-col gap-5">
          <h1 className="landing-rise text-[46px] font-medium leading-[0.98] tracking-tightest text-balance [animation-delay:80ms] sm:text-[60px] lg:text-[72px]">
            Fotografía tu café. <span className="text-muted-foreground">Te decimos cómo prepararlo.</span>
          </h1>
          <p className="landing-rise max-w-[30rem] text-[17px] leading-relaxed text-muted-foreground [animation-delay:160ms] lg:text-[19px]">
            Dripo lee la etiqueta de cualquier café de especialidad y te arma una receta para tu método y tu equipo. Guarda lo que pruebas y cada taza sale mejor.
          </p>
        </div>
        <div className="landing-rise flex flex-col gap-3 [animation-delay:240ms] sm:flex-row">
          <CtaLink cta="signup" placement="hero" onCta={onCta} className={cn(btn, 'bg-primary text-primary-foreground hover:bg-primary/90')}>
            Crear cuenta <ArrowRight className="size-4" strokeWidth={2} />
          </CtaLink>
          <CtaLink cta="login" placement="hero" onCta={onCta} className={cn(btn, 'border border-border-strong bg-background/70 text-foreground backdrop-blur-md hover:bg-card lg:bg-transparent')}>
            Ya tengo cuenta
          </CtaLink>
        </div>
        <ul className="landing-rise flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground [animation-delay:320ms]">
          <li className="flex items-center gap-1.5"><Dot /> Hecha para tu teléfono</li>
          <li className="flex items-center gap-1.5"><Dot /> Sin descargar nada</li>
          <li className="flex items-center gap-1.5"><Dot /> Gratis durante la beta</li>
        </ul>
      </div>
    </section>
  )
}

function Dot() {
  return <span className="size-1 rounded-full bg-current opacity-70" />
}

/** Tarjeta "leyendo etiqueta": los campos aparecen uno tras otro, como en el escaneo real. */
function ScanCard({ className }: { className?: string }) {
  const rows: Array<[string, string]> = [
    ['Tostador', 'Pantera Coffee Roasters'],
    ['Origen', 'Etiopía · Sidama'],
    ['Variedad', 'Heirloom'],
    ['Proceso', 'Natural'],
    ['Altura', '2.100–2.300 msnm'],
    ['Notas', 'Arándano, frutilla, jazmín'],
  ]
  return (
    <div className={cn('rounded-[24px] border border-white/40 bg-white/80 p-4 text-[#111111] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl', className)}>
      <div className="flex items-center justify-between pb-3">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <span className="flex size-6 items-center justify-center rounded-full bg-[#111111] text-white">
            <ScanLine className="size-3.5" strokeWidth={2} />
          </span>
          Leyendo la etiqueta
        </span>
        <span className="landing-shimmer rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-[#6b6763]">IA</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {rows.map(([k, v], i) => (
          <div key={k} className="landing-field flex flex-col" style={{ animationDelay: `${400 + i * 260}ms` }}>
            <dt className="text-[10px] font-medium uppercase tracking-eyebrow text-[#9a958f]">{k}</dt>
            <dd className="truncate text-[14px] font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ---------- Marquesina: lo que lee de una etiqueta ---------- */

/** Con menos de estos cafés reales, la marquesina muestra los campos de la etiqueta (se vería pobre y repetida). */
const MIN_RECENT = 6

function LabelMarquee({ recent }: { recent: RecentCoffee[] }) {
  const coffees = recent.length >= MIN_RECENT
  const fields = ['Tostador', 'País de origen', 'Región', 'Finca', 'Variedad', 'Proceso', 'Altura', 'Nivel de tueste', 'Notas de cata', 'Fecha de tueste']
  const count = coffees ? recent.length : fields.length
  // Misma velocidad aparente con pocos o muchos ítems (los cafés son más anchos que los campos).
  const duration = `${count * (coffees ? 5 : 3.8)}s`
  return (
    <section aria-label={coffees ? 'Cafés que la comunidad ya guardó en Dripo' : 'Lo que Dripo lee de una etiqueta'} className="border-b border-border py-7 lg:py-9">
      <p className="flex items-center justify-center gap-2 px-5 pb-4 text-center text-[13px] text-muted-foreground">
        {coffees ? (
          <>
            <span className="relative flex size-2">
              <span className="landing-ping absolute inset-0 rounded-full bg-foreground/40" />
              <span className="relative size-2 rounded-full bg-foreground" />
            </span>
            Cafés que la comunidad ya guardó en Dripo
          </>
        ) : (
          'Una foto a la bolsa y Dripo llena la ficha por ti'
        )}
      </p>
      <div className="landing-marquee-mask overflow-hidden">
        <div className="landing-marquee flex w-max gap-3" style={{ animationDuration: duration }}>
          {coffees
            ? [...recent, ...recent].map((c, i) => (
                <span key={i} aria-hidden={i >= recent.length} className="flex h-12 shrink-0 items-center gap-2.5 rounded-full bg-card pr-5 pl-4 text-[14px]">
                  <Isotipo className="h-3.5 w-auto shrink-0 text-tertiary" aria-hidden />
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">{c.roaster}</span>
                  <span className="rounded-full bg-background px-2 py-0.5 text-[12px] text-muted-foreground">{c.origin}</span>
                </span>
              ))
            : [...fields, ...fields].map((t, i) => (
                <span key={i} aria-hidden={i >= fields.length} className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-card px-4 text-[14px] font-medium">
                  <Isotipo className="h-3.5 w-auto text-tertiary" aria-hidden />
                  {t}
                </span>
              ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- Cómo funciona ---------- */

function HowItWorks() {
  const steps = [
    { n: '01', title: 'Escanea la bolsa', body: 'Hasta tres fotos: frente, dorso o la etiqueta del costado. La IA junta todo y completa la ficha.', mock: <MockScan /> },
    { n: '02', title: 'Guárdalo en tu diario', body: 'Tu puntaje, tus notas, dónde lo compraste y cómo lo preparaste. Todo en un lugar.', mock: <MockDiary /> },
    { n: '03', title: 'Prepáralo mejor', body: 'Pide una receta para ese café y tu método: dosis, agua, temperatura, molienda y pasos con tiempo.', mock: <MockRecipe /> },
  ]
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:px-6 lg:py-28">
      <SectionHead eyebrow="Cómo funciona" title="De la bolsa a la taza en tres pasos." body="Dripo se usa junto a la taza, con la cámara del teléfono. Sin formularios eternos ni planillas." />
      <div className="grid gap-4 pt-12 lg:grid-cols-3 lg:gap-5">
        {steps.map((s, i) => (
          <article key={s.n} data-reveal style={{ transitionDelay: `${i * 90}ms` }} className="flex flex-col gap-5 rounded-[28px] bg-card p-3 pb-6">
            <div className="h-[280px] overflow-hidden rounded-[22px]">{s.mock}</div>
            <div className="flex flex-col gap-2 px-3">
              <span className="text-[13px] font-medium text-tertiary">{s.n}</span>
              <h3 className="text-[22px] font-medium leading-tight tracking-tight">{s.title}</h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function MockScan() {
  return (
    <div className={cn('relative flex size-full items-center justify-center overflow-hidden', coffeeGradient)}>
      <Cover src={FOTO.granos} />
      <div className="absolute inset-0 bg-[#111111]/45" />
      {/* Bolsa ilustrada */}
      <div className="relative h-[200px] w-[150px] rounded-[18px] rounded-t-[10px] bg-[#e8dfd1] shadow-[0_20px_40px_-16px_rgba(0,0,0,0.6)]">
        <div className="absolute inset-x-0 top-0 h-5 rounded-t-[10px] bg-[#d9cdbb]" />
        <div className="absolute inset-x-4 top-10 flex flex-col items-center gap-2 rounded-xl bg-white/80 px-3 py-4">
          <Isotipo className="h-5 w-auto text-[#2a2421]" />
          <span className="h-1.5 w-16 rounded-full bg-[#2a2421]/70" />
          <span className="h-1 w-12 rounded-full bg-[#2a2421]/30" />
          <span className="h-1 w-14 rounded-full bg-[#2a2421]/30" />
        </div>
      </div>
      {/* Marco de escaneo */}
      <div className="pointer-events-none absolute inset-y-9 left-1/2 w-[196px] -translate-x-1/2">
        {['top-0 left-0 border-t-2 border-l-2 rounded-tl-xl', 'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl', 'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl', 'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl'].map((c) => (
          <span key={c} className={cn('absolute size-6 border-white', c)} />
        ))}
        <span className="landing-scanline absolute inset-x-2 top-0 h-px bg-white shadow-[0_0_16px_3px_rgba(255,255,255,0.6)]" />
      </div>
      <div className="absolute inset-x-3 bottom-3 flex flex-wrap justify-center gap-1.5">
        {['Etiopía', 'Natural', 'Heirloom', 'Tueste claro'].map((t, i) => (
          <span key={t} className="landing-field rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-medium text-[#111111]" style={{ animationDelay: `${600 + i * 220}ms` }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

function MockDiary() {
  return (
    <div className="flex size-full flex-col justify-center gap-2.5 bg-background p-4">
      {[
        { name: 'Sidama Dembi', meta: 'Etiopía · Pantera Coffee Roasters', r: 5, notes: ['Arándano', 'Frutilla'], img: FOTO.thumb.granos },
        { name: 'Finca Milán', meta: 'Colombia · Pereira', r: 4, notes: ['Panela', 'Naranja'], img: FOTO.thumb.bloom },
        { name: 'Bourbon Rosado', meta: 'Huila · Lavado', r: 4, notes: ['Frutilla'], img: FOTO.thumb.vertido },
      ].map((c, i) => (
        <div key={c.name} className={cn('flex items-center gap-3 rounded-2xl bg-card p-2.5', i === 0 && 'shadow-[0_10px_30px_-14px_rgba(0,0,0,0.35)]')}>
          <Thumb src={c.img} className="size-14 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[14px] font-medium leading-tight">{c.name}</span>
            <span className="truncate text-[12px] text-muted-foreground">{c.meta}</span>
            <span className="flex items-center gap-1.5">
              <span className="flex">
                {Array.from({ length: 5 }, (_, k) => (
                  <Star key={k} className={cn('size-3', k < c.r ? 'fill-foreground text-foreground' : 'text-border-strong')} strokeWidth={1.5} />
                ))}
              </span>
              <span className="truncate text-[11px] text-tertiary">{c.notes.join(' · ')}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function MockRecipe() {
  const steps: Array<[string, string]> = [
    ['0:00', 'Bloom hasta 45 g'],
    ['0:45', 'Vierte hasta 110 g'],
    ['1:10', 'Vierte hasta 175 g'],
    ['1:35', 'Vierte hasta 240 g'],
  ]
  return (
    <div className="flex size-full flex-col gap-3 bg-[#111111] p-4 text-white">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium">V60 · Sidama Dembi</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">1 taza</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[
          ['15 g', 'café'],
          ['240 g', 'agua'],
          ['94 °C', 'temp.'],
          ['2:45', 'tiempo'],
        ].map(([v, k]) => (
          <div key={k} className="flex flex-col rounded-xl bg-white/[0.07] px-2 py-2">
            <span className="text-[15px] font-medium leading-tight">{v}</span>
            <span className="text-[10px] text-white/50">{k}</span>
          </div>
        ))}
      </div>
      <ol className="flex flex-1 flex-col justify-between gap-1 pt-1">
        {steps.map(([t, s], i) => (
          <li key={t} className="flex items-center gap-3">
            <span className={cn('w-9 text-[12px] tabular-nums', i === 0 ? 'text-white' : 'text-white/45')}>{t}</span>
            <span className={cn('h-px flex-none', i === 0 ? 'w-3 bg-white' : 'w-3 bg-white/20')} />
            <span className={cn('text-[13px]', i === 0 ? 'text-white' : 'text-white/60')}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ---------- Features con panel (acordeón) ---------- */

const FEATURES = [
  {
    id: 'receta',
    icon: BookOpen,
    title: 'Recetas a medida',
    bullets: ['Según el origen, el proceso y el tueste del café', 'Ajustada a tu método, tu molino y tu dripper', 'Con el porqué de cada decisión, no solo números'],
    caption: 'Una receta para este café. No la misma receta de siempre para todos.',
  },
  {
    id: 'feedback',
    icon: Sparkles,
    title: 'Aprende de cada taza',
    bullets: ['Después de preparar, un toque: ácido, amargo, débil, intenso o perfecto', 'Un solo ajuste claro para la próxima vez', 'La siguiente receta de ese café parte desde ahí'],
    caption: 'Cuéntale cómo salió y la próxima taza sale mejor.',
  },
  {
    id: 'origen',
    icon: Globe,
    title: 'De dónde viene',
    bullets: ['El país, la región y, cuando hay fuente, la finca', 'Contado corto, para leer mientras se enfría', 'Un dato curioso para la sobremesa'],
    caption: 'Cada café tiene una historia. Dripo te la cuenta.',
  },
  {
    id: 'gusto',
    icon: Star,
    title: 'Tu perfil de gusto',
    bullets: ['Seis preguntas sobre lo que te gusta en la taza', 'Aprende de los cafés que más puntúas', 'Te muestra los cafés que van contigo'],
    caption: 'Mientras más cafés guardas, mejor te conoce.',
  },
] as const

type FeatureId = (typeof FEATURES)[number]['id']

function Features() {
  const [active, setActive] = useState<FeatureId>('receta')
  const [auto, setAuto] = useState(true)
  // Avanza solo cada 7 s hasta que el usuario elige uno (y nunca si pidió reducir movimiento).
  useEffect(() => {
    if (!auto || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(() => {
      const i = FEATURES.findIndex((f) => f.id === active)
      setActive(FEATURES[(i + 1) % FEATURES.length].id)
    }, 7000)
    return () => window.clearTimeout(t)
  }, [active, auto])
  const current = FEATURES.find((f) => f.id === active)!

  return (
    <section id="recetas" className="scroll-mt-20 bg-card py-20 lg:py-28">
      {/* Teléfono: título, panel, acordeón. Escritorio: panel a la izquierda (dos filas), título y acordeón a la derecha. */}
      <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-x-16 lg:gap-y-8 lg:px-6">
        <SectionHead
          className="lg:col-start-2 lg:row-start-1 lg:self-end"
          eyebrow="Recetas e IA"
          title="Tu café, tu método, tu receta."
          body="Dripo conoce el café que tienes en la mano y el equipo con el que preparas. Con eso arma una receta concreta y aprende de cómo te salió."
        />
        <div data-reveal className="flex flex-col gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-center">
          <div className={cn('relative flex h-[460px] items-center justify-center overflow-hidden rounded-[32px] p-5 sm:h-[520px]', coffeeGradient)}>
            <Cover src={FOTO.origami} />
            <div className="absolute inset-0 bg-[#111111]/35" />
            <div key={active} className="landing-swap relative w-full max-w-[360px]">
              {active === 'receta' && <PanelRecipe />}
              {active === 'feedback' && <PanelFeedback />}
              {active === 'origen' && <PanelOrigin />}
              {active === 'gusto' && <PanelTaste />}
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 px-1 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex shrink-0 gap-1.5">
              {FEATURES.map((f) => (
                <span key={f.id} className="relative h-1 w-7 overflow-hidden rounded-full bg-border-strong/70">
                  {f.id === active && <span className={cn('absolute inset-0 rounded-full bg-foreground', auto && 'landing-progress')} />}
                </span>
              ))}
            </div>
            <p className="text-[14px] text-muted-foreground">
              <span className="font-medium text-foreground">{current.title}.</span> {current.caption}
            </p>
          </div>
        </div>

        <div data-reveal className="lg:col-start-2 lg:row-start-2 lg:self-start">
          <div className="flex flex-col">
            {FEATURES.map((f) => {
              const open = f.id === active
              const Icon = f.icon
              return (
                <div key={f.id} className="border-t border-border-strong/60 last:border-b">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => {
                      setActive(f.id)
                      setAuto(false)
                    }}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left"
                  >
                    <span className="flex items-center gap-3 text-[17px] font-medium">
                      <Icon className="size-[18px]" strokeWidth={1.7} />
                      {f.title}
                    </span>
                    <Plus className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-300', open && 'rotate-45')} strokeWidth={1.8} />
                  </button>
                  <div className={cn('grid transition-[grid-template-rows] duration-300', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                    <ul className="flex flex-col gap-2 overflow-hidden pl-[30px]">
                      {f.bullets.map((b, i) => (
                        <li key={b} className={cn('text-[15px] leading-snug text-muted-foreground', i === f.bullets.length - 1 && 'pb-5')}>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function PanelCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-[24px] bg-white p-5 text-[#111111] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]', className)}>{children}</div>
}

function PanelRecipe() {
  return (
    <PanelCard className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-eyebrow text-[#9a958f]">Receta para</span>
        <span className="text-[20px] font-medium leading-tight tracking-tight">Sidama Dembi en V60</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {['Natural', 'Tueste claro', 'Comandante C40', 'Hario V60 02'].map((t) => (
          <span key={t} className="rounded-full bg-[#f5f4f1] px-2.5 py-1 text-[12px] text-[#6b6763]">{t}</span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['15 g', 'Café'],
          ['240 g', 'Agua'],
          ['94 °C', 'Temperatura'],
          ['Media-fina', 'Molienda'],
          ['1:16', 'Ratio'],
          ['2:45', 'Tiempo'],
        ].map(([v, k]) => (
          <div key={k} className="flex flex-col rounded-xl bg-[#f5f4f1] px-2.5 py-2">
            <span className="text-[15px] font-medium">{v}</span>
            <span className="text-[11px] text-[#9a958f]">{k}</span>
          </div>
        ))}
      </div>
      <p className="border-t border-[#e6e3de] pt-3 text-[13px] leading-relaxed text-[#6b6763]">
        <span className="font-medium text-[#111111]">Por qué: </span>un natural de tueste claro necesita agua bien caliente para abrir su dulzor sin quedar plano.
      </p>
    </PanelCard>
  )
}

function PanelFeedback() {
  const chips = ['Muy ácido', 'Amargo', 'Débil', 'Muy intenso', 'Perfecto']
  return (
    <div className="flex flex-col gap-3">
      <PanelCard className="flex flex-col gap-3">
        <span className="text-[17px] font-medium">¿Cómo salió?</span>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c, i) => (
            <span key={c} className={cn('rounded-full border px-3 py-1.5 text-[13px] font-medium', i === 0 ? 'border-[#111111] bg-[#111111] text-white' : 'border-[#e6e3de] text-[#6b6763]')}>
              {c}
            </span>
          ))}
        </div>
      </PanelCard>
      <PanelCard className="landing-field flex items-start gap-3 [animation-delay:350ms]">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f5f4f1]">
          <Sparkles className="size-4" strokeWidth={1.8} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-eyebrow text-[#9a958f]">Próxima vez</span>
          <span className="text-[15px] font-medium leading-snug">Muele un paso más fino. Mismo ratio y misma agua.</span>
        </span>
      </PanelCard>
    </div>
  )
}

function PanelOrigin() {
  const rows = [
    { k: 'País', t: 'Colombia', b: 'Cosecha casi todo el año gracias a sus tres cordilleras.' },
    { k: 'Región', t: 'Pereira, Risaralda', b: 'En el Eje Cafetero, entre 1.300 y 1.900 msnm, con suelos volcánicos.' },
    { k: 'Finca', t: 'Finca Milán', b: 'Variedades poco comunes y fermentaciones controladas.' },
  ]
  return (
    <PanelCard className="flex flex-col gap-1">
      <span className="flex items-center gap-2 pb-2 text-[17px] font-medium">
        <MapPin className="size-4" strokeWidth={1.8} /> De dónde viene
      </span>
      {rows.map((r, i) => (
        <div key={r.k} className="landing-field flex gap-3 border-t border-[#e6e3de] py-3" style={{ animationDelay: `${150 + i * 200}ms` }}>
          <span className="w-12 shrink-0 pt-0.5 text-[10px] font-medium uppercase tracking-eyebrow text-[#9a958f]">{r.k}</span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-medium leading-tight">{r.t}</span>
            <span className="text-[13px] leading-snug text-[#6b6763]">{r.b}</span>
          </span>
        </div>
      ))}
    </PanelCard>
  )
}

function PanelTaste() {
  const bars: Array<[string, number]> = [
    ['Frutal', 82],
    ['Floral', 58],
    ['Dulce y caramelo', 44],
    ['Chocolate', 26],
  ]
  return (
    <div className="flex flex-col gap-3">
      <PanelCard className="flex flex-col gap-3">
        <span className="text-[17px] font-medium">Tu perfil de gusto</span>
        {bars.map(([k, v], i) => (
          <div key={k} className="flex flex-col gap-1">
            <span className="flex justify-between text-[13px]">
              <span>{k}</span>
              <span className="text-[#9a958f]">{v} %</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-[#f5f4f1]">
              <span className="landing-bar block h-full rounded-full bg-[#111111]" style={{ width: `${v}%`, animationDelay: `${i * 120}ms` }} />
            </span>
          </div>
        ))}
      </PanelCard>
      <PanelCard className="flex items-center gap-3 p-3">
        <Thumb src={FOTO.thumb.espresso} className="size-11 rounded-xl" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-medium">Kenia AA · Lavado</span>
          <span className="truncate text-[12px] text-[#6b6763]">Va contigo: frutal y floral</span>
        </span>
        <ArrowRight className="size-4 text-[#9a958f]" strokeWidth={1.8} />
      </PanelCard>
    </div>
  )
}

/* ---------- Cómo se arma una receta (sección oscura) ---------- */

function RecipeEngine() {
  const cols = [
    { k: 'Lo que sabe de tu café', items: ['Origen y región', 'Variedad y proceso', 'Nivel de tueste', 'Notas de cata'] },
    { k: 'Lo que sabe de ti', items: ['Tu método y tu dripper', 'Tu molino y tu máquina', 'Tu perfil de gusto', 'Cómo salió la última vez'] },
    { k: 'Lo que recibes', items: ['Dosis, agua y ratio', 'Temperatura y molienda', 'Pasos con tiempo', 'El porqué de cada ajuste'] },
  ]
  return (
    <section className="bg-[#111111] py-20 text-white lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-6">
        <SectionHead dark eyebrow="Detrás de cada receta" title="No es una receta genérica. Es la tuya." body="Dripo cruza lo que dice la etiqueta con tu equipo y tu historial. Si la última taza salió ácida, la próxima receta ya viene corregida." />
        <div className="grid gap-3 pt-12 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-4">
          {cols.map((c, i) => (
            <FragmentWithArrow key={c.k} last={i === cols.length - 1}>
              <div data-reveal style={{ transitionDelay: `${i * 110}ms` }} className={cn('flex flex-col gap-4 rounded-[24px] p-6', i === 2 ? 'bg-white text-[#111111]' : 'bg-white/[0.06]')}>
                <span className={cn('text-[11px] font-medium uppercase tracking-eyebrow', i === 2 ? 'text-[#9a958f]' : 'text-white/45')}>{c.k}</span>
                <ul className="flex flex-col gap-3">
                  {c.items.map((it) => (
                    <li key={it} className="flex items-center gap-3 text-[16px]">
                      <span className={cn('size-1.5 shrink-0 rounded-full', i === 2 ? 'bg-[#111111]' : 'bg-white/40')} />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </FragmentWithArrow>
          ))}
        </div>
      </div>
    </section>
  )
}

function FragmentWithArrow({ children, last }: { children: ReactNode; last: boolean }) {
  return (
    <>
      {children}
      {!last && (
        <div className="flex items-center justify-center text-white/30" aria-hidden>
          <ArrowRight className="size-5 rotate-90 lg:rotate-0" strokeWidth={1.6} />
        </div>
      )}
    </>
  )
}

/* ---------- Bento: y mucho más ---------- */

function Bento() {
  return (
    <section id="mas" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:px-6 lg:py-28">
      <SectionHead eyebrow="Y mucho más" title="Todo lo que rodea a una buena taza." />
      <div className="grid gap-4 pt-12 lg:grid-cols-3 lg:gap-5">
        <BentoCard className="lg:col-span-2" title="Cafeterías de especialidad cerca de ti" body="Un mapa curado de cafeterías y tostadurías en Chile, ordenado por distancia. Y si falta tu favorita, la propones.">
          <MiniMap />
        </BentoCard>
        <BentoCard title="Como una app, sin descargarla" body="Agrégala a tu pantalla de inicio y se abre a pantalla completa, como cualquier app.">
          <div className="flex h-full items-center justify-center gap-5">
            <div className="flex flex-col items-center gap-2">
              <span className="flex size-[72px] items-center justify-center rounded-[20px] bg-brand text-brand-foreground shadow-[0_16px_30px_-14px_rgba(200,16,46,0.7)]">
                <Isotipo className="h-9 w-auto" aria-hidden />
              </span>
              <span className="text-[12px] text-muted-foreground">Dripo</span>
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 opacity-60">
                <span className="size-[72px] rounded-[20px] bg-muted" />
                <span className="h-2 w-10 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </BentoCard>
        <BentoCard title="Recetas destacadas" body="Recetas curadas para empezar, con foto y paso a paso.">
          <div className="flex h-full items-center justify-center">
            <div className="relative h-[150px] w-[220px]">
              {[
                ['AeroPress invertida', FOTO.thumb.vertido],
                ['Chemex para dos', FOTO.thumb.origami],
                ['V60 en 4 vertidos', FOTO.thumb.bloom],
              ].map(([t, img], i) => (
                <div
                  key={t}
                  className="absolute inset-x-0 flex h-[64px] items-center gap-3 rounded-2xl bg-background p-2 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.35)]"
                  style={{ top: `${i * 42}px`, transform: `scale(${0.92 + i * 0.04})` }}
                >
                  <Thumb src={img} className="size-12 rounded-xl" />
                  <span className="text-[13px] font-medium leading-tight">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </BentoCard>
        <BentoCard title="Comparte lo que te gustó" body="Cada café y cada receta tiene su ficha pública. Mándala por WhatsApp en un toque.">
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="flex w-full max-w-[250px] items-center gap-3 rounded-2xl bg-background p-2.5 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.35)]">
              <Thumb src={FOTO.thumb.granos} className="size-11 rounded-xl" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-medium">Sidama Dembi</span>
                <span className="truncate text-[11px] text-muted-foreground">dripocoffee.com/c/sidama-dembi</span>
              </span>
            </div>
            <span className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground">
              <Share2 className="size-3.5" strokeWidth={2} /> Compartir
            </span>
          </div>
        </BentoCard>
        <BentoCard title="Tu diario en números" body="Cafés probados, recetas guardadas y semanas seguidas con al menos una taza.">
          <div className="flex h-full items-center justify-center">
            <div className="grid w-full max-w-[260px] grid-cols-3 gap-2">
              {[
                ['24', 'cafés'],
                ['11', 'recetas'],
                ['6', 'semanas'],
              ].map(([v, k]) => (
                <div key={k} className="flex flex-col items-center rounded-2xl bg-background py-4">
                  <span className="text-[30px] font-medium leading-none tracking-tightest">{v}</span>
                  <span className="pt-1 text-[12px] text-muted-foreground">{k}</span>
                </div>
              ))}
            </div>
          </div>
        </BentoCard>
      </div>
    </section>
  )
}

function BentoCard({ title, body, children, className }: { title: string; body: string; children: ReactNode; className?: string }) {
  return (
    <article data-reveal className={cn('flex flex-col gap-5 rounded-[28px] bg-card p-3 pb-6', className)}>
      <div className="h-[220px] overflow-hidden rounded-[22px] bg-muted/50">{children}</div>
      <div className="flex flex-col gap-1.5 px-3">
        <h3 className="text-[20px] font-medium leading-tight tracking-tight">{title}</h3>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </article>
  )
}

/** Mapa ilustrado (sin tiles): calles en gris, pines negros y la burbuja de una cafetería. */
function MiniMap() {
  const pins: Array<[number, number]> = [
    [18, 30],
    [34, 62],
    [52, 38],
    [70, 70],
    [82, 28],
    [61, 18],
    [28, 80],
  ]
  return (
    <div className="relative size-full overflow-hidden bg-[#eeece8]">
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <g stroke="#ffffff" strokeLinecap="round" fill="none">
          <path d="M-5 40 C 25 35, 45 55, 105 48" strokeWidth="2.4" />
          <path d="M20 -5 C 25 30, 15 70, 30 105" strokeWidth="1.6" />
          <path d="M60 -5 C 55 30, 70 60, 62 105" strokeWidth="2" />
          <path d="M-5 75 C 30 70, 60 85, 105 78" strokeWidth="1.4" />
          <path d="M-5 15 L 105 22" strokeWidth="1" />
          <path d="M85 -5 L 80 105" strokeWidth="1" />
        </g>
        <path d="M-5 92 C 30 88, 70 98, 105 90 L 105 105 L -5 105 Z" fill="#dfe6e3" />
      </svg>
      {pins.map(([x, y], i) => (
        <span key={i} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${x}%`, top: `${y}%` }}>
          <MapPin className={cn('fill-[#111111] text-[#eeece8]', i === 2 ? 'size-8' : 'size-6')} strokeWidth={1.5} />
        </span>
      ))}
      <span className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#2f7bf6] shadow" style={{ left: '44%', top: '50%' }} />
      <div className="absolute flex -translate-x-1/2 flex-col rounded-xl bg-white px-3 py-2 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.35)]" style={{ left: '52%', top: '6%' }}>
        <span className="text-[10px] font-medium uppercase tracking-eyebrow text-[#9a958f]">Cafetería · 650 m</span>
        <span className="text-[13px] font-medium text-[#111111]">Barrio Italia, Providencia</span>
      </div>
    </div>
  )
}

/* ---------- Galería: el ritual ---------- */

function Gallery() {
  const items = [
    { src: FOTO.espresso, alt: 'Espresso saliendo del portafiltro', k: 'Espresso', v: '18 g · 36 g · 28 s' },
    { src: FOTO.bloom, alt: 'Agua sobre el café molido en un filtro, durante el bloom', k: 'Filtrado', v: 'Bloom de 45 s' },
    { src: FOTO.gota, alt: 'Gota de café cayendo a una jarra de vidrio', k: 'Extracción', v: '2:45 en total' },
    { src: FOTO.granos, alt: 'Granos de café de tueste claro', k: 'En grano', v: 'Tostado hace 12 días' },
  ]
  return (
    <section className="py-4 lg:py-8">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-6">
        <SectionHead eyebrow="Para cada forma de prepararlo" title="Del espresso al filtrado, con la misma precisión." />
      </div>
      <div className="mx-auto flex max-w-6xl snap-x snap-mandatory gap-3 overflow-x-auto px-5 pt-10 pb-2 [scrollbar-width:none] sm:px-8 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-6 [&::-webkit-scrollbar]:hidden">
        {items.map((it, i) => (
          <figure
            key={it.k}
            data-reveal
            style={{ transitionDelay: `${i * 80}ms` }}
            className={cn('relative aspect-[3/4] w-[72%] shrink-0 snap-start overflow-hidden rounded-[28px] sm:w-[44%] lg:w-auto', coffeeGradient)}
          >
            <Cover src={it.src} alt={it.alt} className="transition-transform duration-700 hover:scale-[1.03]" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(17,17,17,0.6))]" />
            <figcaption className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-full border border-white/25 bg-white/15 py-2 pr-2 pl-4 text-white backdrop-blur-md">
              <span className="text-[14px] font-medium">{it.k}</span>
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#111111]">{it.v}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

/* ---------- Tostado Club ---------- */

function TostadoClub({ onCta }: { onCta: OnCta }) {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:px-6 lg:pb-28">
      <div data-reveal className="grid overflow-hidden rounded-[32px] bg-card lg:grid-cols-2">
        <div className={cn('relative aspect-[4/3] lg:aspect-auto lg:min-h-[520px]', coffeeGradient)}>
          <Cover src={FOTO.caja} alt="Caja de Tostado Club: café de especialidad todos los meses" />
        </div>
        <div className="flex flex-col justify-center gap-5 p-7 sm:p-10 lg:p-14">
          <span className="eyebrow">Hecha por Tostado Club</span>
          <h2 className="text-[32px] font-medium leading-[1.05] tracking-tightest text-balance sm:text-[40px]">Del mismo equipo que te manda café todos los meses.</h2>
          <p className="text-[16px] leading-relaxed text-muted-foreground">
            Dripo nace en Tostado Club. Si ya eres cliente, crea tu cuenta con el correo de tus compras y entras directo, sin lista de espera.
          </p>
          <CtaLink cta="signup" placement="tostado" onCta={onCta} className={cn(btn, 'w-fit bg-primary text-primary-foreground hover:bg-primary/90')}>
            Crear cuenta <ArrowRight className="size-4" strokeWidth={2} />
          </CtaLink>
        </div>
      </div>
    </section>
  )
}

/* ---------- Preguntas ---------- */

function Faq() {
  const qa: Array<[string, ReactNode]> = [
    ['¿Cuánto cuesta?', 'Nada. Dripo es gratis durante la beta.'],
    [
      '¿Tengo que descargar algo?',
      'No. Dripo funciona en el navegador de tu teléfono. Para tenerla como app: en Safari toca Compartir y luego "Agregar a inicio"; en Chrome, el menú y luego "Instalar app".',
    ],
    [
      '¿Por qué es por invitación?',
      'Estamos abriendo Dripo por rondas para cuidar la experiencia. Pon tu correo: si hay cupo te llega de inmediato el enlace para crear tu cuenta, y si no, quedas en la lista de espera y te avisamos.',
    ],
    ['¿Funciona con cualquier café?', 'Con cualquier café de especialidad que tenga etiqueta, de Chile o de afuera. Si la foto no alcanza a leer algo, completas la ficha a mano.'],
    ['¿Con qué métodos de preparación?', 'V60, Kalita, Origami, Chemex, AeroPress, prensa francesa, Clever, espresso, moka, cold brew y varios más. Tú eliges el método y Dripo arma la receta.'],
    [
      '¿Qué pasa con mis datos?',
      <>
        Tu diario es privado por defecto: solo se comparte lo que tú decides publicar. Más detalle en la{' '}
        <Link to="/privacidad" className="text-foreground underline underline-offset-4">
          política de privacidad
        </Link>
        .
      </>,
    ],
    ['¿Puedo usarla en el computador?', 'Dripo está hecha para el teléfono, porque se usa con la cámara y junto a la taza. En el computador te mostramos un código QR para seguir desde el celular.'],
  ]
  return (
    <section id="preguntas" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.4fr] lg:gap-16 lg:px-6 lg:py-28">
        <SectionHead eyebrow="Preguntas" title="Lo que todos preguntan antes de partir." />
        <div data-reveal className="flex flex-col">
          {qa.map(([q, a]) => (
            <details key={q} className="group border-t border-border last:border-b">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[17px] font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180" strokeWidth={1.8} />
              </summary>
              <p className="max-w-2xl pb-5 text-[15px] leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- CTA final y pie ---------- */

function FinalCta({ onCta }: { onCta: OnCta }) {
  return (
    <section className="px-3 pb-3 lg:px-6 lg:pb-6">
      <div data-reveal className="relative mx-auto flex max-w-6xl flex-col items-center gap-7 overflow-hidden rounded-[36px] bg-[#111111] px-6 py-20 text-center text-white lg:py-28">
        <Cover src={FOTO.goteo} />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(17,17,17,0.55)_0%,rgba(17,17,17,0.78)_100%)]" aria-hidden />
        <Isotipo className="relative h-12 w-auto" aria-hidden />
        <h2 className="relative max-w-2xl text-[38px] font-medium leading-[1.02] tracking-tightest text-balance sm:text-[52px] lg:text-[64px]">Cada café, mejor que el anterior.</h2>
        <p className="relative max-w-md text-[16px] leading-relaxed text-white/65 lg:text-[18px]">Crea tu cuenta, escanea el café que tienes en casa y pide tu primera receta. Toma un par de minutos.</p>
        <div className="relative flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <CtaLink cta="signup" placement="final" onCta={onCta} className={cn(btn, 'bg-white text-[#111111] hover:bg-white/90')}>
            Crear cuenta <ArrowRight className="size-4" strokeWidth={2} />
          </CtaLink>
          <CtaLink cta="login" placement="final" onCta={onCta} className={cn(btn, 'border border-white/25 text-white hover:bg-white/10')}>
            Iniciar sesión
          </CtaLink>
        </div>
      </div>
    </section>
  )
}

function Footer({ onCta }: { onCta: OnCta }) {
  return (
    <footer className="mx-auto flex max-w-6xl flex-col gap-6 px-5 pt-10 pb-[max(env(safe-area-inset-bottom),32px)] sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-6">
      <div className="flex flex-col gap-2">
        <Logo className="h-7 w-auto self-start" />
        <span className="text-[13px] text-muted-foreground">Tu diario de café de especialidad.</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
        <CtaLink cta="signup" placement="footer" onCta={onCta} className="hover:text-foreground">
          Crear cuenta
        </CtaLink>
        <CtaLink cta="login" placement="footer" onCta={onCta} className="hover:text-foreground">
          Iniciar sesión
        </CtaLink>
        <Link to="/privacidad" className="hover:text-foreground">
          Privacidad
        </Link>
        <span className="text-tertiary">© 2026 Dripo</span>
      </div>
    </footer>
  )
}

/* ---------- Escritorio: QR para seguir en el teléfono ---------- */

function QrDialog({ cta, onClose }: { cta: LandingCta; onClose: () => void }) {
  const url = withQrUtm(HREF[cta], 'landing')
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  const signup = cta === 'signup'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm landing-fade" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-title"
        className="landing-pop relative flex w-full max-w-[440px] flex-col items-center gap-6 rounded-[32px] bg-background p-8 pt-10 text-center shadow-[0_40px_80px_-30px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground">
          <X className="size-4" strokeWidth={1.8} />
        </button>
        <div className="flex flex-col gap-2">
          <h2 id="qr-title" className="text-[28px] font-medium leading-tight tracking-tightest">
            {signup ? 'Crea tu cuenta desde el teléfono' : 'Entra desde tu teléfono'}
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">Dripo se usa con la cámara, junto a la taza. Escanea el código y sigue desde ahí.</p>
        </div>
        <div className="rounded-[24px] bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.04)]">
          <QrCode value={url} size={200} label={signup ? 'Código QR para crear tu cuenta en Dripo' : 'Código QR para entrar a Dripo'} />
        </div>
        <ol className="flex w-full flex-col gap-2.5 rounded-[20px] bg-card p-4 text-left text-[14px]">
          <li className="flex items-center gap-3">
            <Camera className="size-4 shrink-0" strokeWidth={1.7} /> Abre la cámara y apunta al código
          </li>
          <li className="flex items-center gap-3">
            {signup ? <Mail className="size-4 shrink-0" strokeWidth={1.7} /> : <LogIn className="size-4 shrink-0" strokeWidth={1.7} />}
            {signup ? 'Pon tu correo y revisa tu bandeja' : 'Entra con tu correo o con Google'}
          </li>
        </ol>
        {signup && (
          <Link to="/unete" className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Prefiero dejar mi correo desde aquí
          </Link>
        )}
      </div>
    </div>
  )
}
