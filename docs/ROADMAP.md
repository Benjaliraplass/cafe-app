# ROADMAP — cafe-app

Estado por fase. Marcar con [x] al cerrar. Cada fase termina con deploy en Netlify y prueba en el teléfono de Benjamín.

## Fase 0 — Infraestructura (2026-11-09)

- [x] Proyecto Supabase `cafe-app` (sa-east-1)
- [x] Esquema inicial + RLS + bucket `coffee-photos`
- [x] Edge Functions `scan-label` y `suggest-recipe` desplegadas
- [ ] Secret `ANTHROPIC_API_KEY` cargado en Supabase (lo carga Benjamín en el dashboard)
- [x] Scaffold PWA: auth, diario, escaneo, detalle, recetas, explorar, perfil
- [x] Repo con CLAUDE.md, SPEC, ROADMAP
- [ ] Sitio en Netlify con env vars y primer deploy
- [ ] Prueba end-to-end en teléfono: registro → escaneo real → guardar → receta

## Fase 1 — Diario + escaneo (MVP usable)

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
