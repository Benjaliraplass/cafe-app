# cafe-app (nombre de trabajo: Origen)

App tipo Vivino para café de especialidad. PWA mobile-first. Dueño: Benjamín Lira Plass.
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
| Frontend | Vite 8 + React 19 + TypeScript, Tailwind v4 (`@tailwindcss/vite`), react-router-dom, vite-plugin-pwa |
| Backend | Supabase (proyecto `cafe-app`, ref `pfpqqwvnfusxrttajndu`, región sa-east-1): Postgres + RLS, Auth, Storage, Edge Functions (Deno) |
| IA | Anthropic API desde Edge Functions. Modelo por defecto `claude-sonnet-5-5` (env `ANTHROPIC_MODEL`). La key vive solo en el secret `ANTHROPIC_API_KEY` de Supabase |
| Hosting | Netlify, build `npm run build`, publish `dist`, SPA redirect en `netlify.toml` |
| Repo | github.com/Benjaliraplass/cafe-app, rama `main` deploya a producción |

## Estructura

```
src/
  lib/supabase.ts      cliente + helper de URL de fotos
  lib/types.ts         tipos compartidos (ScanResult, Coffee, CoffeeLog, Recipe, Cafe)
  lib/api.ts           TODAS las lecturas/escrituras a Supabase y llamadas a Edge Functions
  lib/image.ts         redimensiona fotos a JPEG base64 antes de enviarlas
  hooks/useAuth.tsx    sesión de Supabase (contexto)
  components/ui.tsx    Button, Field, Input, Chip, Card, Rating, Spinner, ErrorBox, Empty
  components/Layout.tsx  barra inferior con 4 tabs
  pages/               Login, Home (diario), Scan, LogDetail (+ recetas), Explore, Profile
supabase/
  migrations/          SQL versionado; se aplica con el MCP de Supabase o `supabase db push`
  functions/_shared/anthropic.ts   cliente mínimo de Anthropic + CORS
  functions/scan-label/            foto de etiqueta -> JSON estructurado
  functions/suggest-recipe/        café + método -> receta estructurada
docs/                  SPEC.md, ROADMAP.md
```

## Convenciones

- Acceso a datos solo en `src/lib/api.ts`. Las páginas no llaman a `supabase.from` directamente.
- Cada tabla nueva: RLS activado, políticas `to authenticated`, `(select auth.uid())` en vez de `auth.uid()`, índice en cada FK.
- Edge Functions devuelven siempre `{ ok: true, data }` o `{ ok: false, error }` y manejan `OPTIONS`.
- JSON estructurado desde Claude: usar `tool_choice` forzado (ver `_shared/anthropic.ts`), nunca parsear texto libre.
- UI: tokens de color en `src/index.css` (`@theme`). Tipografía display `Fraunces`, texto `Inter`.
- Commits en español, imperativo, cortos. Un cambio por commit.
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

- No exponer la API key de Anthropic ni la service role key en el frontend.
- No crear tablas sin RLS.
- No cambiar el esquema sin agregar el archivo de migración correspondiente.
- No agregar dependencias pesadas de UI (MUI, Chakra). Tailwind + componentes propios.
