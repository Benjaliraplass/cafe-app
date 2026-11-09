import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Eyebrow, Title } from '@/components/primitives'

export function Profile() {
  const { user, signOut } = useAuth()
  return (
    <div>
      <header className="flex flex-col gap-1.5 px-6 pt-4">
        <Eyebrow>Cuenta</Eyebrow>
        <Title className="text-[38px]">Perfil</Title>
      </header>
      <div className="flex flex-col gap-3 px-6 pt-6">
        <Card className="flex flex-col gap-1 p-4">
          <Eyebrow className="text-[10px]">Correo</Eyebrow>
          <p className="text-[15px]">{user?.email}</p>
        </Card>
        <Card className="flex flex-col gap-1 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Dripo · beta</p>
          <p>Versión inicial. Tus fotos y notas son privadas por defecto. Si algo falla, cuéntanos.</p>
        </Card>
        <Button variant="outline" className="mt-3" onClick={signOut}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
