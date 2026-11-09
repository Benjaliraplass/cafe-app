// Solo en desarrollo: previsualiza las vistas con datos de ejemplo sin iniciar sesión.
import { useSearchParams } from 'react-router-dom'
import type { CoffeeLog, RecipeData } from '@/lib/types'
import { HomeView } from '@/pages/Home'
import { LogDetailView } from '@/pages/LogDetail'
import { Login } from '@/pages/Login'
import { Scan } from '@/pages/Scan'
import { RecipesView } from '@/pages/Recipes'
import { EditLog } from '@/pages/EditLog'
import { ProfileView } from '@/pages/Profile'
import { BottomNav } from '@/components/Layout'

const roaster = { id: 'r1', name: 'Asunto Coffee Roasters', slug: 'asunto', country: 'Chile', city: 'Santiago', website: null, instagram: null }
const noop = async () => {}
const mk = (id: string, name: string, origin: string, region: string | null, process: string, variety: string, rating: number, date: string, notes: string[] = []): CoffeeLog => ({
  id, user_id: 'u', coffee_id: id, photo_path: null, rating, notes: null, brew_method: 'V60', roast_date: '2026-10-26', bought_at: null, price_clp: null,
  is_public: false, is_favorite: rating === 5, consumed_at: date, created_at: date,
  coffee: { id, roaster_id: 'r1', name, origin_country: origin, region, farm: 'Finca Milán', producer: null, variety, process, altitude_masl: null, roast_level: null, roast_profile: 'filtro', tasting_notes: notes, roaster },
})
const logs: CoffeeLog[] = [
  mk('1', 'Catiope', 'Colombia', 'Pereira', 'Honey', 'Catiope', 5, new Date().toISOString().slice(0, 10), ['Clavo de olor', 'Pimienta blanca', 'Mango', 'Manzana verde', 'Lima', 'Cacao']),
  mk('2', 'La Pastora', 'Perú', 'Cajamarca', 'Lavado', 'Caturra', 4, '2026-11-08'),
  mk('3', 'Guji Natural', 'Etiopía', 'Guji', 'Natural', 'Heirloom', 5, '2026-11-02'),
  mk('4', 'Intenzzo', 'Brasil', null, 'Natural', 'Catuaí', 3, '2026-10-28'),
  mk('5', 'Gesha Lot 4', 'Panamá', 'Boquete', 'Lavado', 'Gesha', 5, '2026-10-20'),
]
const recipe: RecipeData = {
  title: 'Receta V60 para Catiope Honey', brew_method: 'V60',
  params: { dose_g: 15, water_g: 250, ratio: '1:16,6', water_temp_c: 92, grind: 'Media fina', grind_reference: '23 clics', total_time: '3:00', yield_g: null, pressure_bar: null },
  steps: [{ time: '0:00', action: 'Preinfusión con 45 g de agua. Agitar suave.' }, { time: '0:45', action: 'Segundo vertido continuo hasta 130 g.' }, { time: '1:30', action: 'Tercer vertido hasta completar 250 g.' }, { time: '3:00', action: 'Fin del goteo. Servir.' }],
  rationale: 'Honey de altura con notas tropicales y especiadas: 92 °C extrae el mango y la lima sin opacar el cacao. Tres vertidos equilibran cuerpo y dulzor.',
  adjustments: [{ if: 'sabe astringente', then: 'muele 2 clics más grueso' }, { if: 'sabe plano', then: 'muele 1 clic más fino' }, { if: 'drena en más de 3:30', then: 'vierte más suave' }],
  rest_advice: 'Han pasado 14 días desde el tueste: ventana ideal para filtro.',
}

export function Preview() {
  const [sp] = useSearchParams()
  const v = sp.get('v') ?? 'home'
  if (v === 'login') return <Login />
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <main className="flex-1 pb-32">
        {v === 'home' && <HomeView logs={logs} error={null} onToggleFavorite={noop} />}
        {v === 'empty' && <HomeView logs={[]} error={null} />}
        {v === 'scan' && <Scan />}
        {v === 'recipes' && (
          <RecipesView logs={logs} saved={[]} equipment={{ grinder: 'Comandante C40', drippers: ['V60', 'Kalita Wave', 'Aeropress'] }} error={null} onGenerate={async () => { await new Promise((r) => setTimeout(r, 800)); return recipe }} onSave={async () => {}} />
        )}
        {v === 'loading' && <HomeView logs={null} error={null} />}
        {v === 'edit' && <EditLog previewLog={logs[0]} />}
        {v === 'profile' && (
          <ProfileView
            email="benjamin@tostadoclub.com"
            profile={{ id: 'u', display_name: 'Benjamín', avatar_url: null, country: 'Chile', equipment: { grinder: 'Comandante C40', drippers: ['V60', 'Kalita Wave', 'Aeropress'] } }}
            error={null}
            onError={() => {}}
            onProfileChange={() => {}}
            onUploadAvatar={async () => ''}
            onSaveIdentity={noop}
            onSaveEquipment={noop}
            onSignOut={noop}
          />
        )}
        {v === 'detail' && (
          <LogDetailView
            log={{ ...logs[0], notes: 'Efervescente y complejo. Mucho mango en caliente, se vuelve más cítrico al enfriar.' }}
            recipes={[{ id: 'x', coffee_log_id: '1', brew_method: 'V60', title: recipe.title, params: recipe.params, steps: recipe.steps, rationale: recipe.rationale, created_at: '' }]}
            error={null}
            onGenerate={async () => recipe}
            onSaveRecipe={async () => {}}
            onDelete={async () => {}}
            onToggleFavorite={noop}
          />
        )}
      </main>
      <BottomNav activeTo={v === 'profile' ? '/profile' : v === 'scan' ? '/scan' : v === 'recipes' ? '/recipes' : '/'} />
    </div>
  )
}
