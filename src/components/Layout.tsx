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
      <main className="flex-1 pb-28 safe-top">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

/** Barra inferior transparente con blur, 4 ítems iguales (Figma V3). */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/90 bg-background/72 backdrop-blur-xl safe-bottom">
      <div className="mx-auto flex max-w-md items-start justify-between px-3 pt-3 pb-2">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex w-[86px] flex-col items-center gap-1.5 rounded-xl py-1 text-[11px] font-medium transition-colors',
                isActive ? 'text-foreground' : 'text-tertiary',
              )
            }
          >
            <Icon width={24} height={24} strokeWidth={1.6} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
