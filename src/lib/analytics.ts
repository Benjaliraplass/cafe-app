/**
 * Analítica de producto (SPEC §8). Cada evento se envía a PostHog (exploración) y a la
 * tabla `events` de Supabase vía RPC `track_event` (fuente de verdad). Todo falla en
 * silencio: la analítica nunca rompe la app. Sin PII en props.
 */
import type { PostHog } from 'posthog-js'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

declare const __APP_VERSION__: string

export type EventName =
  | 'app_opened'
  | 'signup_completed'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'login_completed'
  | 'pwa_installed'
  | 'scan_started'
  | 'scan_completed'
  | 'scan_failed'
  | 'log_saved'
  | 'log_edited'
  | 'log_deleted'
  | 'recipe_requested'
  | 'recipe_generated'
  | 'recipe_saved'
  | 'recipe_failed'
  | 'recipe_feedback_given'
  | 'featured_recipe_viewed'
  | 'public_coffee_viewed'
  | 'catalog_viewed'
  | 'cafe_viewed'
  | 'cafe_maps_clicked'
  | 'cafe_proposed'
  | 'share_clicked'
  | 'share_link_opened'
  | 'log_made_public'
  | 'taste_profile_saved'
  | 'profile_updated'
  | 'feedback_clicked'
  | 'join_submitted'
  | 'explore_located'
  | 'invite_unlocked'
  | 'invite_shared'
  | 'invite_accepted'
  | 'desktop_gate_viewed'
  | 'desktop_gate_continued'

export type EventProps = Record<string, string | number | boolean | null | undefined>

type Attribution = { utm: Record<string, string> | null; ref: string | null; first_path: string }

const KEY_AID = 'dripo.aid'
const KEY_SID = 'dripo.sid'
const KEY_ATTR = 'dripo.attribution'
const KEY_AUTH_TRACKED = 'dripo.auth_tracked'

const POSTHOG_KEY: string | undefined = import.meta.env.VITE_POSTHOG_KEY || undefined
const POSTHOG_HOST: string = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let initialized = false
/** Instancia de PostHog una vez cargada (import dinámico para no engordar el bundle principal). */
let ph: PostHog | null = null
/** Eventos capturados antes de que PostHog termine de cargar. */
let phQueue: Array<[string, Record<string, unknown>]> = []

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().replace(/-/g, '').slice(0, 24)
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Id anónimo persistente (une la visita anónima con el registro posterior). */
export function anonymousId(): string {
  const ls = safeStorage('local')
  let id = ls?.getItem(KEY_AID) ?? null
  if (!id) {
    id = randomId()
    ls?.setItem(KEY_AID, id)
  }
  return id
}

function sessionId(): string {
  const ss = safeStorage('session')
  let id = ss?.getItem(KEY_SID) ?? null
  if (!id) {
    id = randomId()
    ss?.setItem(KEY_SID, id)
  }
  return id
}

/** UTM y ref del primer toque. Se capturan una vez y persisten hasta que haya registro. */
function captureAttribution(): Attribution {
  const ls = safeStorage('local')
  const stored = ls?.getItem(KEY_ATTR)
  const params = new URLSearchParams(window.location.search)
  const utm: Record<string, string> = {}
  for (const k of ['source', 'medium', 'campaign', 'content', 'term']) {
    const v = params.get(`utm_${k}`)
    if (v) utm[k] = v.slice(0, 80)
  }
  const ref = params.get('ref')?.slice(0, 16) ?? null
  if (stored) {
    try {
      const prev = JSON.parse(stored) as Attribution
      // Un ref nuevo (otro enlace compartido) reemplaza al anterior; el UTM del primer toque se conserva.
      if (ref && ref !== prev.ref) {
        const next = { ...prev, ref }
        ls?.setItem(KEY_ATTR, JSON.stringify(next))
        return next
      }
      return prev
    } catch {
      // cae a crear uno nuevo
    }
  }
  const attr: Attribution = {
    utm: Object.keys(utm).length ? utm : null,
    ref,
    first_path: window.location.pathname.slice(0, 200),
  }
  ls?.setItem(KEY_ATTR, JSON.stringify(attr))
  return attr
}

function attribution(): Attribution {
  const ls = safeStorage('local')
  try {
    const s = ls?.getItem(KEY_ATTR)
    if (s) return JSON.parse(s) as Attribution
  } catch {
    // sin atribución
  }
  return { utm: null, ref: null, first_path: '/' }
}

export function displayMode(): 'standalone' | 'browser' {
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone || window.matchMedia?.('(display-mode: standalone)').matches) return 'standalone'
  return 'browser'
}

export function deviceKind(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

function appVersion(): string {
  try {
    return __APP_VERSION__
  } catch {
    return 'dev'
  }
}

/** Inicializa PostHog (si hay clave), captura UTM/ref y registra app_opened. Idempotente. */
export function initAnalytics(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  const attr = captureAttribution()
  if (POSTHOG_KEY) {
    void import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: true,
          persistence: 'localStorage+cookie',
          person_profiles: 'identified_only',
          bootstrap: { distinctID: anonymousId() },
        })
        posthog.register({
          display_mode: displayMode(),
          device: deviceKind(),
          app_version: appVersion(),
          ...(attr.utm ? Object.fromEntries(Object.entries(attr.utm).map(([k, v]) => [`utm_${k}`, v])) : {}),
          ...(attr.ref ? { ref: attr.ref } : {}),
        })
        ph = posthog
        if (pendingIdentify) identify(pendingIdentify)
        for (const [name, props] of phQueue) posthog.capture(name, props)
        phQueue = []
      })
      .catch(() => {
        phQueue = []
      })
  }
  track('app_opened', { first_path: attr.first_path })
  window.addEventListener('appinstalled', () => track('pwa_installed'))
}

let pendingIdentify: User | null = null

/** Asocia los eventos siguientes al usuario. Llamar al tener sesión. */
export function identify(user: User): void {
  if (!ph) {
    pendingIdentify = user
    return
  }
  try {
    ph.identify(user.id, {
      provider: user.app_metadata?.provider ?? 'email',
      created_at: user.created_at,
    })
  } catch {
    // ignorar
  }
}

/** Registra signup_completed o login_completed una vez por sesión del navegador. */
export function trackAuth(user: User): void {
  const ss = safeStorage('session')
  if (ss?.getItem(KEY_AUTH_TRACKED) === user.id) return
  ss?.setItem(KEY_AUTH_TRACKED, user.id)
  const created = Date.parse(user.created_at)
  const isNew = Number.isFinite(created) && Date.now() - created < 2 * 60 * 1000
  track(isNew ? 'signup_completed' : 'login_completed', { provider: user.app_metadata?.provider ?? 'email' })
}

export function resetAnalytics(): void {
  safeStorage('session')?.removeItem(KEY_AUTH_TRACKED)
  pendingIdentify = null
  if (!ph) return
  try {
    ph.reset()
  } catch {
    // ignorar
  }
}

/** Envía un evento a PostHog y a Supabase. No lanza nunca. */
export function track(name: EventName, props: EventProps = {}): void {
  if (typeof window === 'undefined') return
  const clean: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(props)) if (v !== undefined && v !== null) clean[k] = v
  const attr = attribution()
  if (ph) {
    try {
      ph.capture(name, clean)
    } catch {
      // ignorar
    }
  } else if (POSTHOG_KEY && phQueue.length < 50) {
    phQueue.push([name, clean])
  }
  try {
    void supabase
      .rpc('track_event', {
        p_name: name,
        p_props: clean,
        p_anonymous_id: anonymousId(),
        p_session_id: sessionId(),
        p_path: window.location.pathname.slice(0, 200),
        p_display_mode: displayMode(),
        p_device: deviceKind(),
        p_app_version: appVersion(),
        p_utm: attr.utm,
        p_ref: attr.ref,
      })
      .then(() => undefined, () => undefined)
  } catch {
    // ignorar
  }
}

/**
 * Vista de una ficha pública. Si la URL trae ?ref= (enlace compartido), registra además
 * share_link_opened, una sola vez por carga de página.
 */
let publicViewTracked: string | null = null
export function trackPublicView(name: EventName, type: 'coffee' | 'recipe', props: EventProps, loggedIn: boolean): void {
  const key = `${name}:${JSON.stringify(props)}`
  if (publicViewTracked === key) return
  publicViewTracked = key
  track(name, { ...props, logged_in: loggedIn })
  const ref = new URLSearchParams(window.location.search).get('ref')
  if (ref) track('share_link_opened', { type, logged_in: loggedIn, ...props })
}

/** Sufijo ?ref= para enlaces compartidos: el código de invitación del perfil (profiles.invite_code). */
export function refParam(inviteCode: string | null | undefined): string {
  return inviteCode ? `?ref=${inviteCode}` : ''
}
