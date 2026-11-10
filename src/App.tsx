import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { Layout } from '@/components/Layout'
import { Login } from '@/pages/Login'
import { Inicio } from '@/pages/Inicio'
import { Home } from '@/pages/Home'
import { Scan } from '@/pages/Scan'
import { LogDetail } from '@/pages/LogDetail'
import { EditLog } from '@/pages/EditLog'
import { Explore } from '@/pages/Explore'
import { Recipes } from '@/pages/Recipes'
import { Profile } from '@/pages/Profile'
import { Admin } from '@/pages/Admin'
import { FeaturedList, FeaturedRecipePage } from '@/pages/FeaturedRecipe'
import { Catalog, PublicCoffeePage } from '@/pages/PublicCoffee'
import { Spinner } from '@/components/primitives'
import { Preview } from '@/pages/Preview'
import { Button } from '@/components/ui/button'

function Loading() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <Spinner />
    </div>
  )
}

/** Rutas privadas: exigen sesión y van dentro del Layout con barra inferior. */
function Gate() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Login />
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
        <Route path="explore" element={<Explore />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

/**
 * Rutas públicas (fichas compartibles). Con sesión se muestran dentro del Layout normal;
 * sin sesión, con una barra mínima que invita a abrir Dripo.
 */
function PublicShell() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (user) return <Layout />
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <main className="flex-1 pb-28">
        <Outlet />
      </main>
      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="glass-solid flex w-full max-w-md items-center justify-between gap-3 rounded-[24px] p-2 pl-5">
          <div className="flex flex-col">
            <span className="text-[15px] font-medium leading-tight">Dripo</span>
            <span className="text-xs text-muted-foreground">Tu diario de café de especialidad</span>
          </div>
          <Button asChild size="sm">
            <Link to="/">Abrir Dripo</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function Root() {
  // Vista previa con datos de ejemplo, solo en desarrollo (npm run dev): /preview?v=...
  if (import.meta.env.DEV && window.location.pathname.startsWith('/preview')) return <Preview />
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route path="r/:slug" element={<FeaturedRecipePage />} />
        <Route path="c/:id" element={<PublicCoffeePage />} />
      </Route>
      <Route path="/*" element={<Gate />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </AuthProvider>
  )
}
