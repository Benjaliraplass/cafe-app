# ROADMAP — Dripo

Estado por fase. Marcar con [x] al cerrar. Cada fase termina con deploy en Netlify y prueba en el teléfono de Benjamín.

## Fase 0 — Infraestructura (2026-11-09)

- [x] Proyecto Supabase `cafe-app` (sa-east-1)
- [x] Esquema inicial + RLS + bucket `coffee-photos`
- [x] Edge Functions `scan-label` y `suggest-recipe` desplegadas
- [x] Secret `GEMINI_API_KEY` cargado en Supabase (se cambió de Anthropic a Gemini)
- [x] Scaffold PWA: auth, diario, escaneo, detalle, recetas, explorar, perfil
- [x] Repo con CLAUDE.md, SPEC, ROADMAP
- [x] Sitio en Netlify (cuenta Tostado Club) conectado al repo, env vars y primer deploy: https://sweet-faloodeh-218899.netlify.app
- [x] `scan-label` probado end-to-end con etiqueta sintética (200 OK, 6,9 s, todos los campos correctos)
- [x] `suggest-recipe` probado (200 OK, receta V60 coherente con el café) pero tardó 51 s
- [ ] Prueba end-to-end en teléfono: registro → escaneo real → guardar → receta
- [ ] Renombrar el sitio en Netlify (ej. `origen-cafe`) y borrar el sitio huérfano `origen-cafe-app` del team Global66

## Fase UI — Rediseño en escala de grises + shadcn/ui

- [x] Dirección visual definida: 3 variantes en Figma, elegida V3 (claro, DM Sans). Nombre: Dripo
- [x] shadcn/ui montado a mano (registro bloqueado desde claude.ai), tokens light/dark en CSS
- [x] Reimplementadas Login, Mis cafés, Confirmar café, Detalle, Explorar, Perfil según Figma V3
- [x] Barra inferior transparente con blur; íconos lucide-react; íconos PWA y favicon "Dripo"
- [x] Barra inferior flotante "liquid glass" (píldora con blur/saturación, ítem activo en negro) y barras de acción con la misma geometría
- [ ] Transiciones con framer-motion (instalado, sin usar aún)
- [ ] Prueba en teléfono del rediseño y ajustes finos
- [ ] Renombrar el sitio en Netlify (ej. `dripo-app`) y, cuando haya dominio, conectarlo

## Fase 1 — Diario + escaneo (MVP usable)

- [ ] Bajar latencia de `suggest-recipe` (51 s): probar `thinkingLevel`/`thinkingBudget` bajo en Gemini, acortar schema, o `gemini-3.5-flash-lite` primero para recetas; registrar modelo y ms por llamada en logs
- [ ] Pedir tildes explícitas en el prompt de recetas (Gemini devolvió "cafe", "extraccion")
- [x] Prompt de escaneo: si la fecha de tueste viene sin año ("26/10"), asumir el año en curso; además infiere el país del tostador
- [x] Subir límite de tokens de salida y tratar JSON inválido/truncado como reintentable (fix del error en etiqueta Asunto)

- [ ] Ajustar el prompt de `scan-label` con 10-20 etiquetas reales chilenas (Tostado Club, Pantera, otros)
- [x] Editar un registro existente (`/log/:id/edit`): puntaje (incluye volver a 0), foto, datos del café, país del tostador
- [x] País del tostador seleccionable (lista en `src/lib/countries.ts`)
- [x] Favoritos: corazón en lista y detalle, filtro "Favoritos" (`coffee_logs.is_favorite`)
- [x] Perfil: foto (bucket `avatars`), nombre y nacionalidad
- [x] Botón de feedback por correo en "Dripo · beta"
- [x] QA: build, capturas de todas las vistas en `/preview`, RLS verificado con SQL (usuario A edita lo suyo; usuario B no puede leer/editar registros, perfil, café ni avatar de A), advisors sin alertas nuevas
- [ ] Autocompletar tostador y café desde el catálogo al escribir (evitar duplicados)
- [ ] Vista de un café del catálogo: todos mis registros de ese café
- [ ] Estadísticas simples en Home: cafés este mes, origen más repetido, puntaje promedio
- [ ] Cerrar registros (beta por invitación) y lista de invitados
- [x] Google OAuth: proyecto Google Cloud `app-cafe`, app publicada (pantalla de consentimiento con política de privacidad en tostadoclub.com/pages/privacidad-dripo), proveedor habilitado en Supabase, Site URL y Redirect URLs configuradas. Pendiente: prueba en teléfono

## Lote 3 — Inicio, catálogo compartido, compartir y cafeterías (2026-11-10)

- [x] Bloque 0: roles admin (`profiles.role`, `is_admin()`), cafés publicables, `featured_recipes`, moderación de cafeterías; 17/17 pruebas RLS con usuarios simulados (se cerró un hueco: el autor podía autoaprobar su cafetería)
- [x] Bloque 1: Recetas con gramos como campo principal y personas a 200 ml; `suggest-recipe` v7
- [x] Bloque 2: pestaña Inicio (recetas destacadas, cafés que van contigo, accesos rápidos), barra de 5 ítems con Escanear central, fichas públicas `/r/:slug` y `/c/:id` con Compartir, `/featured`, `/catalog`, panel `/admin` (recetas destacadas y publicación de cafés), seed de 7 recetas destacadas (Hoffmann V60/Aeropress/prensa, Kasuya 4:6, Wendelboe V60, Kalita y espresso base de Dripo) en `supabase/seed/featured_recipes.sql`
- [x] Bloque 3: switch "Compartir mi registro" y botón Compartir en el detalle; Netlify Edge Function `og.ts` con meta tags OG para `/r/*` y `/c/*`
- [x] Bloque 4: Explorar con mapa (MapLibre GL + OpenFreeMap vectorial, estilo claro; marcadores propios, mi ubicación, "Buscar en esta zona"), lista ordenada por distancia, filtros, "Mis propuestas" con estado; `/explore/new` con geocodificación Nominatim y marcador arrastrable; pestaña Cafeterías en `/admin` (aprobar / rechazar con motivo); sección "Cafeterías cerca" en Inicio; Explorar, Admin y Preview en chunks aparte (bundle 586 → 296 KB)
- [ ] Aviso al admin cuando llega una cafetería nueva (hoy se ve el contador en `/admin`)
- [x] Seed inicial de cafeterías: 33 locales (4 en Pichilemu, 29 en Santiago) cargados aprobados desde la lista de Benjamín (`supabase/seed/cafes_2026_11.sql`). Cada local con enlace a su ficha de Google Maps (`cafes.google_maps_url`, seed `cafes_2026_11_google_maps.sql`). Pendiente: Instagram de cada local
- [ ] Bloque 5: login con Google vía Google Identity Services (necesita `VITE_GOOGLE_CLIENT_ID`); renombrar sitio en Netlify
- [ ] Fotos para las recetas destacadas (subirlas desde `/admin`)

## Lote 4 — Mapa pulido, perfil de gusto y acceso a Recetas (2026-11-10)

- [x] Mapa: burbuja anclada al pin (tipo, nombre, dirección, Ver en Google Maps), sin recentrar al seleccionar, pin SVG estable, tocar el mapa cierra
- [x] Perfil de gusto: tabla privada `taste_profiles` (4/4 pruebas RLS), cuestionario de 6 preguntas, inferencia desde el diario (familias de sabor desde notas de cata), uso en recetas ("Usar mi perfil de gusto") y en Cafés que van contigo
- [x] Recetas visibles: botón central "+" con hoja Escanear / Pedir receta; tarjeta "Receta para hoy" en Inicio (2 toques hasta la receta); bloque de receta bajo la ficha en el detalle; "Recetario" en Mis cafés
- [ ] Instagram de las cafeterías del seed; fotos de recetas destacadas
- [ ] Login con Google vía GIS; renombrar sitio en Netlify

## Fase 2 — Recetas

- [x] Pestaña "Recetas" con wizard de 4 pasos (café escaneado u otro → familia + dripper → tazas o gramos → equipo y preferencia) y recetario de guardadas
- [x] `suggest-recipe` v2: familia de método, dripper, cantidad, preferencia; prompt con principios de Hoffmann, Wendelboe y Diego Campos
- [ ] Explorar sale de la barra mientras no tenga datos; vuelve en Fase 3

- [x] "Mi equipo" en Perfil (molino, drippers, máquina, otros) → el wizard muestra tus drippers primero y manda el equipo a la receta; el detalle del café también lo usa
- [ ] Temporizador paso a paso dentro de la receta
- [ ] Feedback de la receta (me gustó / muy ácido / muy amargo) para iterar el prompt
- [ ] Recetas por origen sin registro (pantalla "¿qué café tienes?")

## Fase 3 — Explorar Chile

- [ ] Seed curado: ~100-150 cafeterías y tostadurías (Santiago + regiones) con comuna, Instagram, coordenadas
- [ ] Mapa (Leaflet + OpenStreetMap, sin costo) y filtro por comuna/tipo
- [ ] Alta de lugares por usuarios + cola de moderación
- [ ] Ligar `cafes` con `roasters` para "dónde comprar este café"

## Fase 4 — Marca y lanzamiento

- [ ] Nombre final, dominio, íconos y splash
- [ ] Onboarding de 3 pantallas
- [ ] Política de privacidad y términos
- [ ] Decidir perfil público / social
- [ ] Evaluar Capacitor para App Store / Play Store

## Backlog / ideas

- Compartir ficha del café como imagen (stories)
- Importar historial desde Tostado Club (cafés recibidos en la suscripción)
- Ranking de tostadores y orígenes entre usuarios
- Recordatorio de reposo: "tu café tostado el X está listo para filtro"
