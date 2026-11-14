import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getProfile, type Profile } from '../lib/api'
import { identify, initAnalytics, resetAnalytics, trackAuth } from '../lib/analytics'

interface AuthState {
  user: User | null
  session: Session | null
  /** Perfil público del usuario (nombre, avatar, rol). null mientras carga o sin sesión. */
  profile: Profile | null
  isAdmin: boolean
  loading: boolean
  /** true mientras se carga el perfil tras iniciar sesión (evita mostrar la app antes del walkthrough). */
  profileLoading: boolean
  signOut: () => Promise<void>
  /** Vuelve a leer el perfil (tras cambiar nombre, foto, etc.). */
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  profileLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    initAnalytics()
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session?.user) identify(data.session.user)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      setLoading(false)
      if (s?.user) {
        identify(s.user)
        // SIGNED_IN llega al iniciar sesión (y en algunos navegadores al volver a la pestaña);
        // trackAuth registra signup/login una sola vez por sesión del navegador.
        if (event === 'SIGNED_IN') trackAuth(s.user)
      }
      if (event === 'SIGNED_OUT') resetAnalytics()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null
  // Usuario cuyo perfil ya se cargó: al entrar otro (login), el Gate espera el perfil en vez de mostrar
  // Inicio un instante y saltar a la bienvenida. Los refrescos del mismo usuario no vuelven a "cargando".
  const loadedFor = useRef<string | null>(null)
  // Una llamada a refreshProfile capturada antes de que existiera la sesión (Crear cuenta: verifyOtp y
  // luego refresh) veía userId = null, borraba el perfil y el Gate saltaba la bienvenida. Se lee la
  // sesión actual en vez del cierre.
  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user?.id ?? null
    if (!userId) {
      loadedFor.current = null
      setProfile(null)
      setProfileLoading(false)
      return
    }
    if (loadedFor.current !== userId) setProfileLoading(true)
    try {
      let p = await getProfile(userId)
      if (!p) {
        // Recién registrado: el trigger que crea el perfil puede tardar unos ms.
        await new Promise((r) => setTimeout(r, 800))
        p = await getProfile(userId)
      }
      setProfile(p)
      loadedFor.current = userId
    } catch {
      // El perfil es complementario; la app sigue funcionando sin él.
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshProfile()
  }, [userId, refreshProfile])

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        isAdmin: profile?.role === 'admin',
        loading,
        profileLoading,
        signOut: async () => {
          await supabase.auth.signOut()
        },
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
