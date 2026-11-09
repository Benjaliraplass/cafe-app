import { useAuth } from '../hooks/useAuth'
import { Button, Card } from '../components/ui'

export function Profile() {
  const { user, signOut } = useAuth()
  return (
    <div className="pt-6">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Cuenta</p>
        <h1 className="font-display text-3xl text-ink">Perfil</h1>
      </header>
      <Card className="mb-4">
        <p className="text-xs uppercase tracking-wide text-ink-3">Correo</p>
        <p className="text-ink">{user?.email}</p>
      </Card>
      <Card className="mb-6 text-sm text-ink-2">
        <p className="mb-1 font-semibold text-ink">Origen · beta</p>
        <p>Versión inicial. Las fotos y notas son privadas por defecto. Si algo falla, cuéntanos.</p>
      </Card>
      <Button variant="ghost" className="w-full" onClick={signOut}>
        Cerrar sesión
      </Button>
    </div>
  )
}
