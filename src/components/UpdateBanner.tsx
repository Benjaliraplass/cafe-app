import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

/**
 * Aviso de versión nueva de la PWA. El service worker queda en espera hasta que el usuario
 * toca "Actualizar"; así ningún deploy cambia la app a mitad de un flujo.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Revisa si hay versión nueva cada hora mientras la app está abierta.
    onRegisteredSW(_url, r) {
      if (r) setInterval(() => r.update(), 60 * 60 * 1000)
    },
  })
  if (!needRefresh) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 safe-top">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-foreground px-4 py-3 text-background shadow-lg">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] font-medium">Hay una versión nueva de Dripo</span>
          <span className="text-xs text-background/70">Tarda un segundo y no pierdes nada.</span>
        </span>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-background px-3.5 text-[13px] font-medium text-foreground"
        >
          <RefreshCw className="size-3.5" strokeWidth={2} /> Actualizar
        </button>
        <button type="button" onClick={() => setNeedRefresh(false)} className="text-xs text-background/70" aria-label="Más tarde">
          Luego
        </button>
      </div>
    </div>
  )
}
