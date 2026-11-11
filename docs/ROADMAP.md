# ROADMAP — Dripo

Estado por fase. Marcar con [x] al cerrar. Cada fase termina con deploy en Netlify y prueba en el teléfono de Benjamín.

## Fase 0 — Infraestructura (2026-11-09)

- [x] Proyecto Supabase `cafe-app` (sa-east-1)
- [x] Esquema inicial + RLS + bucket `coffee-photos`
- [x] Edge Functions `scan-label` y `suggest-recipe` desplegadas
- [x] Secret `GEMINI_API_KEY` cargado en Supabase (se cambió de Anthropic a Gemini)
- [x] Scaffold PWA: auth, diario, escaneo, detalle, recetas, explorar, perfil
- [x] Repo con CLAUDE.md, SPEC, ROADMAP
- [x] Sitio en Netlify (cuenta Tostado Club) conectado al repo, env vars y primer deploy: https://dripocoffee.com (alias técnico https://sweet-faloodeh-218899.netlify.app)
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
- [x] Google OAuth: proyecto Google Cloud `app-cafe`, app publicada (pantalla de consentimiento con política de privacidad en tostadoclub.com/pages/privacidad-dripo), proveedor habilitado en Supabase, Site URL y Redirect URLs configuradas. Probado en teléfono

## Lote 3 — Inicio, catálogo compartido, compartir y cafeterías (2026-11-10)

- [x] Bloque 0: roles admin (`profiles.role`, `is_admin()`), cafés publicables, `featured_recipes`, moderación de cafeterías; 17/17 pruebas RLS con usuarios simulados (se cerró un hueco: el autor podía autoaprobar su cafetería)
- [x] Bloque 1: Recetas con gramos como campo principal y personas a 200 ml; `suggest-recipe` v7
- [x] Bloque 2: pestaña Inicio (recetas destacadas, cafés que van contigo, accesos rápidos), barra de 5 ítems con Escanear central, fichas públicas `/r/:slug` y `/c/:id` con Compartir, `/featured`, `/catalog`, panel `/admin` (recetas destacadas y publicación de cafés), seed de 7 recetas destacadas (Hoffmann V60/Aeropress/prensa, Kasuya 4:6, Wendelboe V60, Kalita y espresso base de Dripo) en `supabase/seed/featured_recipes.sql`
- [x] Bloque 3: switch "Compartir mi registro" y botón Compartir en el detalle; Netlify Edge Function `og.ts` con meta tags OG para `/r/*` y `/c/*`
- [x] Bloque 4: Explorar con mapa (MapLibre GL + OpenFreeMap vectorial, estilo claro; marcadores propios, mi ubicación, "Buscar en esta zona"), lista ordenada por distancia, filtros, "Mis propuestas" con estado; `/explore/new` con geocodificación Nominatim y marcador arrastrable; pestaña Cafeterías en `/admin` (aprobar / rechazar con motivo); sección "Cafeterías cerca" en Inicio; Explorar, Admin y Preview en chunks aparte (bundle 586 → 296 KB)
- [ ] Aviso al admin cuando llega una cafetería nueva (hoy se ve el contador en `/admin`)
- [x] Seed inicial de cafeterías: 33 locales (4 en Pichilemu, 29 en Santiago) cargados aprobados desde la lista de Benjamín (`supabase/seed/cafes_2026_11.sql`). Cada local con enlace a su ficha de Google Maps (`cafes.google_maps_url`, seed `cafes_2026_11_google_maps.sql`). Pendiente: Instagram de cada local
- [x] Bloque 5: login con Google vía Google Identity Services (`VITE_GOOGLE_CLIENT_ID` en Netlify)
- [ ] Fotos para las recetas destacadas (subirlas desde `/admin`)

## Lote 4 — Mapa pulido, perfil de gusto y acceso a Recetas (2026-11-10)

- [x] Mapa: burbuja anclada al pin (tipo, nombre, dirección, Ver en Google Maps), sin recentrar al seleccionar, pin SVG estable, tocar el mapa cierra
- [x] Perfil de gusto: tabla privada `taste_profiles` (4/4 pruebas RLS), cuestionario de 6 preguntas, inferencia desde el diario (familias de sabor desde notas de cata), uso en recetas ("Usar mi perfil de gusto") y en Cafés que van contigo
- [x] Recetas visibles: botón central "+" con hoja Escanear / Pedir receta; tarjeta "Receta para hoy" en Inicio (2 toques hasta la receta); bloque de receta bajo la ficha en el detalle; "Recetario" en Mis cafés
- [ ] Instagram de las cafeterías del seed; fotos de recetas destacadas
- [x] Dominio propio `dripocoffee.com` conectado a Netlify (GoDaddy: A + CNAME), certificado Let's Encrypt; política de privacidad dentro de la app en `/privacidad` (enlazada desde Login y Perfil) y declarada en Google Cloud
- [x] Login con Google vía Google Identity Services (`signInWithIdToken`); la pantalla de Google muestra dripocoffee.com. Probado en teléfono (2026-11-10). Opcional: verificación de marca en Google para mostrar el nombre "Dripo"

## Lote 5 — Datos y analítica (2026-11-10)

- [x] Arquitectura en SPEC §8: producto / eventos / derivados; taxonomía de 25 eventos; definición de activado (primer café guardado)
- [x] Tabla `events` (RLS cerrada) + RPC `track_event` + funciones `admin_user_facts`, `admin_daily_metrics`, `admin_funnel`, `admin_retention`, `admin_top`; pruebas con usuarios simulados
- [x] `src/lib/analytics.ts`: PostHog (carga diferida) + Supabase, id anónimo, sesión, UTM/ref de primer toque; instrumentación completa; `?ref=` en enlaces compartidos
- [x] Pestaña Métricas en `/admin`: usuarios, activación, viralidad (factor K), actividad diaria, embudo, retención semanal, top, lista de usuarios y export CSV (`/preview?v=metrics`)
- [x] PostHog activo (proyecto Dripo, US Cloud, id 725420; `VITE_POSTHOG_KEY` en Netlify). Dashboard "Dripo — Crecimiento" (https://us.posthog.com/project/725420/dashboard/2331176): DAU, registros, embudo de activación, retención semanal, escaneos y recetas (éxito/fallo, latencia p90), viralidad, fuentes UTM, PWA vs navegador, fichas y cafeterías más vistas
- [ ] Cuando haya volumen: materializar `daily_metrics` con `pg_cron`; alertas (caída de activación, errores de escaneo)

## Lote 6 — Robustez de IA y puntaje SCA (2026-11-10)

- [x] `ai.ts`: respaldo cruzado Gemini → Anthropic cuando hay `ANTHROPIC_API_KEY`; mensaje corto al usuario, detalle en logs; se retira `gemini-2.5-flash` (404 para cuentas nuevas)
- [x] `coffees.sca_score`: la IA lo lee de la etiqueta (`scan-label` v8), campo en el formulario, visible en el detalle y la ficha pública
- [x] Proveedor primario Anthropic `claude-haiku-5-5` (secrets cargados 2026-11-11, USD 20 de crédito); Gemini queda de respaldo. Log `IA ok` por llamada
- [ ] Renovar `ANTHROPIC_API_KEY` antes del 1 de marzo de 2027 (vence)

## Lote 7 — Base de conocimiento de preparación (2026-11-10)

Decisión: la KB es contexto de referencia con fuentes citables; no cambia ni limita al generador de recetas.

### 7a — Ingesta
- [x] `docs/kb/`: xlsx de investigación, JSON de reglas y notas de implementación
- [x] Migración `kb_recetas`: `kb_sources`, `kb_methods`, `kb_recipes`, `kb_recipe_steps`, `kb_rules` (RLS: lectura pública, escritura admin; índices en FKs)
- [x] `scripts/kb_seed.py` → `supabase/seed/kb_2026_11.sql` (48 fuentes, 21 métodos, 61 recetas de 33 autores, 236 pasos, 71 reglas); aplicado en producción; integridad verificada (pasos, sumas de agua, FKs)
- [x] QA REST desde dripocoffee.com: lectura anónima OK, inserción anónima bloqueada (401)
- [ ] Verificar las 48 URLs de `kb_sources` y registrar `url_status` / `url_checked_at` (pendiente: requiere navegación con aprobación de sitios)
- [x] `is_featured` en las recetas de la KB que coinciden con las destacadas (V60-001 Hoffmann, V60-003 Kasuya, PO-001 Wendelboe; AeroPress Hoffmann no tiene equivalente en la KB)

### 7b — Generador con referencias
- [ ] `suggest-recipe` v3: 2-3 recetas de la KB como contexto + principios; retirar las escuelas fijas del prompt; salida con `base_recipe_id`, `source_url`, `assumptions`, `confidence`
- [ ] UI: "Referencia: autor, receta · ver fuente" en la receta; clics de molienda solo si el molino coincide
- [ ] Script de evaluación con los 22 casos de `coffee_kb_implementacion.md`
- [ ] Recetario público con las 61 recetas de la KB

### 7c — Loop de feedback
- [ ] Feedback post-preparación (acidez / amargor / cuerpo / agrado + "¿qué cambiarías?") → ajuste A01-A24, una variable por intento; eventos nuevos en la taxonomía

## Lote 8 — Equipo en recetas (2026-11-11)

- [x] `EquipmentPicker`: el paso 4 del wizard y el bloque de receta del detalle muestran el equipo del perfil como chips (un toque lo deja fuera solo en esa receta) y un campo "Algo más para esta receta"; desaparece el texto del prompt en pantalla
- [x] Espresso sin máquina o molino en el perfil: tarjeta "¿Con qué haces espresso?"; lo escrito se guarda en el perfil al generar
- [x] `suggest-recipe` v9: adapta la receta a la máquina y advierte cuando el molino no es apto para espresso
- [x] Política de privacidad: proveedores por categoría (sin stack) y uso agregado para mejorar la app; doc editable en claude.ai
- [x] Café "por probar": "Ya lo probé / Todavía no" al escanear, píldora en tarjetas y detalle, "¿Ya lo probaste?" que abre Mi experiencia, aviso tras guardar receta, Receta para hoy prioriza el pendiente (feedback de usuario)
- [x] Inicio: píldora de números bajo el saludo (cafés · recetas · semanas) y corrección del hueco doble
- [x] Inicio: sección "Tus recetas" (Receta para hoy + guardadas en scroll horizontal); cafeterías sin ubicación ordenadas por las últimas agregadas
- [x] Banda "Hay una versión nueva" (service worker en modo prompt) para que los deploys no confundan en el beta
- [x] Cuadro de molienda: en la tarjeta va solo la primera idea ("Media"); el detalle debajo. El prompt pide `grind` de 1-3 palabras y el matiz en `grind_reference`

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
- [ ] Social (decidido 2026-11-11, modelo Untappd): se activa con +2.000 usuarios, no antes; un feed vacío daña la app
    - Etapa 1 (puede ir antes, como viralidad): perfil público `/u/:handle` con handle único, switch "perfil público" en Perfil, línea de números, registros marcados públicos, recetas elegidas, perfil de gusto; enlace con `?ref=`
    - Etapa 2 (+2.000 usuarios): seguir, feed "De quienes sigues" en Inicio con registros públicos (check-in = café + puntaje + notas + receta), una reacción tipo kudos; sin comentarios ni mensajes; bloqueo y reporte mínimos; política de privacidad actualizada
    - Señal para adelantar la etapa 2: >30 % de usuarios comparte algo (`share_clicked`) y los enlaces traen registros (`share_link_opened` → signup)
- [ ] Evaluar Capacitor para App Store / Play Store

## Backlog / ideas

- Compartir ficha del café como imagen (stories)
- Importar historial desde Tostado Club (cafés recibidos en la suscripción)
- Ranking de tostadores y orígenes entre usuarios
- Recordatorio de reposo: "tu café tostado el X está listo para filtro"
