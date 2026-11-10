# Coffee Brewing Knowledge Base — implementación RAG v1.0

**Fecha de revisión:** 2026-11-10. **Alcance:** 61 recetas publicadas, 21 métodos de preparación, 48 fuentes auditables, 236 pasos reproducibles, 25 principios, 24 reglas y 22 casos de prueba.

## Qué es y qué no es

Es una colección curada de recetas de fuentes primarias/editoriales y de protocolos de competición, con atribución y límites. **No** es evidencia de que una receta sea la mejor para todos los cafés o catadores. No se ejecutaron pruebas de laboratorio independientes, ni se descargó material con licencia comercial. No conviene aplicar fine-tuning sobre datos que cambian constantemente: primero usar **RAG + reglas de seguridad + evaluaciones**, y reservar fine-tuning a tono/estructura cuando haya logs consensuados de calidad.

## Archivos

- `coffee_kb_research_y_recetas.xlsx`: hojas de fuentes, recetas, pasos, métodos, principios, ajustes, schema app, prompt RAG, evaluación, vocabulario, riesgos y template de sesiones.
- `coffee_kb_recetas_rag.jsonl`: un JSON por receta, con identificador, fuente, límites y secuencia. Consumir como documentos del buscador.
- `coffee_kb_reglas_ia.json`: principios, ajustes y bloque de instrucciones.

## Diseño de almacenamiento

- PostgreSQL: `sources`, `recipes`, `recipe_steps`, `coffee_batches`, `brew_sessions`, `brew_taste_feedback`, `recommendations`, `evaluation_runs`. Claves externas `recipes.source_id`, `recipe_steps.recipe_id`, `brew_sessions.recipe_id_base`.
- Búsqueda híbrida: filtro estructurado primero (`method_id`, `role`, `required_gear`, `roast`) + ranking semántico sobre `target_profile`, `why_it_works` y `constraints`; no vectorizar indiscriminadamente números.
- Al guardar resultados: registrar `recipe_id`, `source_id`, `source_url`, `model_version`, `prompt_version`, el **input** original y los **parámetros realmente usados**. No reemplazar la receta publicada.
- Al recomendar: excluir `recommendation_role=revisar`; ocultar `competicion` salvo experto explícito; contextual solo si café/equipamiento coincide. Orden: base A > base B > contextual con buen matching > competición opt-in.

## Validaciones antes de producir una receta

1. Campo sin publicar = `null`, jamás estimación silenciosa. Si la IA hace una variante, crear `derived_recipe_id`, `source_recipe_id` y `derived_fields`.
2. Suma de agregados cuantificados en pasos = `brew_water_g` cuando el plan es completo; las etapas con volumen no publicado se eximen y llevan advertencia.
3. `ice_g`, `bypass_water_g`, `beverage_out_g` nunca se confunden con `brew_water_g`; ratio filtro es agua de infusión/café y espresso salida/café.
4. Las temperaturas por fase prevalecen sobre cualquier valor global si son diferentes.
5. Para espresso: cafe en canasto/dosis y líquido final medido en gramos; **no** convertir mililitros con crema a gramos exactos.
6. Para moka: confirmar capacidad del depósito y cesta; no sobrepasar válvula. AeroPress invertida: aviso de derrame.
7. Cualquier conflicto entre documento y secuencia marcado `revisar` bloquea producción; caso `NEL-001`.
8. No inferir perfil sensorial, tueste, proceso, variedades o altitud a partir del país/etiqueta sin datos.

## Ranking inicial propuesto (heurística editorial, requiere A/B test)

```
if recipe.role == 'revisar': EXCLUDE
if recipe.role == 'competicion' and not user.opt_in_competition: EXCLUDE
if method_not_compatible or required_gear_unavailable: EXCLUDE
score = 0.35 * method_and_gear_match + 0.25 * profile_preference_match
      + 0.20 * evidence_and_completeness + 0.10 * roast_match
      + 0.10 * previous_user_feedback_similar_coffees
```

Pesos propuestos para validación, **no resultados de entrenamiento**. Mostrar 1 receta base + 1 alternativa contextual, explicar *por qué*, advertir limitaciones y adjuntar 1–3 URL originales. Aprender de evaluaciones del usuario con historial y preferencia; penalizar recomendaciones que no mejoren su satisfacción.

## Diseño de experiencia de tracking

Campos mínimos: método; café/lote; fecha; molino/ajuste; filtro; dosis; agua en contacto; agua extra/hielo; temperatura; tiempo; bebida final cuando espresso; intensidad de acidez, amargor, cuerpo, astringencia (0–5); agrado (1–5); notas libres. Capturar equipo y tipo de agua como opcionales, conservando su procedencia.

Después de cada brew: preguntar `¿Qué cambiarías?` e idealmente sugerir **un único ensayo**; guardar variable de prueba y un identificador de versión. Un mejor resultado individual tiene prioridad sobre promedios generales del sector.

## Set de evaluación

Utilizar `09_EVALS` para regresiones (exactitud gramos, temperatura, timeline; no falsa atribución; separaciones físicas; equipo y gusto; rechazar datos conflictivos). Añadir métricas: exactitud cuantitativa, cita correcta, groundedness, satisfacción del usuario, éxito de seguimiento y tasa de recomendación no compatible.

## Política editorial y derechos

Estas fichas **parafrasean** las instrucciones de publicación. En producción citar y enlazar a la fuente; verificar términos de uso si se planea reproducir extensas recetas, fotografías o contenido protegido. Registrar cambios de versiones; revalidar enlaces al menos trimestralmente si negocio depende de ellas. `A` indica fuente original, no estudio experimental controlado.

## Brechas identificadas

El objetivo de “todos los métodos” se traduce en las **21 familias populares cubiertas**, no en cada brewer comercial o variación. El roadmap es ampliar: espresso manual/lever, drip automático por marca, Kyoto cold drip, Ibrik competitivo, percolador, vacuum pot avanzado, distintos dispositivos de cápsulas, café infusionado con filtro de tela y decocción regional, **siempre con fuentes verificables**.
