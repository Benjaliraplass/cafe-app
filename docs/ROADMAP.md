# ROADMAP — cafe-app

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

- [x] Dirección visual definida y 4 pantallas en Figma (ver SPEC §7)
- [ ] Revisión de Benjamín en Figma y ajustes
- [ ] Instalar shadcn/ui, mapear tokens al tema de Tailwind
- [ ] Reimplementar Login, Mis cafés, Confirmar café, Detalle según Figma
- [ ] Barra inferior transparente con blur; transiciones con framer-motion; íconos lucide-react
- [ ] Deploy y prueba en teléfono

## Fase 1 — Diario + escaneo (MVP usable)

- [ ] Bajar latencia de `suggest-recipe` (51 s): probar `thinkingLevel`/`thinkingBudget` bajo en Gemini, acortar schema, o `gemini-3.5-flash-lite` primero para recetas; registrar modelo y ms por llamada en logs
- [ ] Pedir tildes explícitas en el prompt de recetas (Gemini devolvió "cafe", "extraccion")
- [ ] Prompt de escaneo: si la fecha de tueste viene sin año ("26/10"), asumir el año en curso
- [x] Subir límite de tokens de salida y tratar JSON inválido/truncado como reintentable (fix del error en etiqueta Asunto)

- [ ] Ajustar el prompt de `scan-label` con 10-20 etiquetas reales chilenas (Tostado Club, Pantera, otros)
- [ ] Editar un registro existente (hoy solo crear/eliminar)
- [ ] Autocompletar tostador y café desde el catálogo al escribir (evitar duplicados)
- [ ] Vista de un café del catálogo: todos mis registros de ese café
- [ ] Estadísticas simples en Home: cafés este mes, origen más repetido, puntaje promedio
- [ ] Cerrar registros (beta por invitación) y lista de invitados
- [ ] Google OAuth

## Fase 2 — Recetas

- [ ] Guardar "mi equipo" en el perfil para no escribirlo cada vez
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
