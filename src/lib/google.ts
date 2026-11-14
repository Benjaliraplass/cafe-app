/**
 * Login con Google vía Google Identity Services (GIS) + supabase.auth.signInWithIdToken.
 * El flujo ocurre entre el navegador (dripocoffee.com) y Google; Supabase solo valida el
 * id_token. Así la pantalla de Google muestra nuestro dominio y no el de Supabase.
 * Si no hay VITE_GOOGLE_CLIENT_ID, Login cae al flujo OAuth clásico de Supabase.
 */

export const GOOGLE_CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined

type CredentialResponse = { credential: string }

type GoogleId = {
  initialize: (config: {
    client_id: string
    callback: (r: CredentialResponse) => void
    nonce?: string
    use_fedcm_for_prompt?: boolean
    itp_support?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (
    el: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      logo_alignment?: 'left' | 'center'
      width?: number
      locale?: string
    },
  ) => void
  prompt: () => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } }
  }
}

let loading: Promise<GoogleId> | null = null

/** Carga el script de GIS una sola vez y devuelve google.accounts.id. */
export function loadGoogleIdentity(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => {
      const id = window.google?.accounts?.id
      if (id) resolve(id)
      else reject(new Error('Google Identity no disponible'))
    }
    s.onerror = () => {
      loading = null
      reject(new Error('No se pudo cargar Google Identity'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/** Nonce aleatorio (se envía a Supabase) y su hash SHA-256 en hex (se envía a Google). */
export async function createNonce(): Promise<{ nonce: string; hashedNonce: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))
  const hashedNonce = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return { nonce, hashedNonce }
}

/** Correo (en minúsculas) del id_token de Google. Solo para decidir en el cliente; Supabase valida el token. */
export function emailFromIdToken(token: string): string | null {
  try {
    const part = token.split('.')[1]
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))
    const email = (JSON.parse(json) as { email?: unknown }).email
    return typeof email === 'string' ? email.toLowerCase() : null
  } catch {
    return null
  }
}
