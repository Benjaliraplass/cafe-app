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
import { AdminMetricsView, type MetricsData } from '@/components/AdminMetrics'
import type { UserFacts } from '@/lib/types'
import { Eyebrow, Title } from '@/components/primitives'

const roaster = { id: 'r1', name: 'Asunto Coffee Roasters', slug: 'asunto', country: 'Chile', city: 'Santiago', website: null, instagram: null }
const noop = async () => {}
const mk = (id: string, name: string, origin: string, region: string | null, process: string, variety: string, rating: number, date: string, notes: string[] = []): CoffeeLog => ({
  id, user_id: 'u', coffee_id: id, photo_path: null, rating, notes: null, brew_method: 'V60', roast_date: '2026-10-26', bought_at: null, price_clp: null,
  is_public: false, is_favorite: rating === 5, consumed_at: date, created_at: date,
  coffee: { id, roaster_id: 'r1', name, origin_country: origin, region, farm: 'Finca Milán', producer: null, variety, process, altitude_masl: null, sca_score: rating === 5 ? 87.5 : null, roast_level: null, roast_profile: 'filtro', tasting_notes: notes, roaster },
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
          <InicioView email="benjamin@tostadoclub.com" profile={{ id: 'u', display_name: 'Benjamín Lira', avatar_url: null, country: 'Chile', role: 'admin', equipment: {} }} featured={featured} recommended={publishedCoffees} logs={logs} recipes={[{ id: 'r1', coffee_log_id: logs[0].id, brew_method: 'V60', title: recipe.title, params: recipe.params, steps: recipe.steps, rationale: recipe.rationale, created_at: new Date(Date.now() - 2 * 86400000).toISOString(), coffee: { id: 'c', name: logs[0].coffee?.name ?? 'Catiope', roaster: null } }, { id: 'r2', coffee_log_id: null, brew_method: 'Aeropress', title: 'Aeropress para Etiopía natural, 15 g', params: { ...recipe.params, dose_g: 15, ratio: '1:15', total_time: '2:30' }, steps: recipe.steps, rationale: null, created_at: new Date(Date.now() - 9 * 86400000).toISOString(), coffee: null }]} cafes={cafes} me={{ lat: -33.4372, lng: -70.6506 }} error={null} />
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
            taste={{ processes: ['natural', 'honey'], flavors: ['frutal', 'dulce'], acidity: 'alta', body: 'medio', roast: 'claro', drinks: ['filtro', 'espresso'] }}
            inferred={inferTaste(logs)}
            onSaveTaste={noop}
            onSignOut={noop}
          />
        )}
        {v === 'metrics' && (
          <div className="flex flex-col gap-6 px-6 pt-4 pb-6">
            <header className="flex flex-col gap-1.5">
              <Eyebrow>Solo admin</Eyebrow>
              <Title className="text-[34px]">Administración</Title>
            </header>
            <AdminMetricsView period={30} onPeriod={() => {}} data={metricsSample()} error={null} />
          </div>
        )}
        {v === 'detail' && (
          <LogDetailView
            log={sp.get('pending') != null ? { ...logs[0], rating: null, notes: null, brew_method: null } : { ...logs[0], notes: 'Efervescente y complejo. Mucho mango en caliente, se vuelve más cítrico al enfriar.' }}
            recipes={[{ id: 'x', coffee_log_id: '1', brew_method: 'V60', title: recipe.title, params: recipe.params, steps: recipe.steps, rationale: recipe.rationale, created_at: '', feedback: sp.get('fb') != null ? [{ id: 'f1', recipe_id: 'x', signal: 'acido', note: null, rule_id: 'A01', suggestion: 'Muele un paso más fino. Mismo ratio y misma agua.', created_at: new Date(Date.now() - 86400000).toISOString() }] : [] }]}
            onSaveFeedback={async () => {}}
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

/** Datos de ejemplo para /preview?v=metrics. */
function metricsSample(): MetricsData {
  const day = (i: number) => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
  const user = (i: number, over: Partial<UserFacts>): UserFacts => ({
    user_id: `0000000${i}-0000-0000-0000-00000000000${i}`, email: `persona${i}@correo.com`, provider: i % 3 === 0 ? 'google' : 'email',
    display_name: ['Benjamín', 'Cata', 'Matías', 'Fran', 'Pedro', 'Sofía', 'Lucas', 'Ana'][i % 8], country: 'Chile', role: 'user', created_at: new Date(Date.now() - (i * 3 + 1) * 86400000).toISOString(),
    utm: i % 4 === 0 ? { source: 'ig', campaign: 'lanz' } : null, ref: i % 5 === 0 ? 'f02b133f' : null, first_path: '/', device: i % 2 ? 'ios' : 'android', display_mode: 'standalone',
    first_scan_at: day(i), first_log_at: i % 3 === 2 ? null : new Date(Date.now() - (i * 3 + 1) * 86400000 + 3600000 * (i + 1)).toISOString(), first_recipe_at: day(i), first_share_at: i % 2 ? day(i) : null,
    hours_to_first_log: i % 3 === 2 ? null : i + 1, logs_count: 12 - i, scans_count: 14 - i, recipes_count: 6 - (i % 6), saved_recipes_count: 2, favorites_count: 3, public_logs_count: 1, cafes_proposed: i === 0 ? 2 : 0,
    distinct_roasters: 5, distinct_origins: 4, avg_rating: 4.2, last_active_at: day(i % 4), active_days_7d: i < 5 ? 3 : 0, active_days_30d: 8, events_count: 120, shares_sent: 4 - (i % 4), share_opens: i === 0 ? 9 : 0, signups_referred: i === 0 ? 2 : 0,
    ...over,
  })
  const users = Array.from({ length: 12 }, (_, i) => user(i, {}))
  const daily = Array.from({ length: 30 }, (_, i) => ({ day: day(29 - i), signups: i % 4 === 0 ? 2 : i % 7 === 0 ? 1 : 0, active_users: 3 + ((i * 7) % 6), scans: (i * 3) % 5, logs: (i * 2) % 4, recipes: i % 3, shares: i % 4 === 1 ? 1 : 0, share_opens: i % 5 === 2 ? 2 : 0 }))
  const funnel = [
    { step_order: 1, step: 'app_opened', users: 48 }, { step_order: 2, step: 'signup_completed', users: 12 }, { step_order: 3, step: 'scan_started', users: 11 },
    { step_order: 4, step: 'scan_completed', users: 10 }, { step_order: 5, step: 'log_saved', users: 9 }, { step_order: 6, step: 'recipe_requested', users: 6 }, { step_order: 7, step: 'share_clicked', users: 3 },
  ]
  const retention = [
    { cohort_week: day(28), cohort_size: 5, week_n: 0, active_users: 5, pct: 100 }, { cohort_week: day(28), cohort_size: 5, week_n: 1, active_users: 3, pct: 60 },
    { cohort_week: day(28), cohort_size: 5, week_n: 2, active_users: 2, pct: 40 }, { cohort_week: day(28), cohort_size: 5, week_n: 3, active_users: 2, pct: 40 },
    { cohort_week: day(21), cohort_size: 4, week_n: 0, active_users: 4, pct: 100 }, { cohort_week: day(21), cohort_size: 4, week_n: 1, active_users: 2, pct: 50 }, { cohort_week: day(21), cohort_size: 4, week_n: 2, active_users: 1, pct: 25 },
    { cohort_week: day(14), cohort_size: 3, week_n: 0, active_users: 3, pct: 100 }, { cohort_week: day(14), cohort_size: 3, week_n: 1, active_users: 2, pct: 67 },
  ]
  const top = [
    { kind: 'coffee_logged' as const, id: 'c1', label: 'Asunto · Catiope', value: 6 }, { kind: 'coffee_logged' as const, id: 'c2', label: 'La Pastora · Perú Cajamarca', value: 4 },
    { kind: 'roaster_logged' as const, id: 'r1', label: 'Asunto Coffee Roasters', value: 9 }, { kind: 'roaster_logged' as const, id: 'r2', label: 'La Pastora Coffee', value: 7 },
    { kind: 'coffee_viewed' as const, id: 'c1', label: 'Asunto · Catiope', value: 23 }, { kind: 'cafe_viewed' as const, id: 'k1', label: 'La Pastora Suecia', value: 14 }, { kind: 'cafe_viewed' as const, id: 'k2', label: 'Bourbon Coffee', value: 9 },
  ]
  return { users, daily, funnel, retention, top }
}
