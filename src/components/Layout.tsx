import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, Camera, Coffee, Compass, Home, Plus, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab {
  to: string
  label: string
  icon: typeof Home
  /** Botón central destacado: abre la hoja de acciones (Escanear / Pedir receta). */
  primary?: boolean
}

const tabs: Tab[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/explore', label: 'Explorar', icon: Compass },
  { to: '#acciones', label: 'Crear', icon: Plus, primary: true },
  { to: '/logs', label: 'Mis cafés', icon: Coffee },
  { to: '/profile', label: 'Perfil', icon: User },
]

export function Layout() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <main className="flex-1 pb-32 safe-top">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

/**
 * Barra inferior flotante "liquid glass": píldora translúcida con blur y saturación,
 * borde de luz y sombra suave. El ítem activo lleva su propia píldora; Escanear es el
 * botón central destacado.
 */
export function BottomNav({ activeTo }: { activeTo?: string } = {}) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  // Cerrar la hoja al navegar
  useEffect(() => setOpen(false), [location.pathname])
  const onActionRoute = ['/scan', '/recipes'].some((r) => location.pathname.startsWith(r))

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[25] flex flex-col justify-end bg-foreground/20 backdrop-blur-[2px]" onClick={() => setOpen(false)} role="dialog" aria-label="Qué quieres hacer">
          <div className="mx-auto w-full max-w-md px-4 pb-[calc(max(env(safe-area-inset-bottom),12px)+84px)]" onClick={(e) => e.stopPropagation()}>
            <div className="glass-solid flex flex-col gap-2 rounded-[28px] p-2">
              <ActionRow to="/scan" accent icon={<Camera className="size-6" strokeWidth={1.7} />} title="Escanear etiqueta" body="Foto al paquete y guardamos el café en tu diario." />
              <ActionRow to="/recipes" icon={<BookOpen className="size-6" strokeWidth={1.7} />} title="Pedir una receta" body="A medida para tu café, tu método y tu equipo." />
            </div>
          </div>
        </div>
      )}
    <nav data-bottom-nav className="pointer-events-none fixed inset-x-0 bottom-0 z-[26] flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="glass pointer-events-auto flex w-full max-w-md items-center justify-between gap-0.5 rounded-full p-1.5">
        {tabs.map(({ to, label, icon: Icon, primary }) =>
          primary ? (
            <button
              key={to}
              type="button"
              aria-label={open ? 'Cerrar' : 'Crear: escanear o pedir receta'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={cn(
                'mx-1 flex size-[58px] shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[0_4px_10px_-4px_rgba(200,16,46,0.5)] transition-transform active:scale-95',
                (open || onActionRoute || activeTo === '/scan' || activeTo === '/recipes') && 'ring-2 ring-brand/25 ring-offset-2 ring-offset-background/60',
              )}
            >
              <Icon width={26} height={26} strokeWidth={1.9} className={cn('transition-transform duration-200', open && 'rotate-45')} />
            </button>
          ) : (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className={({ isActive: routeActive }) => {
              const active = activeTo ? activeTo === to : routeActive
              return cn(
                'flex flex-1 flex-col items-center gap-1 rounded-full py-2 text-[10px] font-medium transition-[background-color,color,transform] duration-300 active:scale-95',
                active ? 'bg-foreground text-background shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)]' : 'text-muted-foreground hover:text-foreground',
              )
            }}
          >
            {({ isActive }) => (
              <>
                <Icon width={22} height={22} strokeWidth={activeTo ? (activeTo === to ? 2 : 1.7) : isActive ? 2 : 1.7} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
          ),
        )}
      </div>
    </nav>
    </>
  )
}

function ActionRow({ to, icon, title, body, accent }: { to: string; icon: React.ReactNode; title: string; body: string; accent?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-4 rounded-[22px] px-4 py-4 transition-colors active:bg-muted">
      <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-full', accent ? 'bg-brand text-brand-foreground' : 'bg-foreground text-background')}>{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[16px] font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{body}</span>
      </span>
    </Link>
  )
}
