import { NavLink, Outlet } from 'react-router-dom'
import { BookOpen, Camera, Coffee, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/', label: 'Mis cafés', icon: Coffee },
  { to: '/scan', label: 'Escanear', icon: Camera },
  { to: '/recipes', label: 'Recetas', icon: BookOpen },
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
 * borde de luz y sombra suave; el ítem activo lleva su propia píldora.
 */
export function BottomNav({ activeTo }: { activeTo?: string } = {}) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="glass pointer-events-auto flex w-full max-w-md items-center justify-between gap-1 rounded-full p-1.5">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive: routeActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 rounded-full py-2 text-[10px] font-medium transition-[background-color,color,transform] duration-300 active:scale-95',
                (activeTo ? activeTo === to : routeActive) ? 'bg-foreground text-background shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)]' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <Icon width={22} height={22} strokeWidth={1.7} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
