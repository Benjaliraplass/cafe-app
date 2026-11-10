# Dripo (repo: cafe-app)

Dripo: app tipo Vivino para café de especialidad. PWA mobile-first. Dueño: Benjamín Lira Plass.
Idioma de todo (código, commits, UI, docs): español neutro. Sin emojis.

Fuente de verdad del proyecto:
- `docs/SPEC.md` — producto, arquitectura, modelo de datos, decisiones tomadas.
- `docs/ROADMAP.md` — fases, estado y qué sigue. Actualizarlo al cerrar cualquier tarea.

Este archivo lo leen tanto Claude en claude.ai (orquestador: Supabase, Netlify, GitHub) como
Claude Code en el computador de Benjamín (iteración local). Cualquier cambio de arquitectura
se escribe primero en `docs/SPEC.md` y después en código.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Vite 8 + React 19 + TypeScript, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui (estilo new-york, componentes en `src/components/ui`, `components.json` listo para `npx shadcn add`), lucide-react, react-router-dom, vite-plugin-pwa, Leaflet + react-leaflet (mapa, tiles de OpenStreetMap) |
| Backend | Supabase (proyecto `cafe-app`, ref `pfpqqwvnfusxrttajndu`, región sa-east-1): Postgres + RLS, Auth, Storage, Edge Functions (Deno) |
| IA | Gemini API (Google) desde Edge Functions, con cadena de modelos de respaldo (`gemini-3.5-flash` → `gemini-flash-latest` → `gemini-3.5-flash-lite` → `gemini-2.5-flash`), timeout 20 s por llamada y reintentos ante 429/503. Secret `GEMINI_API_KEY` en Supabase. Anthropic queda como proveedor alternativo (`ANTHROPIC_API_KEY`); la capa está en `supabase/functions/_shared/ai.ts` |
| Hosting | Netlify (cuenta benjamin@tostadoclub.com), sitio conectado al repo, build `npm run build`, publish `dist`, SPA redirect en `netlify.toml`. URL actual: https://sweet-faloodeh-218899.netlify.app |
| Repo | github.com/Benjaliraplass/cafe-app, rama `main` deploya a producción |

## Estructura

```
src/
  lib/supabase.ts      cliente + helper de URL de fotos
  lib/types.ts         tipos compartidos (ScanResult, Coffee, CoffeeLog, Recipe, Cafe)
  lib/api.ts           TODAS las lecturas/escrituras a Supabase y llamadas a Edge Functions
  lib/image.ts         redimensiona fotos a JPEG base64 antes de enviarlas
  lib/countries.ts     lista de países (español) para tostador y nacionalidad
  lib/recommend.ts     "cafés que van contigo": orden por afinidad con los cafés bien puntuados
  lib/share.ts         Web Share API con fallback a portapapeles
  lib/geo.ts           distancia, geolocalización, geocodificación Nominatim, enlaces a mapas
  hooks/useAuth.tsx    sesión de Supabase + perfil (rol admin) en contexto
  lib/utils.ts         cn() (clsx + tailwind-merge)
  components/ui/       primitivos shadcn: button, input, textarea, select, label, badge, chip, card, skeleton, separator
  components/primitives.tsx  Field, Eyebrow, Title, SectionTitle, Rating, Spinner, ErrorBox, Empty, Photo, StatTile, KeyValue, CountrySelect
  components/CoffeeLogForm.tsx  formulario compartido de café + experiencia (Scan y EditLog)
  components/cards.tsx  HScroll, LogCard, FeaturedRecipeCard, CoffeeCard, CafeRow, SectionHeader (Inicio y listados)
  components/CafeMap.tsx  mapa Leaflet con marcadores propios; PickLocationMap para fijar un punto
  components/Layout.tsx  Layout + BottomNav flotante "liquid glass" de 5 ítems con Escanear central (utilidades `glass` / `glass-solid` en index.css)
  pages/               Login (correo + Google), Inicio (+InicioView), Home = Mis cafés en /logs (+HomeView), Scan, EditLog, LogDetail (+LogDetailView, RecipeCard),
                       Recipes (+RecipesView), FeaturedRecipe (/r/:slug, /featured), PublicCoffee (/c/:id, /catalog), Explore (+ExploreView, mapa), NewCafe (/explore/new), Profile (+ProfileView), Admin (/admin, solo rol admin; lazy)
  pages/Preview.tsx    solo en dev: /preview?v=inicio|explore|featured|coffee|home|detail|edit|profile|scan|recipes|login|empty|loading con datos de ejemplo
supabase/
  migrations/          SQL versionado; se aplica con el MCP de Supabase o `supabase db push`
  seed/                datos curados (recetas destacadas); idempotente por slug
  functions/_shared/ai.ts          capa de IA (Gemini / Anthropic), JSON estructurado, reintentos, CORS
  functions/scan-label/            foto de etiqueta -> JSON estructurado
  functions/suggest-recipe/        café + método -> receta estructurada
netlify/edge-functions/og.ts   meta tags Open Graph para /r/* y /c/* (lee Supabase con la clave pública)
docs/                  SPEC.md, ROADMAP.md
```

## Convenciones

- Acceso a datos solo en `src/lib/api.ts`. Las páginas no llaman a `supabase.from` directamente (excepción puntual: subida de foto en Admin).
- Rutas públicas (`/r/:slug`, `/c/:id`) viven fuera del Gate en `App.tsx` y deben funcionar sin sesión; todo lo demás exige login. Acciones de admin se protegen con RLS (`is_admin()`), no solo en la UI.
- Cada tabla nueva: RLS activado, políticas `to authenticated`, `(select auth.uid())` en vez de `auth.uid()`, índice en cada FK.
- Edge Functions devuelven siempre `{ ok: true, data }` o `{ ok: false, error }` y manejan `OPTIONS`.
- JSON estructurado desde la IA: definir el schema como tool (`input_schema`) y llamar `callStructured` (ver `_shared/ai.ts`); Gemini usa `responseSchema`, Anthropic `tool_choice` forzado. Nunca parsear texto libre.
- UI: diseño V3 de Figma (claro, escala de grises, DM Sans). Tokens como variables CSS en `src/index.css` (`:root` light, `.dark` dark) mapeadas a Tailwind con `@theme inline`; nombres shadcn (`background`, `card`, `muted`, `border`, `primary`...) más `tertiary` y `border-strong`. Utilidad `eyebrow` para etiquetas en mayúsculas. Fuente única: DM Sans (Google Fonts, cargada en `index.html`).
- Componentes: usar `@/components/ui/*` y `@/components/primitives`. No crear estilos ad hoc si existe un primitivo. Nuevos componentes shadcn se agregan con `npx shadcn@latest add <nombre>` desde el computador (el registro no es accesible desde claude.ai).
- Vistas con datos las separamos en contenedor (fetch) + vista presentacional (`HomeView`, `LogDetailView`) para poder previsualizarlas en `/preview`.
- Commits en español, imperativo, cortos. Un cambio por commit.
- Alias `@/` apunta a `src/` (tsconfig + vite).
- Variables de entorno del frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (ver `.env.example`). Nunca la service role key en el cliente.

## Comandos

```
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc -b && vite build
npm run preview
```

Edge Functions: se despliegan desde el MCP de Supabase (claude.ai) o con `supabase functions deploy <nombre>`.
Migraciones: `supabase/migrations/*.sql` es el historial; aplicar con el MCP (`apply_migration`) o `supabase db push`.

## Qué NO hacer

- No exponer la API key de Gemini/Anthropic ni la service role key en el frontend.
- No crear tablas sin RLS.
- No cambiar el esquema sin agregar el archivo de migración correspondiente.
- No agregar dependencias pesadas de UI (MUI, Chakra). Tailwind + componentes propios.
