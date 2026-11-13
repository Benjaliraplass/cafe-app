/** Mensajes de Supabase Auth (en inglés) a español. Si no se reconoce, un mensaje genérico. */
export function translateAuthError(msg: string, fallback = 'No pudimos guardar. Intenta de nuevo.'): string {
  const m = msg.toLowerCase()
  if (m.includes('should be different from the old password')) return 'Esa ya es tu contraseña. Elige una distinta.'
  if (m.includes('weak') || m.includes('pwned') || m.includes('known to be')) return 'Esa contraseña es muy común. Elige otra más difícil de adivinar.'
  if (m.includes('password should be') || m.includes('at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('expired') || m.includes('invalid') || m.includes('not found')) return 'El enlace venció o ya se usó.'
  if (m.includes('session') && m.includes('missing')) return 'El enlace venció o ya se usó.'
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Demasiados intentos. Espera un momento.'
  if (m.includes('fetch') || m.includes('network')) return 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.'
  return fallback
}
