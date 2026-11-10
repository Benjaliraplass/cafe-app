import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getProfile, type Profile } from '../lib/api'

interface AuthState {
  user: User | null
  session: Session | null
  /** Perfil público del usuario (nombre, avatar, rol). null mientras carga o sin sesión. */
  profile: Profile | null
  isAdmin: boolean
  loading: boolean
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
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null
  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      return
    }
    try {
      setProfile(await getProfile(userId))
    } catch {
      // El perfil es complementario; la app sigue funcionando sin él.
    }
  }, [userId])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        isAdmin: profile?.role === 'admin',
        loading,
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
