import { Suspense, lazy } from 'react'
import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { Layout } from '@/components/Layout'
import { Login } from '@/pages/Login'
import { Inicio } from '@/pages/Inicio'
import { Home } from '@/pages/Home'
import { Scan } from '@/pages/Scan'
import { LogDetail } from '@/pages/LogDetail'
import { EditLog } from '@/pages/EditLog'
// Explorar carga Leaflet: se separa del bundle principal.
const Explore = lazy(() => import('@/pages/Explore').then((m) => ({ default: m.Explore })))
const NewCafe = lazy(() => import('@/pages/NewCafe').then((m) => ({ default: m.NewCafe })))
// Vista previa solo en desarrollo; fuera del bundle de producción.
const Preview = lazy(() => import('@/pages/Preview').then((m) => ({ default: m.Preview })))
const Admin = lazy(() => import('@/pages/Admin').then((m) => ({ default: m.Admin })))
// Pantalla de escritorio con QR; aparte para no sumar `uqr` al bundle del teléfono.
const DesktopGate = lazy(() => import('@/pages/DesktopGate').then((m) => ({ default: m.DesktopGate })))
import { Recipes } from '@/pages/Recipes'
import { Profile } from '@/pages/Profile'
import { FeaturedList, FeaturedRecipePage } from '@/pages/FeaturedRecipe'
import { Catalog, PublicCoffeePage } from '@/pages/PublicCoffee'
import { Privacy } from '@/pages/Privacy'
import { Onboarding } from '@/pages/Onboarding'
import { NewPassword } from '@/pages/NewPassword'
import { Join } from '@/pages/Join'
import { getInviteInfo } from '@/lib/api'
import { Spinner } from '@/components/primitives'
import { Button } from '@/components/ui/button'
import { UpdateBanner } from '@/components/UpdateBanner'
import { useIsDesktop } from '@/hooks/useIsDesktop'

/** Rutas que funcionan igual en escritorio: fichas compartidas, legales, cuenta y el panel de admin. */
const DESKTOP_OK = [/^\/r\//, /^\/c\//, /^\/privacidad/, /^\/nueva-contrasena/, /^\/unete/, /^\/admin/]
const KEY_DESKTOP = 'dripo.desktop_ok'

function readDesktopOk(): boolean {
  try {
    return localStorage.getItem(KEY_DESKTOP) === '1'
  } catch {
    return false
  }
}

function Loading() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <Spinner />
    </div>
  )
}

/** Rutas privadas: exigen sesión y van dentro del Layout con barra inferior. */
function Gate() {
  const { user, profile, loading, profileLoading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Login />
  if (profileLoading) return <Loading />
  // Primera vez en la cuenta: walkthrough de 3 pantallas antes de la app (profiles.onboarded_at).
  if (profile && !profile.onboarded_at) return <Onboarding />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="logs" element={<Home />} />
        <Route path="scan" element={<Scan />} />
        <Route path="log/:id" element={<LogDetail />} />
        <Route path="log/:id/edit" element={<EditLog />} />
        <Route path="recipes" element={<Recipes />} />
        <Route path="featured" element={<FeaturedList />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="explore" element={<Suspense fallback={<Loading />}><Explore /></Suspense>} />
        <Route path="explore/new" element={<Suspense fallback={<Loading />}><NewCafe /></Suspense>} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={<Suspense fallback={<Loading />}><Admin /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

/**
 * Rutas públicas (fichas compartibles y política de privacidad). Con sesión se muestran dentro del Layout normal;
 * sin sesión, con una barra mínima que invita a abrir Dripo.
 */
function PublicShell() {
  const { user, loading } = useAuth()
  const location = useLocation()
  // Enlace compartido con ?ref= de un usuario con cupo: la barra inferior pasa a ser la invitación.
  const ref = new URLSearchParams(location.search).get('ref')?.slice(0, 10) || null
  const [inviter, setInviter] = useState<string | null>(null)
  useEffect(() => {
    if (!ref || user) return
    getInviteInfo(ref).then((i) => {
      if (i?.has_quota && i.first_name) setInviter(i.first_name)
    })
  }, [ref, user])
  if (loading) return <Loading />
  if (user) return <Layout />
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <main className="flex-1 pb-28">
        <Outlet />
      </main>
      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="glass-solid flex w-full max-w-md items-center justify-between gap-3 rounded-[24px] p-2 pl-5">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-medium leading-tight">{inviter ? `${inviter} te invita a Dripo` : 'Dripo'}</span>
            <span className="text-xs text-muted-foreground">Tu diario de café de especialidad</span>
          </div>
          <Button asChild size="sm" className="shrink-0">
            {inviter ? <Link to={`/unete?ref=${ref}`}>Crear cuenta</Link> : <Link to="/">Abrir Dripo</Link>}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** /unete: con sesión no tiene sentido; se va al inicio. */
function JoinRoute() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (user) return <Navigate to="/" replace />
  return <Join />
}

function Root() {
  const desktop = useIsDesktop()
  const location = useLocation()
  const [desktopOk, setDesktopOk] = useState(readDesktopOk)
  // Vista previa con datos de ejemplo, solo en desarrollo (npm run dev): /preview?v=...
  if (import.meta.env.DEV && window.location.pathname.startsWith('/preview')) {
    return (
      <Suspense fallback={<Loading />}>
        <Preview />
      </Suspense>
    )
  }
  // En escritorio la app se reemplaza por una invitación a abrirla en el teléfono (QR), salvo en las rutas
  // que tienen sentido en un computador o si la persona eligió "Continuar en este navegador".
  if (desktop && !desktopOk && !DESKTOP_OK.some((r) => r.test(location.pathname))) {
    return (
      <Suspense fallback={<Loading />}>
        <DesktopGate
          onContinue={() => {
            try {
              localStorage.setItem(KEY_DESKTOP, '1')
            } catch {
              // sin almacenamiento: vale solo para esta visita
            }
            setDesktopOk(true)
          }}
        />
      </Suspense>
    )
  }
  return (
    <Routes>
      {/* Destino del enlace de recuperación de contraseña: fuera del Gate y del Layout, con o sin sesión. */}
      <Route path="nueva-contrasena" element={<NewPassword />} />
      {/* Entrada a la beta por invitación (correo -> cuenta o lista de espera). */}
      <Route path="unete" element={<JoinRoute />} />
      <Route element={<PublicShell />}>
        <Route path="r/:slug" element={<FeaturedRecipePage />} />
        <Route path="c/:id" element={<PublicCoffeePage />} />
        <Route path="privacidad" element={<Privacy />} />
      </Route>
      <Route path="/*" element={<Gate />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <UpdateBanner />
        <Root />
      </BrowserRouter>
    </AuthProvider>
  )
}
