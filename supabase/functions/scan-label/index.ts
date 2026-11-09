// scan-label: recibe la foto de una bolsa de café y devuelve los datos de la etiqueta
// como JSON estructurado usando IA con visión (Gemini o Claude, ver _shared/ai.ts).
//
// Body: { image_base64: string, media_type: "image/jpeg" | "image/png" | "image/webp" }
// Respuesta: { ok: true, data: ScanResult } | { ok: false, error: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callStructured, corsHeaders, json } from "../_shared/ai.ts";

interface ScanResult {
  roaster_name: string | null;
  coffee_name: string | null;
  origin_country: string | null;
  region: string | null;
  farm: string | null;
  producer: string | null;
  variety: string | null;
  process: string | null;
  altitude_masl: number | null;
  roast_level: string | null;
  roast_profile: "espresso" | "filtro" | "omni" | null;
  tasting_notes: string[];
  roast_date: string | null;
  weight_grams: number | null;
  confidence: "alta" | "media" | "baja";
  is_coffee_label: boolean;
  notes_for_user: string | null;
}

const SYSTEM = `Eres un experto en café de especialidad que lee etiquetas de bolsas de café.
Extrae únicamente lo que aparece escrito en la etiqueta. No inventes datos: si un campo no está, devuelve null.
Normaliza:
- origin_country: nombre del país en español (ej. "Colombia", "Etiopía", "Brasil").
- process: usa términos estándar en español cuando aplique ("Lavado", "Natural", "Honey", "Anaeróbico", "Descafeinado", etc.). Si es una combinación, descríbela brevemente.
- roast_profile: "espresso", "filtro" u "omni" solo si la etiqueta lo indica (incluye sinónimos como "filter", "pour over", "espresso roast").
- tasting_notes: lista de notas de sabor tal como aparecen, en español si están en español, máximo 8.
- roast_date: formato YYYY-MM-DD si se puede inferir; si solo hay mes y año, usa el día 01.
- altitude_masl: número entero en metros; si es un rango, usa el promedio.
- confidence: "alta" si la etiqueta se lee bien y los campos clave (tostador, origen) están claros; "media" si hay dudas; "baja" si la foto está borrosa o faltan datos clave.
- is_coffee_label: false si la imagen no es una etiqueta o bolsa de café.
- notes_for_user: una frase corta en español neutro si hay algo que el usuario debería revisar (ej. texto ilegible), si no, null.`;

const TOOL = {
  name: "registrar_etiqueta",
  description: "Registra los datos extraídos de la etiqueta de una bolsa de café",
  input_schema: {
    type: "object",
    properties: {
      roaster_name: { type: ["string", "null"] },
      coffee_name: { type: ["string", "null"] },
      origin_country: { type: ["string", "null"] },
      region: { type: ["string", "null"] },
      farm: { type: ["string", "null"] },
      producer: { type: ["string", "null"] },
      variety: { type: ["string", "null"] },
      process: { type: ["string", "null"] },
      altitude_masl: { type: ["integer", "null"] },
      roast_level: { type: ["string", "null"] },
      roast_profile: {
        type: ["string", "null"],
        enum: ["espresso", "filtro", "omni", null],
      },
      tasting_notes: { type: "array", items: { type: "string" } },
      roast_date: { type: ["string", "null"] },
      weight_grams: { type: ["integer", "null"] },
      confidence: { type: "string", enum: ["alta", "media", "baja"] },
      is_coffee_label: { type: "boolean" },
      notes_for_user: { type: ["string", "null"] },
    },
    required: [
      "roaster_name",
      "coffee_name",
      "origin_country",
      "region",
      "farm",
      "producer",
      "variety",
      "process",
      "altitude_masl",
      "roast_level",
      "roast_profile",
      "tasting_notes",
      "roast_date",
      "weight_grams",
      "confidence",
      "is_coffee_label",
      "notes_for_user",
    ],
  },
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Método no permitido" }, 405);
  }

  try {
    const body = await req.json();
    const image_base64: string | undefined = body?.image_base64;
    const media_type: string = body?.media_type ?? "image/jpeg";

    if (!image_base64 || typeof image_base64 !== "string") {
      return json({ ok: false, error: "Falta image_base64" }, 400);
    }
    if (!ALLOWED_TYPES.has(media_type)) {
      return json({ ok: false, error: `media_type no soportado: ${media_type}` }, 400);
    }
    // ~5 MB en base64
    if (image_base64.length > 7_000_000) {
      return json({ ok: false, error: "Imagen demasiado grande (máx ~5 MB)" }, 413);
    }

    const data = await callStructured<ScanResult>({
      system: SYSTEM,
      content: [
        {
          type: "image",
          source: { type: "base64", media_type, data: image_base64 },
        },
        {
          type: "text",
          text: "Lee esta etiqueta de café y registra los datos.",
        },
      ],
      tool: TOOL,
      maxTokens: 4096,
    });

    return json({ ok: true, data });
  } catch (err) {
    console.error("scan-label error", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return json({ ok: false, error: message }, 500);
  }
});
