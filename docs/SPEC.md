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
| `profiles` | 1:1 con `auth.users`, creado por trigger. `equipment` jsonb: `{ grinder, drippers[], espresso_machine, other }` | Lectura pública; escribe el dueño |
| `roasters` | Tostadurías (catálogo compartido), `slug` único | Lectura pública; crea cualquier autenticado; edita el creador |
| `coffees` | Cafés del catálogo compartido, FK a `roasters` | Igual que roasters |
| `coffee_logs` | Diario personal: foto, puntaje, notas, método, fecha de tueste, precio, `raw_scan` jsonb | Solo el dueño (o todos si `is_public`) |
| `recipes` | Recetas generadas/guardadas por usuario, ligadas a un `coffee_log` | Solo el dueño |
| `cafes` | Cafeterías/tostadurías con local, `kind` (cafe/roastery/both), `status` de moderación | Se ven las aprobadas y las propias; alta como `pending` |
| Storage `coffee-photos` | Bucket público, ruta `{user_id}/{uuid}.jpg`, máx 10 MB | Escribe solo en su carpeta |

Migraciones en `supabase/migrations/`.

## 5. Edge Functions

### `scan-label`
- Entrada: `{ image_base64, media_type }` (jpeg/png/webp).
- Salida: `ScanResult` (ver `src/lib/types.ts`), con `confidence` (alta/media/baja), `is_coffee_label` y `notes_for_user`.
- Prompt: extraer solo lo escrito; `null` si no está; normalización de país, proceso y perfil de tueste en español.

### `suggest-recipe`
- Entrada: `{ coffee?, coffee_description?, method_family (conico|flat|inmersion|espresso), dripper, servings? (tazas, 1 taza = 250 g agua), dose_g?, equipment?, preferences? }`. `brew_method` se acepta por compatibilidad.
- El prompt codifica reglas por familia (cónico, fondo plano, inmersión, espresso), escalado por cantidad y principios de tres escuelas (Hoffmann: precisión y ratios 1:16-1:17; Wendelboe: limpieza y agua caliente; Campos: dulzor y temperaturas más bajas en procesados).
- Salida: `RecipeData`: `params` (dosis, agua, ratio, temperatura, molienda, tiempo, salida, presión), `steps` con tiempos, `rationale`, `adjustments` (3), `rest_advice`.
- La receta se justifica por origen/proceso/tueste; considera reposo si hay fecha de tueste.

Secret requerido: `GEMINI_API_KEY`. Opcionales: `GEMINI_MODEL` / `GEMINI_MODELS` (cadena), `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.

## 6. Flujos de la app

1. **Login**: correo + contraseña (Supabase Auth). Google OAuth pendiente de configurar en Supabase + Google Cloud.
2. **Escanear**: cámara o galería → redimensionar → `scan-label` → formulario prellenado → editar → guardar (sube foto, resuelve/crea tostador y café, inserta log). Si la IA falla, se puede completar a mano.
3. **Mis cafés**: lista de logs con foto, tostador, café, origen, puntaje y fecha.
4. **Detalle**: ficha completa + generador de recetas (método + equipo) → guardar receta → lista de recetas guardadas. Eliminar registro.
5. **Recetas** (pestaña): wizard de 4 pasos → receta con IA → guardar (ligada al café si se eligió uno). Debajo, recetario de recetas guardadas.
6. **Explorar**: lista de `cafes` aprobadas con búsqueda. Fuera de la barra hasta tener datos (ruta `/explore` sigue activa).
7. **Perfil**: correo, "Mi equipo" (molino, drippers por familia, máquina de espresso, otros) y cerrar sesión. El equipo alimenta las recetas sin volver a escribirlo.

## 7. Dirección visual (decidida 2026-11-09)

- Referencias: Vivino (estructura), Blue Bottle Coffee y Honest Greens (tono minimalista, editorial).
- Elegida: **V3 — tema claro, escala de grises, DM Sans**. Figma: https://www.figma.com/design/tC72X7goZvicV5dbNaxeVx (página "Dripo — App", sección "v3 ✓ ELEGIDA"; v1 Fraunces oscuro y v2 DM Sans oscuro quedan como referencia).
- Tokens (colección "Dripo / Color", modo Light → CSS `:root`): `background #FFFFFF`, `card #F5F4F1`, `muted #ECEAE6`, `border #E6E3DE`, `border-strong #CFCBC4`, `foreground #111111`, `muted-foreground #6B6763`, `tertiary #9A958F`, `primary #111111` / `primary-foreground #FFFFFF`. El modo Dark (V2) existe en Figma y en `.dark` del CSS para activarlo a futuro.
- Tipografía: DM Sans. Títulos Medium con tracking -3 % (34-46 px), cifras Medium, cuerpo Regular, etiquetas 10-11 px en mayúsculas con tracking 8 %.
- Barra inferior transparente con blur (`bg-background/72 backdrop-blur-xl`, borde superior sutil), 4 ítems iguales sin botón destacado.
- Componentes: inputs `card` con borde `border` radio 12 y alto 48; botón primario negro radio 14 alto 54; chips redondeados (activo negro); fotos con esquinas 14-20; listas con divisores en vez de tarjetas.
- Implementación: shadcn/ui (Radix + cva + Tailwind v4) con los tokens anteriores como variables CSS.

## 8. Pendientes conocidos

- Seed de cafeterías/tostadurías de Chile (Fase 3).
- Dominio e íconos definitivos (los actuales son una gota monocroma provisoria).
- Google OAuth.
- Cerrar registros (beta por invitación): en Supabase Auth desactivar "Allow new users to sign up" e invitar desde el dashboard, o tabla de allowlist.
- Perfil público / social (seguir, feed) — fuera del MVP.
- Capacitor para tiendas — fuera del MVP.
