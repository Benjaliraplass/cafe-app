import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Share2, UserPlus } from 'lucide-react'
import { track } from '@/lib/analytics'
import { getInviteInfo, getMyInvites, inviteUrl, markInvitesSeen, type MyInvites } from '@/lib/api'
import { shareLink } from '@/lib/share'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Invitaciones (Lote 10). Viven en dos lugares y nada más:
 * - InviteUnlockSheet: hoja inferior, una vez por desbloqueo (3 con el primer café, +2 con la primera receta).
 * - InvitesRow: fila en Perfil con el cupo y el botón Compartir.
 * InviteStrip es la franja "X te invita" en las fichas públicas, solo para quien llega sin sesión.
 */

export async function shareInvite(code: string, where: 'sheet' | 'profile'): Promise<'shared' | 'copied' | 'failed'> {
  const res = await shareLink({
    title: 'Te invito a Dripo',
    text: 'Te invito a Dripo, mi diario de café de especialidad. Escaneas la etiqueta, guardas lo que probaste y pides recetas a medida.',
    url: inviteUrl(code),
  })
  if (res !== 'failed') track('invite_shared', { where, result: res })
  return res
}

/** Consulta el cupo al montar y muestra la hoja si hay invitaciones nuevas sin ver. */
export function InviteUnlockSheet() {
  const [inv, setInv] = useState<MyInvites | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyInvites()
      .then((i) => {
        if (cancelled || i.total <= i.seen) return
        setInv(i)
        setOpen(true)
        track('invite_unlocked', { total: i.total, nuevas: i.total - i.seen })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  function close() {
    setOpen(false)
    markInvitesSeen().catch(() => {})
  }

  if (!open || !inv) return null
  const nuevas = inv.total - inv.seen
  return <InviteUnlockSheetView nuevas={nuevas} total={inv.total} onShare={() => shareInvite(inv.code, 'sheet')} onClose={close} />
}

export function InviteUnlockSheetView({ nuevas, total, onShare, onClose }: { nuevas: number; total: number; onShare: () => Promise<unknown>; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const first = nuevas === total
  return (
    <div className="fixed inset-0 z-[30] flex flex-col justify-end bg-foreground/20 backdrop-blur-[2px]" onClick={onClose} role="dialog" aria-label="Invitaciones desbloqueadas">
      <div className="mx-auto w-full max-w-md px-4 pb-[max(env(safe-area-inset-bottom),16px)]" onClick={(e) => e.stopPropagation()}>
        <div className="glass-solid flex flex-col gap-5 rounded-[28px] p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <UserPlus className="size-6" strokeWidth={1.7} />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[20px] font-medium leading-tight tracking-[-0.02em]">
                Desbloqueaste {nuevas} {nuevas === 1 ? 'invitación' : 'invitaciones'}
              </p>
              <p className="text-sm text-muted-foreground">
                {first
                  ? 'Dripo es por invitación. Comparte tu enlace con quien tome café en serio.'
                  : `Ya tienes ${total} en total. Las ves en tu perfil cuando quieras.`}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={async () => {
                const res = await onShare()
                if (res === 'copied') setCopied(true)
              }}
            >
              <Share2 className="size-4" strokeWidth={1.8} />
              {copied ? 'Enlace copiado' : 'Invitar a un amigo'}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Después
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Fila de Perfil: cupo disponible y Compartir. */
export function InvitesRow({ invites, onShare }: { invites: MyInvites | null; onShare: () => Promise<'shared' | 'copied' | 'failed'> }) {
  const [copied, setCopied] = useState(false)
  if (!invites) return null
  const left = Math.max(0, invites.total - invites.used)
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-[15px] font-medium">Invitaciones</span>
        <span className="text-sm text-muted-foreground">
          {invites.total === 0
            ? 'Se desbloquean con tu primer café'
            : `${left} ${left === 1 ? 'disponible' : 'disponibles'}${invites.used ? ` · ${invites.used} ${invites.used === 1 ? 'amigo dentro' : 'amigos dentro'}` : ''}`}
        </span>
      </div>
      {left > 0 && (
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            const res = await onShare()
            if (res === 'copied') {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }
          }}
        >
          <Share2 className="size-4" strokeWidth={1.8} />
          {copied ? 'Copiado' : 'Compartir'}
        </Button>
      )}
    </div>
  )
}

/** Franja en fichas públicas (/c, /r) cuando el enlace trae un ?ref= con cupo y no hay sesión. */
export function InviteStrip({ refCode, className }: { refCode: string | null; className?: string }) {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    if (!refCode) return
    getInviteInfo(refCode).then((i) => {
      if (i?.has_quota && i.first_name) setName(i.first_name)
    })
  }, [refCode])
  if (!refCode || !name) return null
  return <InviteStripView name={name} refCode={refCode} className={className} />
}

export function InviteStripView({ name, refCode, className }: { name: string; refCode: string; className?: string }) {
  return (
    <Link
      to={`/unete?ref=${refCode}`}
      className={cn('flex items-center justify-between gap-3 rounded-full bg-foreground px-4 py-2.5 text-background', className)}
    >
      <span className="truncate text-[14px]">{name} te invita a Dripo</span>
      <span className="shrink-0 text-[14px] font-medium">Crear cuenta</span>
    </Link>
  )
}
