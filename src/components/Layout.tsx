import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Mis cafés', icon: CupIcon },
  { to: '/scan', label: 'Escanear', icon: CameraIcon, primary: true },
  { to: '/explore', label: 'Explorar', icon: PinIcon },
  { to: '/profile', label: 'Perfil', icon: UserIcon },
]

export function Layout() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-28 safe-top">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur safe-bottom">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-2">
          {tabs.map(({ to, label, icon: Icon, primary }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium ${
                  primary
                    ? 'text-bg'
                    : isActive
                      ? 'text-accent'
                      : 'text-ink-3'
                }`
              }
            >
              {primary ? (
                <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg shadow-black/40">
                  <Icon />
                </span>
              ) : (
                <Icon />
              )}
              <span className={primary ? 'text-ink-3' : ''}>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

function CupIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z" />
      <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8 5c-1-1 1-2 0-3M12 5c-1-1 1-2 0-3" strokeLinecap="round" />
    </svg>
  )
}
function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}
function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  )
}
function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  )
}
