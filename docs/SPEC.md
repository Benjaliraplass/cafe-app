# SPEC — Dripo (repo: cafe-app)

Última actualización: 2026-11-09

## 1. Qué es

Una app tipo Vivino para café de especialidad, pensada primero para Chile:

1. **Diario de cafés**: fotografías la bolsa, la IA lee la etiqueta (tostador, origen, finca, variedad, proceso, altura, tueste, notas, fecha de tueste), confirmas y guardas con tu puntaje y notas.
2. **Recetas por origen**: a partir de los datos del café y el método que uses, la IA propone una receta concreta (dosis, agua, temperatura, molienda, tiempos, pasos, ajustes).
3. **Explorar**: cafeterías y tostadurías de especialidad en Chile, con búsqueda por nombre y comuna.

## 2. Decisiones tomadas (2026-11-09)

| Tema | Decisión |
|---|---|
| Plataforma | PWA mobile-first (React + Vite). Empaquetar con Capacitor si más adelante se necesita tienda. |
| Backend | Supabase: Postgres + RLS, Auth, Storage, Edge Functions. |
| IA | Gemini API (key de Benjamín), llamada solo desde Edge Functions. Salida estructurada vía `responseSchema`. Cadena de modelos de respaldo y timeout por llamada porque `gemini-flash-latest` respondió 503 / se colgó en la primera prueba (2026-11-09). Anthropic queda disponible como proveedor alternativo en la misma capa. |
| Escaneo | Sin base de etiquetas previa. La IA extrae los datos; el catálogo (`roasters`, `coffees`) se construye con cada escaneo confirmado. |
| Datos de cafeterías | Seed curado propio + alta por usuarios con moderación (`status = pending` hasta aprobar). Google Places queda como opción futura. |
| Alcance | Beta cerrada por invitación. Registros privados por defecto (`is_public = false`). |
| Marca | Nombre v1: **Dripo** (decidido 2026-11-09). Pendientes: dominio y relación con Tostado Club / Pantera. |
| Orden | Fase 1 diario + escaneo → Fase 2 recetas → Fase 3 explorar. |

## 3. Arquitectura

```
[PWA en Netlify] --supabase-js--> [Supabase Auth / Postgres (RLS) / Storage]
        |
        +--functions.invoke(JWT)--> [Edge Function scan-label]     --> Gemini API (visión)
        +--functions.invoke(JWT)--> [Edge Function suggest-recipe] --> Gemini API (texto)
```

- El cliente nunca ve la API key de Gemini.
- Las Edge Functions exigen JWT válido (`verify_jwt = true`); solo usuarios autenticados consumen IA.
- Fotos: el cliente redimensiona a máx. 1280 px JPEG q0.85 antes de subir y de enviar a la IA (controla costo y latencia).

## 4. Modelo de datos

| Tabla | Para qué | Acceso (RLS) |
|---|---|---|
| `profiles` | 1:1 con `auth.users`, creado por trigger. `role` ('user' / 'admin'; función `is_admin()`, trigger impide cambiar el propio rol), `display_name`, `avatar_url` (ruta en bucket `avatars` o URL absoluta de Google), `country` (nacionalidad, nombre en español), `equipment` jsonb: `{ grinder, drippers[], espresso_machine, other }` | Lectura pública; escribe el dueño |
| `roasters` | Tostadurías (catálogo compartido), `slug` único, `country` (seleccionable en el formulario; la IA lo infiere de la etiqueta) | Lectura pública; crea cualquier autenticado; edita el creador |
| `coffees` | Cafés del catálogo compartido, FK a `roasters`. `sca_score` (puntaje de taza 60-100, leído de la etiqueta o manual), `is_published`, `published_at`, `photo_path` para el catálogo público | Lectura pública; crea cualquier autenticado; edita el creador o el admin |
| `coffee_logs` | Diario personal: foto, puntaje (0 = sin puntaje), notas, método, fecha de tueste, precio, `is_favorite`, `is_public` (compartido en la ficha del café), `raw_scan` jsonb | Solo el dueño; los públicos los ve cualquiera, incluso sin sesión. Vista `coffee_public_stats` (promedio y cantidad) |
| `featured_recipes` | Recetas destacadas curadas: autor, rol (tostador/campeón/barista), país, evento, familia, dripper, `params`, `steps`, historia, fuente, foto, `is_published`, `sort_order` | Publicadas: lectura pública (anon incluido). Escribe solo admin |
| `recipes` | Recetas generadas/guardadas por usuario, ligadas a un `coffee_log` | Solo el dueño |
| `cafes` | Cafeterías/tostadurías con local, `kind` (cafe/roastery/both), `status` de moderación, `lat/lng`, `google_maps_url` (ficha del local: fotos, horario, reseñas; formato `https://maps.google.com/?cid=...`), `photo_path`, `approved_by/approved_at`, `rejection_reason` | Se ven las aprobadas y las propias; alta como `pending`; el autor edita la suya mientras está pendiente pero no puede cambiar el estado; el admin ve y modera todo |
| `events` | Eventos de producto (ver §8): `name`, `props`, `user_id`/`anonymous_id`/`session_id`, `utm`, `ref`, dispositivo. Append-only | Sin políticas: nadie lee ni escribe directo. Escritura vía RPC `track_event` (anon y authenticated); lectura agregada vía funciones `admin_*` (solo admin) |
| `taste_profiles` | Perfil de gusto declarado (`data` jsonb: processes[], flavors[≤2], acidity, body, roast, drinks[]; `normalizeTaste` acepta la forma antigua en singular). Tabla aparte de `profiles` para que sea privado | Solo el dueño (select/insert/update/delete) |
| Storage `coffee-photos` | Bucket público, ruta `{user_id}/{uuid}.jpg`, máx 10 MB | Escribe solo en su carpeta |
| Storage `avatars` | Bucket público, ruta `{user_id}/avatar-{ts}.jpg`, máx 5 MB, 512 px | Escribe solo en su carpeta |

Migraciones en `supabase/migrations/`.

## 5. Edge Functions

### `scan-label`
- Entrada: `{ image_base64, media_type }` (jpeg/png/webp).
- Salida: `ScanResult` (ver `src/lib/types.ts`), con `confidence` (alta/media/baja), `is_coffee_label` y `notes_for_user`.
- Prompt: extraer solo lo escrito; `null` si no está; normalización de país, proceso y perfil de tueste en español. Infiere `roaster_country` (ciudad o dominio .cl → Chile). Fecha de tueste sin año → año en curso (o el anterior si quedara en el futuro).

### `suggest-recipe`
- Entrada: `{ coffee?, coffee_description?, method_family (conico|flat|inmersion|espresso), dripper, servings? (tazas, 1 taza = 250 g agua), dose_g?, equipment?, preferences? }`. `brew_method` se acepta por compatibilidad.
- El prompt codifica reglas por familia (cónico, fondo plano, inmersión, espresso), escalado por cantidad y principios de tres escuelas (Hoffmann: precisión y ratios 1:16-1:17; Wendelboe: limpieza y agua caliente; Campos: dulzor y temperaturas más bajas en procesados).
- Salida: `RecipeData`: `params` (dosis, agua, ratio, temperatura, molienda, tiempo, salida, presión), `steps` con tiempos, `rationale`, `adjustments` (3), `rest_advice`.
- La receta se justifica por origen/proceso/tueste; considera reposo si hay fecha de tueste.

Secret requerido: `GEMINI_API_KEY`. Opcionales: `GEMINI_MODEL` / `GEMINI_MODELS` (cadena), `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.

## 6. Flujos de la app

0. **Barra inferior** (5 ítems): Inicio · Explorar · botón central "+" (abre una hoja con dos acciones: Escanear etiqueta / Pedir una receta) · Mis cafés · Perfil. El wizard de Recetas también se abre desde la tarjeta "Receta para hoy" de Inicio (`/recipes?log=<id>&dripper=<dripper>`, entra directo al paso de cantidad con el último café escaneado y el primer dripper del equipo), desde el detalle de un café (bloque de receta justo bajo la ficha) y desde "Recetario" en Mis cafés (`/recipes?view=saved`, solo recetas guardadas).
0b. **Inicio** (`/`): saludo con nombre y avatar; "Tus últimos escaneos" (hasta 8 registros recientes con foto, puntaje y fecha, más tarjeta "Escanear otro"; sin registros, invitación a escanear el primero); "Recetas destacadas" (scroll horizontal, `/featured` para ver todas, `/r/:slug` ficha); "Cafés que van contigo" (catálogo publicado ordenado por afinidad con los cafés que el usuario puntuó 4-5: origen x2, proceso x1,5, perfil de tueste x1, tostador x1, más el perfil de gusto declarado (familia de sabor x1,5, proceso x1); sin historial, los más recientes; `/catalog` para ver todos, `/c/:id` ficha); accesos rápidos a Recetas y Escanear.
0c. **Fichas públicas** (`/r/:slug`, `/c/:id`): funcionan sin sesión con una barra "Abrir Dripo"; con sesión se ven dentro del Layout. Botón Compartir (Web Share API; si no está disponible copia el enlace). La ficha del café muestra promedio y cantidad de puntajes públicos y los registros compartidos (nombre, avatar, puntaje, notas).
0d. **Administración** (`/admin`, solo rol admin, enlace en Perfil): crear/editar/publicar recetas destacadas (con foto al bucket `coffee-photos`, carpeta `{uid}/featured/`), publicar o quitar cafés del catálogo (toma la foto del registro del admin). Pestaña Cafeterías: cola de pendientes con aprobar / rechazar (motivo visible para quien la propuso).

1. **Login**: correo + contraseña o Google (`signInWithOAuth`, `redirectTo = window.location.origin`). Google requiere el proveedor habilitado en Supabase Auth con credenciales de Google Cloud; si no está habilitado, la app muestra un mensaje claro.
2. **Escanear**: cámara o galería → redimensionar → `scan-label` → formulario prellenado → editar → guardar (sube foto, resuelve/crea tostador y café, inserta log). Si la IA falla, se puede completar a mano.
3. **Mis cafés** (`/logs`): lista de logs con foto, tostador, café, origen, puntaje y fecha. Corazón sobre la foto para marcar favorito (optimista); filtros Todos / Filtro / Espresso / Favoritos.
4. **Detalle**: ficha completa + generador de recetas (método + equipo) → guardar receta → lista de recetas guardadas. Acciones: favorito, editar (`/log/:id/edit`, mismo formulario que el escaneo; permite cambiar foto, puntaje, país del tostador, etc.) y eliminar. Si el café del catálogo lo creó otro usuario, al editar se crea una copia propia y se reasigna el registro.
5. **Recetas** (`/recipes`): wizard de 4 pasos; en el paso final aparece "Usar mi perfil de gusto" (activado por defecto) que agrega el perfil declarado a `preferences` del prompt; en el paso de cantidad manda la dosis en gramos (default 15 g) y se derivan agua y personas (200 ml por persona) con el ratio de la familia (1:16 filtro, 1:15 inmersión); las personas también se pueden ajustar y recalculan la dosis → receta con IA → guardar (ligada al café si se eligió uno). Debajo, recetario de recetas guardadas.
6. **Explorar** (`/explore`): layout tipo Resy. Mapa arriba (MapLibre GL con tiles vectoriales de OpenFreeMap, estilo "positron" gris claro, sin API key; marcadores propios en negro, punto azul para el usuario, botón de mi ubicación, "Buscar en esta zona" filtra por el encuadre). Panel abajo con buscador, filtros (todo / cafeterías / tostadurías), lista ordenada por distancia al usuario (o al centro del mapa) con tipo, distancia, dirección, "Ver en Google Maps" (ficha del local con fotos, horario y ruta; sin foto propia en Dripo por ahora) e Instagram; tocar un pin o una fila abre una burbuja anclada al pin (tipo, nombre, dirección, "Ver en Google Maps") y la fila pasa al primer lugar de la lista (el resto sigue ordenado por cercanía, sin scroll automático); el mapa no se recentra, solo se desplaza lo mínimo si el pin queda fuera de la zona visible; tocar el mapa vacío cierra la burbuja. Pines SVG con la punta anclada en la coordenada (crecen desde la punta al seleccionarse). "Mis propuestas" muestra las del usuario pendientes o rechazadas (con motivo). `/explore/new`: nombre, tipo, enlace de Google Maps opcional, dirección geocodificada con Nominatim (OSM) o punto fijado a mano en un mini mapa con marcador arrastrable, comuna, ciudad, Instagram, web, descripción, foto (bucket `coffee-photos`, carpeta `{uid}/cafes/`); queda `pending`. La geolocalización solo se pide al tocar el botón; en Inicio se usa únicamente si ya estaba concedida.
7. **Perfil**: foto de perfil (bucket `avatars`), nombre, nacionalidad, "Mi perfil de gusto" (cuestionario de 6 preguntas basado en atributos de catación y familias simplificadas de la rueda SCA: procesos (varios), hasta 2 familias de sabor, acidez, cuerpo, tueste, preparaciones favoritas (varias: filtro, espresso, con leche); resumen en chips + barras por familia inferidas de los cafés puntuados 4-5 mapeando notas de cata a familias en `lib/taste.ts`), "Mi equipo" (molino, drippers por familia, máquina de espresso, otros), tarjeta "Dripo · beta" con botón de feedback (`mailto:benjamin@tostadoclub.com`) y cerrar sesión. El equipo alimenta las recetas sin volver a escribirlo.

## 7. Dirección visual (decidida 2026-11-09)

- Referencias: Vivino (estructura), Blue Bottle Coffee y Honest Greens (tono minimalista, editorial).
- Elegida: **V3 — tema claro, escala de grises, DM Sans**. Figma: https://www.figma.com/design/tC72X7goZvicV5dbNaxeVx (página "Dripo — App", sección "v3 ✓ ELEGIDA"; v1 Fraunces oscuro y v2 DM Sans oscuro quedan como referencia).
- Tokens (colección "Dripo / Color", modo Light → CSS `:root`): `background #FFFFFF`, `card #F5F4F1`, `muted #ECEAE6`, `border #E6E3DE`, `border-strong #CFCBC4`, `foreground #111111`, `muted-foreground #6B6763`, `tertiary #9A958F`, `primary #111111` / `primary-foreground #FFFFFF`. El modo Dark (V2) existe en Figma y en `.dark` del CSS para activarlo a futuro.
- Tipografía: DM Sans. Títulos Medium con tracking -3 % (34-46 px), cifras Medium, cuerpo Regular, etiquetas 10-11 px en mayúsculas con tracking 8 %.
- Mapas: MapLibre GL + OpenFreeMap (vectorial, nítido en retina; estilo `positron` en `MAP_STYLE`, alternativa `bright` más colorida). El worker de MapLibre se registra con `setWorkerUrl` porque Vite renombra los chunks. Al ubicar al usuario, el mapa encuadra su posición y las 3 cafeterías más cercanas (< 15 km). Atribución compacta arriba a la izquierda. Explorar, Admin y Preview se cargan con `React.lazy` para no meter el mapa en el bundle principal. En desarrollo, `?offlinemap` usa un estilo vacío para QA sin red.
- Barra inferior flotante tipo "liquid glass" (referencia Uber) con botón central negro para Escanear (referencia Vivino): píldora `glass` (fondo 62 % + `backdrop-filter: blur(24px) saturate(180%)`, borde de luz interior, sombra suave), separada de los bordes, 4 ítems iguales; el activo lleva una píldora negra. Las barras de acción fijas (guardar café, guardar cambios) usan `glass-solid` (94 %) con la misma geometría, para tapar la barra sin transparentar sus textos. El contenido lleva `pb-32` para no quedar oculto.
- Componentes: inputs `card` con borde `border` radio 12 y alto 48; botón primario negro radio 14 alto 54; chips redondeados (activo negro); fotos con esquinas 14-20; listas con divisores en vez de tarjetas.
- Implementación: shadcn/ui (Radix + cva + Tailwind v4) con los tokens anteriores como variables CSS.

## 8. Datos y analítica (decidido 2026-11-10)

Objetivo: entender activación, retención y viralidad desde el primer usuario. Tres capas:

| Capa | Qué es | Dónde |
|---|---|---|
| Producto | Estado actual (tablas de la sección 4) | Supabase |
| Eventos | Qué hizo cada usuario y cuándo. Append-only. Cada evento se escribe dos veces: en PostHog (exploración: funnels, retención, cohortes, replay) y en la tabla `events` de Supabase (fuente de verdad, cruzable con producto) | PostHog + Supabase |
| Derivados | Métricas por usuario y por día calculadas desde las dos anteriores. Nunca se escriben a mano | Funciones SQL `admin_*` (security definer, exigen `is_admin()`) |

### Tabla `events`

`id`, `ts`, `user_id` (null si anónimo; `on delete set null`), `anonymous_id` (id persistente en localStorage, une la visita anónima con el signup), `session_id` (sessionStorage), `name`, `props` jsonb, `path`, `display_mode` (standalone/browser), `device` (ios/android/desktop), `app_version`, `utm` jsonb (`source, medium, campaign, content`), `ref` (id corto del usuario que compartió el enlace). Índices por `(name, ts)`, `(user_id, ts)`, `(anonymous_id)`.

RLS: nadie lee desde el cliente (ni admin; las lecturas van por las funciones `admin_*`). La escritura es solo vía RPC `track_event(...)` (security definer, `anon` y `authenticated`), que fija `user_id = auth.uid()`, valida el nombre (`^[a-z_]{3,40}$`) y limita `props` a 4 KB. Sin PII en `props` (nada de correos ni teléfonos); el join es por `user_id`.

### Taxonomía de eventos (v1)

| Área | Eventos (props principales) |
|---|---|
| Ciclo de vida | `app_opened` (display_mode, utm, ref), `signup_completed` (provider), `login_completed` (provider), `pwa_installed` |
| Escaneo | `scan_started` (from), `scan_completed` (duration_ms, fields_filled), `scan_failed` (reason), `log_saved` (rating, method, is_new_coffee), `log_edited`, `log_deleted` |
| Recetas | `recipe_requested` (family, dripper, from), `recipe_generated` (duration_ms), `recipe_saved`, `recipe_failed` (reason) |
| Descubrimiento | `featured_recipe_viewed` (slug), `public_coffee_viewed` (coffee_id, logged_in), `catalog_viewed`, `cafe_viewed` (cafe_id), `cafe_maps_clicked` (cafe_id), `cafe_proposed` |
| Social | `share_clicked` (type: log/coffee/recipe, result: shared/copied), `share_link_opened` (type, ref, logged_in), `log_made_public` (value) |
| Perfil | `taste_profile_saved`, `profile_updated`, `feedback_clicked` |

Propiedades comunes en todos: `user_id`, `anonymous_id`, `session_id`, `path`, `display_mode`, `device`, `app_version`. UTM y `ref` se capturan en la primera carga, se guardan en localStorage y viajan en `app_opened` y `signup_completed` para atribuir el registro.

### Viralidad

Todo enlace compartido lleva `?ref=<8 primeros caracteres del user_id>`. Al abrirlo se registra `share_link_opened`; si esa persona se registra, `signup_completed` lleva ese `ref`. Factor K = (shares por usuario activo) x (signups por share).

### Modelos derivados (funciones `admin_*`)

| Función | Devuelve |
|---|---|
| `admin_user_facts()` | Una fila por usuario: identidad (email desde `auth.users`, provider, país, created_at), adquisición (utm, ref, first_path, device), activación (`first_scan_at`, `first_log_at`, `first_recipe_at`, `first_share_at`, `time_to_first_log`), uso (logs, escaneos, recetas, favoritos, cafeterías propuestas, tostadores y orígenes distintos, rating promedio), retención (`last_active_at`, `active_days_7d/30d`), social (`shares_sent`, `share_opens`, `signups_referred`, `public_logs`) |
| `admin_daily_metrics(days)` | Por día: signups, usuarios activos, escaneos, logs, recetas, shares, aperturas de enlaces |
| `admin_funnel(days)` | Usuarios únicos por paso: app_opened → signup → scan_started → scan_completed → log_saved → recipe_requested → share_clicked |
| `admin_retention()` | Cohortes semanales de registro x semanas desde el registro (% activos) |
| `admin_top(days)` | Top cafés vistos/escaneados, cafeterías vistas, tostadores |

Definiciones: **activado** = primer `coffee_log` guardado. **Activo** = al menos un evento en el período. Las funciones leen `events` y las tablas de producto; el volumen esperado del primer año no requiere materializar.

### Front

`src/lib/analytics.ts`: `initAnalytics()`, `identify(user)`, `track(name, props)`. Envía a PostHog (proyecto Dripo, US Cloud, id 725420; `posthog-js` con import dinámico, `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST`) y a `track_event`. Sin PostHog configurado, sigue escribiendo en Supabase. Ambos fallan en silencio: la analítica nunca rompe la app.

Métricas en `/admin` → pestaña "Métricas": activación, retención, funnel, factor K y top, desde las funciones `admin_*`. PostHog para exploración ad hoc y session replay.

## 9. Pendientes conocidos

- Seed de cafeterías/tostadurías de Chile (Fase 3).
- Red desde claude.ai: para QA end-to-end real (crear usuario de prueba, escanear, guardar) hace falta permitir `*.supabase.co` y `*.netlify.app` en claude.ai → Settings → Capabilities. Hoy la QA de RLS se hace con SQL simulando usuarios y la visual con `/preview`.
- Íconos definitivos (los actuales son una gota monocroma provisoria).
- Dominio (2026-11-10): `dripocoffee.com` (GoDaddy) como dominio principal en Netlify; `www` redirige al apex. DNS en GoDaddy: A `@` → `75.2.60.5`, CNAME `www` → `sweet-faloodeh-218899.netlify.app`. El sitio sigue respondiendo también en `sweet-faloodeh-218899.netlify.app`.
- Login con Google (2026-11-10): Google Identity Services en el navegador (`src/lib/google.ts`, botón renderizado por GIS en Login) + `supabase.auth.signInWithIdToken` con nonce. Google muestra `dripocoffee.com` en vez del dominio de Supabase. Requiere `VITE_GOOGLE_CLIENT_ID` (público; configurado en Netlify) y los orígenes `https://dripocoffee.com`, `http://localhost:5173` y `https://sweet-faloodeh-218899.netlify.app` en el cliente OAuth. Si GIS no carga, Login cae al flujo OAuth clásico de Supabase.
- Google OAuth (configurado 2026-11-09): proyecto Google Cloud `app-cafe` (Google Auth Platform), cliente web "Dripo web" (ID `328278356810-m643i3d6ebndjr9c80o0m11aaeeio2d6.apps.googleusercontent.com`) con callback `https://pfpqqwvnfusxrttajndu.supabase.co/auth/v1/callback`; app en producción con página principal `https://dripocoffee.com` y política de privacidad `https://dripocoffee.com/privacidad` (ruta pública de la app, `src/pages/Privacy.tsx`; la copia en `tostadoclub.com/pages/privacidad-dripo` queda como respaldo). En Supabase: proveedor Google activo, Site URL `https://dripocoffee.com`, Redirect URLs `https://dripocoffee.com/**`, `https://sweet-faloodeh-218899.netlify.app/**` y `http://localhost:5173/**`.
- Cerrar registros (beta por invitación): en Supabase Auth desactivar "Allow new users to sign up" e invitar desde el dashboard, o tabla de allowlist.
- Perfil público / social (seguir, feed) — fuera del MVP.
- Capacitor para tiendas — fuera del MVP.
