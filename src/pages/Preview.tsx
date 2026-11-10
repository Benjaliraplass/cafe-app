// Solo en desarrollo: previsualiza las vistas con datos de ejemplo sin iniciar sesión.
import { useSearchParams } from 'react-router-dom'
import type { Cafe, CoffeeLog, FeaturedRecipe, RecipeData } from '@/lib/types'
import { ExploreView } from '@/pages/Explore'
import { inferTaste } from '@/lib/taste'
import { HomeView } from '@/pages/Home'
import { LogDetailView } from '@/pages/LogDetail'
import { Login } from '@/pages/Login'
import { Scan } from '@/pages/Scan'
import { RecipesView } from '@/pages/Recipes'
import { EditLog } from '@/pages/EditLog'
import { ProfileView } from '@/pages/Profile'
import { InicioView } from '@/pages/Inicio'
import { FeaturedRecipeView } from '@/pages/FeaturedRecipe'
import { PublicCoffeeView } from '@/pages/PublicCoffee'
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

const featured: FeaturedRecipe[] = [
  { id: 'f1', slug: 'v60-kasuya-4-6', title: 'Método 4:6 de Tetsu Kasuya', author: 'Tetsu Kasuya', author_role: 'campeon', country: 'Japón', event: 'WBrC 2016', method_family: 'conico', dripper: 'V60',
    params: { dose_g: 20, water_g: 300, ratio: '1:15', water_temp_c: 92, grind: 'Gruesa', total_time: '3:30', grind_reference: 'Parecida a sal gruesa' },
    steps: [{ time: '0:00', action: 'Primer vertido: 60 g de agua.' }, { time: '0:45', action: 'Segundo vertido: 60 g.' }, { time: '1:30', action: 'Tercer vertido: 60 g.' }, { time: '2:15', action: 'Cuarto vertido: 60 g.' }, { time: '3:00', action: 'Quinto vertido: 60 g.' }],
    story: 'El agua se divide en dos bloques: el primer 40 % controla el sabor y el 60 % restante la fuerza.', source_url: 'https://en.philocoffea.com/blogs/blog/coffee-brewing-method', photo_path: null, is_published: true, sort_order: 20, created_at: '' },
  { id: 'f2', slug: 'v60-hoffmann-ultimate', title: 'V60 para dos: la técnica de James Hoffmann', author: 'James Hoffmann', author_role: 'campeon', country: 'Reino Unido', event: 'WBC 2007', method_family: 'conico', dripper: 'V60',
    params: { dose_g: 30, water_g: 500, ratio: '1:16,7', water_temp_c: 96, grind: 'Media fina', total_time: '3:30' }, steps: [], story: null, source_url: null, photo_path: null, is_published: true, sort_order: 10, created_at: '' },
  { id: 'f3', slug: 'espresso-base-dripo', title: 'Espresso de especialidad, punto de partida', author: 'Dripo', author_role: 'otro', country: 'Chile', event: null, method_family: 'espresso', dripper: 'Espresso',
    params: { dose_g: 18, yield_g: 38, ratio: '1:2,1', water_temp_c: 93, grind: 'Fina', pressure_bar: 9, total_time: '0:28' }, steps: [], story: null, source_url: null, photo_path: null, is_published: true, sort_order: 70, created_at: '' },
]
const cafes: Cafe[] = [
  { id: 'c1', name: 'Café Altura', slug: 'cafe-altura', kind: 'cafe', address: 'Guardia Vieja 202', comuna: 'Providencia', city: 'Santiago', region: 'RM', instagram: 'cafealtura', website: null, description: null, lat: -33.4255, lng: -70.6115, status: 'approved', photo_path: null },
  { id: 'c2', name: 'Asunto Coffee Roasters', slug: 'asunto', kind: 'both', address: 'Av. Italia 1234', comuna: 'Ñuñoa', city: 'Santiago', region: 'RM', instagram: 'asuntocoffee', website: null, description: null, lat: -33.4466, lng: -70.6223, status: 'approved', photo_path: null },
  { id: 'c3', name: 'Tostaduría Barrio', slug: 'barrio', kind: 'roastery', address: 'Santa Isabel 55', comuna: 'Santiago Centro', city: 'Santiago', region: 'RM', instagram: null, website: null, description: null, lat: -33.4525, lng: -70.6398, status: 'approved', photo_path: null },
]
const publishedCoffees = logs.map((l) => ({ ...l.coffee!, is_published: true, published_at: l.created_at }))

export function Preview() {
  const [sp] = useSearchParams()
  const v = sp.get('v') ?? 'home'
  if (v === 'login') return <Login />
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <main className="flex-1 pb-32">
        {v === 'home' && <HomeView logs={logs} error={null} onToggleFavorite={noop} />}
        {v === 'inicio' && (
          <InicioView email="benjamin@tostadoclub.com" profile={{ id: 'u', display_name: 'Benjamín Lira', avatar_url: null, country: 'Chile', role: 'admin', equipment: {} }} featured={featured} recommended={publishedCoffees} logs={logs} cafes={cafes} me={{ lat: -33.4372, lng: -70.6506 }} error={null} />
        )}
        {v === 'featured' && <FeaturedRecipeView r={featured[0]} />}
        {v === 'explore' && <ExploreView cafes={cafes} mine={[{ ...cafes[0], id: 'p1', name: 'Mi propuesta', status: 'pending' }]} error={null} me={{ lat: -33.4372, lng: -70.6506 }} onLocate={noop} />}
        {v === 'coffee' && (
          <PublicCoffeeView
            coffee={publishedCoffees[0]}
            stats={{ coffee_id: '1', avg_rating: 4.6, ratings_count: 7 }}
            logs={[
              { id: 'p1', rating: 5, notes: 'Mucho mango en caliente, cítrico al enfriar.', brew_method: 'V60', consumed_at: '2026-11-08', profile: { display_name: 'Benjamín', avatar_url: null } },
              { id: 'p2', rating: 4, notes: null, brew_method: 'Aeropress', consumed_at: '2026-11-07', profile: { display_name: 'Camila', avatar_url: null } },
            ]}
          />
        )}
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
            profile={{ id: 'u', display_name: 'Benjamín', avatar_url: null, country: 'Chile', role: 'admin', equipment: { grinder: 'Comandante C40', drippers: ['V60', 'Kalita Wave', 'Aeropress'] } }}
            error={null}
            onError={() => {}}
            onProfileChange={() => {}}
            onUploadAvatar={async () => ''}
            onSaveIdentity={noop}
            onSaveEquipment={noop}
            taste={{ process: 'natural', flavors: ['frutal', 'dulce'], acidity: 'alta', body: 'medio', roast: 'claro', drink: 'filtro' }}
            inferred={inferTaste(logs)}
            onSaveTaste={noop}
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
      <BottomNav activeTo={v === 'profile' ? '/profile' : v === 'scan' ? '/scan' : v === 'explore' ? '/explore' : v === 'inicio' || v === 'featured' || v === 'coffee' ? '/' : '/logs'} />
    </div>
  )
}
