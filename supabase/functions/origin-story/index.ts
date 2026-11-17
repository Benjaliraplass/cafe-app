// origin-story: "Sobre su origen" (Lote 16). Genera y guarda textos cortos sobre el país, la región
// y la finca de un café en `origin_notes`. Solo genera lo que falta; el cliente lee con el RPC
// get_origin_notes(coffee_id).
//
// Body: { coffee_id: string, part: "place" | "farm" }
//   place = país + región (una llamada estructurada, Gemini o Claude)
//   farm  = finca/productor con búsqueda web (solo Claude); sin fuente verificable se guarda found=false
// Respuesta: { ok: true, data: { created: string[] } } | { ok: false, error: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { callStructured, callWithWebSearch, corsHeaders, json, lastModelUsed } from "../_shared/ai.ts";

type Kind = "country" | "region" | "farm";

interface Coffee {
  id: string;
  origin_country: string | null;
  region: string | null;
  farm: string | null;
  producer: string | null;
}

// ---------------------------------------------------------------------------
// País y región
// ---------------------------------------------------------------------------

interface PlaceResult {
  country_title: string;
  country_body: string;
  country_fun_fact: string | null;
  region_known: boolean;
  region_title: string | null;
  region_body: string | null;
  region_fun_fact: string | null;
}

const PLACE_SYSTEM = `Eres un educador de café de especialidad. Escribes textos breves para una app donde la gente registra los cafés que toma, para que entiendan de dónde viene su café.

Reglas de veracidad (lo más importante):
- Escribe solo hechos ampliamente documentados y estables sobre el café en ese lugar: geografía y clima, altitudes típicas, épocas de cosecha, variedades y procesos característicos, perfil de taza típico, historia cafetera conocida.
- No inventes nombres, fechas, cifras exactas, premios ni anécdotas. Prefiere rangos ("entre 1.400 y 2.000 msnm") a cifras puntuales. Si no estás seguro de algo, no lo incluyas.
- El texto se comparte entre muchos cafés del mismo origen: no menciones un tostador, finca, variedad o proceso en particular de este café.

Región:
- Si la región indicada es una zona cafetera real de ese país que reconoces con seguridad, region_known = true.
- Si es una ciudad o municipio, ubícala en su departamento, provincia o zona cafetera (ej. "Pereira" en Colombia → "Pereira, Risaralda", parte del Eje Cafetero) y escribe sobre esa zona.
- Si el país define regiones cafeteras oficiales y la zona indicada es una de ellas o pertenece a una, nómbrala como tal.
- Si no la reconoces, es ambigua o no hay región, region_known = false y deja region_title, region_body y region_fun_fact en null.

Formato:
- Español neutro, tono cercano y claro, sin emojis, sin signos de exclamación.
- country_title: nombre del país. region_title: nombre de la región como se reconoce (ej. "Huila", "Yirgacheffe, Sidama", "Pereira, Risaralda").
- *_body: 2 a 3 frases, máximo 320 caracteres. Qué hace particular a ese origen para el café.
- *_fun_fact: un dato curioso en una frase, máximo 160 caracteres, solo si es un hecho muy conocido y verificable (ej. una declaración de la UNESCO, el origen histórico de una variedad). Sin listas de lugares ni comparaciones. Ante la mínima duda, null.`;

const PLACE_TOOL = {
  name: "registrar_origen",
  description: "Registra los textos sobre el país y la región de origen de un café",
  input_schema: {
    type: "object",
    properties: {
      country_title: { type: "string" },
      country_body: { type: "string" },
      country_fun_fact: { type: ["string", "null"] },
      region_known: { type: "boolean" },
      region_title: { type: ["string", "null"] },
      region_body: { type: ["string", "null"] },
      region_fun_fact: { type: ["string", "null"] },
    },
    required: [
      "country_title",
      "country_body",
      "country_fun_fact",
      "region_known",
      "region_title",
      "region_body",
      "region_fun_fact",
    ],
  },
};

// ---------------------------------------------------------------------------
// Finca / productor
// ---------------------------------------------------------------------------

interface FarmResult {
  found: boolean;
  title: string | null;
  body: string | null;
  fun_fact: string | null;
  sources: Array<{ url: string; title: string | null }>;
}

const FARM_SYSTEM = `Eres un investigador de café de especialidad. Buscas en la web información verificable sobre la finca o el productor de un café, para una app donde la gente registra los cafés que toma.

Proceso:
1. Busca la finca y/o el productor junto con el país y la región (máximo 3 búsquedas). Buenas fuentes: importadores de café verde, tostadores, Cup of Excellence, cooperativas, prensa especializada.
2. Al terminar, llama SIEMPRE a la herramienta registrar_finca con el resultado.

Reglas de veracidad (lo más importante):
- found = true solo si al menos una fuente menciona explícitamente esa finca o ese productor en ese país (y en esa región si se indicó).
- Si hay varias fincas o productores con el mismo nombre y no puedes saber cuál es, found = false. Con nombres comunes (ej. "El Jardín", "La Esperanza", "San José") exige que coincida también la región o el productor indicados; si no se indicó ninguno de los dos, found = false.
- Si el nombre en las fuentes difiere del indicado solo por una errata evidente de lectura (letras cambiadas o invertidas) y coinciden país y región, puedes usar el nombre de las fuentes. Si la diferencia es mayor, found = false.
- El texto se basa únicamente en lo que dicen las fuentes: ubicación, altitud, quién la trabaja, cuánto tiempo, prácticas, variedades que cultiva. No agregues nada que no esté en las fuentes ni lo completes con conocimiento general.
- Describe la finca o al productor, no lotes puntuales: no menciones puntajes, lotes, procesos ni premios de cafés específicos (podrían no ser el que la persona tiene).
- Si las fuentes se contradicen en un dato, omite ese dato. No expliques contradicciones ni cites a las fuentes en el texto.
- sources: las URLs exactas de los resultados que respaldan el texto (1 a 3), con su título.
- Si found = false, deja title, body y fun_fact en null y sources vacío.

Formato:
- Español neutro, tono cercano y claro, sin emojis, sin signos de exclamación.
- title: nombre de la finca (o del productor si no hay finca), como aparece en las fuentes.
- body: 2 a 3 frases, máximo 320 caracteres.
- fun_fact: un dato curioso de las fuentes en una frase, máximo 160 caracteres, o null.`;

const FARM_TOOL = {
  name: "registrar_finca",
  description: "Registra lo encontrado sobre la finca o el productor de un café",
  input_schema: {
    type: "object",
    properties: {
      found: { type: "boolean" },
      title: { type: ["string", "null"] },
      body: { type: ["string", "null"] },
      fun_fact: { type: ["string", "null"] },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: { url: { type: "string" }, title: { type: ["string", "null"] } },
          required: ["url", "title"],
        },
      },
    },
    required: ["found", "title", "body", "fun_fact", "sources"],
  },
};

/** Compara URLs sin protocolo, www ni barra final (el modelo a veces las reescribe levemente). */
function urlKey(u: string): string {
  return u.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[#?].*$/, "").replace(/\/+$/, "");
}

const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Método no permitido" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const coffeeId = typeof body?.coffee_id === "string" ? body.coffee_id : null;
    const part = body?.part === "farm" ? "farm" : body?.part === "place" ? "place" : null;
    if (!coffeeId || !part) {
      return json({ ok: false, error: "Faltan coffee_id o part" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(url, key, { auth: { persistSession: false } });

    const { data: coffee, error: coffeeErr } = await admin
      .from("coffees")
      .select("id, origin_country, region, farm, producer")
      .eq("id", coffeeId)
      .maybeSingle<Coffee>();
    if (coffeeErr) throw new Error(coffeeErr.message);
    if (!coffee) return json({ ok: false, error: "Café no encontrado" }, 404);

    const { data: keys, error: keysErr } = await admin.rpc("origin_keys_for_coffee", { p_coffee_id: coffeeId });
    if (keysErr) throw new Error(keysErr.message);
    const byKind = new Map<Kind, string>((keys ?? []).map((k: { kind: Kind; key: string }) => [k.kind, k.key]));

    const wanted: Kind[] = part === "place" ? ["country", "region"] : ["farm"];
    const wantedKeys = wanted.map((k) => byKind.get(k)).filter((k): k is string => !!k);
    if (wantedKeys.length === 0) return json({ ok: true, data: { created: [] } });

    // Con service role se ven también las ocultas: no se regeneran.
    const { data: existing, error: exErr } = await admin.from("origin_notes").select("key").in("key", wantedKeys);
    if (exErr) throw new Error(exErr.message);
    const have = new Set((existing ?? []).map((r: { key: string }) => r.key));
    const missing = wanted.filter((k) => byKind.has(k) && !have.has(byKind.get(k)!));
    if (missing.length === 0) return json({ ok: true, data: { created: [] } });

    const rows: Array<Record<string, unknown>> = [];

    if (part === "place") {
      const regionLine = coffee.region ? `Región o zona indicada en la etiqueta: ${coffee.region}` : "Región: no indicada";
      const r = await callStructured<PlaceResult>({
        system: PLACE_SYSTEM,
        content: [{ type: "text", text: `País de origen del café: ${coffee.origin_country}\n${regionLine}` }],
        tool: PLACE_TOOL,
        maxTokens: 1500,
      });
      const model = lastModelUsed();
      if (missing.includes("country") && clean(r.country_body)) {
        rows.push({
          kind: "country",
          key: byKind.get("country"),
          title: clean(r.country_title) ?? coffee.origin_country,
          body: clean(r.country_body),
          fun_fact: clean(r.country_fun_fact),
          sources: [],
          found: true,
          model,
        });
      }
      if (missing.includes("region")) {
        const known = r.region_known && !!clean(r.region_body);
        // Región no reconocida: se guarda como no encontrada para no volver a preguntar.
        rows.push({
          kind: "region",
          key: byKind.get("region"),
          title: known ? clean(r.region_title) ?? coffee.region : null,
          body: known ? clean(r.region_body) : null,
          fun_fact: known ? clean(r.region_fun_fact) : null,
          sources: [],
          found: known,
          model,
        });
      }
    } else {
      const lines = [
        coffee.farm ? `Finca: ${coffee.farm}` : null,
        coffee.producer ? `Productor: ${coffee.producer}` : null,
        `País: ${coffee.origin_country}`,
        coffee.region ? `Región: ${coffee.region}` : null,
      ].filter(Boolean);
      const r = await callWithWebSearch<FarmResult>({
        system: FARM_SYSTEM,
        prompt: `Busca información sobre el origen de este café de especialidad:\n${lines.join("\n")}`,
        tool: FARM_TOOL,
        maxSearches: 3,
      });
      // Solo fuentes que de verdad aparecieron en la búsqueda.
      const seen = new Map([...r.seenUrls].map((u) => [urlKey(u), u]));
      const sources = (Array.isArray(r.input.sources) ? r.input.sources : [])
        .filter((s) => s?.url && seen.has(urlKey(s.url)))
        .map((s) => ({ url: seen.get(urlKey(s.url))!, title: clean(s.title) }))
        .slice(0, 3);
      const found = r.input.found === true && !!clean(r.input.body) && sources.length > 0;
      if (r.input.found && !found) {
        console.warn(`origin-story: finca descartada sin fuente válida (${coffeeId})`, JSON.stringify(r.input.sources));
      }
      rows.push({
        kind: "farm",
        key: byKind.get("farm"),
        title: found ? clean(r.input.title) ?? coffee.farm ?? coffee.producer : null,
        body: found ? clean(r.input.body) : null,
        fun_fact: found ? clean(r.input.fun_fact) : null,
        sources: found ? sources : [],
        found,
        model: r.model,
      });
    }

    if (rows.length) {
      // Todas las filas llevan las mismas columnas: en un upsert de varias filas PostgREST pone null
      // en las que falten (y found/sources son not null).
      // Dos visitas simultáneas pueden generar lo mismo: gana la primera.
      const { error: insErr } = await admin.from("origin_notes").upsert(rows, { onConflict: "key", ignoreDuplicates: true });
      if (insErr) throw new Error(insErr.message);
    }
    return json({ ok: true, data: { created: rows.map((r) => r.kind) } });
  } catch (err) {
    console.error("origin-story error", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return json({ ok: false, error: message }, 500);
  }
});
