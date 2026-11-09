import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Scan } from './pages/Scan'
import { LogDetail } from './pages/LogDetail'
import { Explore } from './pages/Explore'
import { Profile } from './pages/Profile'
import { Spinner } from './components/ui'

function Gate() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!user) return <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="scan" element={<Scan />} />
        <Route path="log/:id" element={<LogDetail />} />
        <Route path="explore" element={<Explore />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  )
}
