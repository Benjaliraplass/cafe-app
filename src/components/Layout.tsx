import { NavLink, Outlet } from 'react-router-dom'
import { Camera, Coffee, Compass, Home, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab {
  to: string
  label: string
  icon: typeof Home
  /** Botón central destacado (Escanear), al estilo Vivino. */
  primary?: boolean
}

const tabs: Tab[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/explore', label: 'Explorar', icon: Compass },
  { to: '/scan', label: 'Escanear', icon: Camera, primary: true },
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
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="glass pointer-events-auto flex w-full max-w-md items-center justify-between gap-0.5 rounded-full p-1.5">
        {tabs.map(({ to, label, icon: Icon, primary }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className={({ isActive: routeActive }) => {
              const active = activeTo ? activeTo === to : routeActive
              if (primary) {
                return cn(
                  'mx-1 flex size-[58px] shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55)] transition-transform active:scale-95',
                  active && 'ring-2 ring-foreground/20 ring-offset-2 ring-offset-background/60',
                )
              }
              return cn(
                'flex flex-1 flex-col items-center gap-1 rounded-full py-2 text-[10px] font-medium transition-[background-color,color,transform] duration-300 active:scale-95',
                active ? 'bg-foreground text-background shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)]' : 'text-muted-foreground hover:text-foreground',
              )
            }}
          >
            {({ isActive }) =>
              primary ? (
                <Icon width={24} height={24} strokeWidth={1.8} />
              ) : (
                <>
                  <Icon width={22} height={22} strokeWidth={activeTo ? (activeTo === to ? 2 : 1.7) : isActive ? 2 : 1.7} />
                  <span>{label}</span>
                </>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
